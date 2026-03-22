use super::*;
use std::collections::HashSet;
use codexmanager_core::storage::{now_ts, Storage, UsageSnapshotRecord};
use std::ffi::OsString;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

fn candidate_list() -> Vec<(Account, Token)> {
    vec![
        (
            Account {
                id: "acc-a".to_string(),
                label: "".to_string(),
                issuer: "".to_string(),
                chatgpt_account_id: None,
                workspace_id: None,
                group_name: None,
                sort: 0,
                status: "active".to_string(),
                created_at: 0,
                updated_at: 0,
            },
            Token {
                account_id: "acc-a".to_string(),
                id_token: "".to_string(),
                access_token: "".to_string(),
                refresh_token: "".to_string(),
                api_key_access_token: None,
                last_refresh: 0,
            },
        ),
        (
            Account {
                id: "acc-b".to_string(),
                label: "".to_string(),
                issuer: "".to_string(),
                chatgpt_account_id: None,
                workspace_id: None,
                group_name: None,
                sort: 1,
                status: "active".to_string(),
                created_at: 0,
                updated_at: 0,
            },
            Token {
                account_id: "acc-b".to_string(),
                id_token: "".to_string(),
                access_token: "".to_string(),
                refresh_token: "".to_string(),
                api_key_access_token: None,
                last_refresh: 0,
            },
        ),
        (
            Account {
                id: "acc-c".to_string(),
                label: "".to_string(),
                issuer: "".to_string(),
                chatgpt_account_id: None,
                workspace_id: None,
                group_name: None,
                sort: 2,
                status: "active".to_string(),
                created_at: 0,
                updated_at: 0,
            },
            Token {
                account_id: "acc-c".to_string(),
                id_token: "".to_string(),
                access_token: "".to_string(),
                refresh_token: "".to_string(),
                api_key_access_token: None,
                last_refresh: 0,
            },
        ),
    ]
}

fn account_ids(candidates: &[(Account, Token)]) -> Vec<String> {
    candidates
        .iter()
        .map(|(account, _)| account.id.clone())
        .collect()
}

/// @brief 构造路由测试用的低配额账号集合。
fn low_quota_ids(ids: &[&str]) -> HashSet<String> {
    ids.iter().map(|id| (*id).to_string()).collect()
}

/**
 * @brief 生成测试用临时数据库路径
 * @return 临时数据库路径
 */
fn unique_temp_db_path() -> PathBuf {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock")
        .as_nanos();
    std::env::temp_dir().join(format!("codexmanager-route-hint-test-{unique}.db"))
}

/**
 * @brief 环境变量恢复器，离开作用域后自动还原
 * @return 无
 */
struct EnvRestore(Vec<(String, Option<OsString>)>);

impl Drop for EnvRestore {
    fn drop(&mut self) {
        for (key, value) in self.0.drain(..) {
            if let Some(value) = value {
                std::env::set_var(&key, value);
            } else {
                std::env::remove_var(&key);
            }
        }
    }
}

/**
 * @brief 临时覆盖低配额账号退出均衡轮询开关，并在离开作用域后恢复
 * @return 无
 */
struct LowQuotaBalancedRoutingRestore {
    previous: bool,
}

impl LowQuotaBalancedRoutingRestore {
    /**
     * @brief 创建低配额均衡轮询开关恢复器
     * @param enabled 测试期间要设置的开关状态
     * @return 开关恢复器
     */
    fn new(enabled: bool) -> Self {
        let previous = crate::usage_refresh::exclude_low_quota_from_balanced_routing();
        let _ = crate::usage_refresh::set_background_tasks_settings(
            crate::usage_refresh::BackgroundTasksSettingsPatch {
                exclude_low_quota_from_balanced_routing: Some(enabled),
                ..Default::default()
            },
        );
        Self { previous }
    }
}

impl Drop for LowQuotaBalancedRoutingRestore {
    fn drop(&mut self) {
        let _ = crate::usage_refresh::set_background_tasks_settings(
            crate::usage_refresh::BackgroundTasksSettingsPatch {
                exclude_low_quota_from_balanced_routing: Some(self.previous),
                ..Default::default()
            },
        );
    }
}

/**
 * @brief 在临时数据库中执行测试逻辑
 * @param test 测试回调，传入已初始化的 Storage 与 db 路径
 * @return 无
 */
fn with_temp_db(test: impl FnOnce(&Storage, &PathBuf)) {
    let db_path = unique_temp_db_path();
    let previous_db_path = std::env::var_os("CODEXMANAGER_DB_PATH");
    std::env::set_var("CODEXMANAGER_DB_PATH", &db_path);
    let _env = EnvRestore(vec![(
        "CODEXMANAGER_DB_PATH".to_string(),
        previous_db_path,
    )]);
    let storage = Storage::open(&db_path).expect("open storage");
    storage.init().expect("init storage");
    test(&storage, &db_path);
    drop(storage);
    let _ = std::fs::remove_file(&db_path);
}

/**
 * @brief 写入用量快照，用于构造低配额账号
 * @param storage 数据库存储
 * @param account_id 账号 ID
 * @param used_percent 主窗口用量百分比
 * @param secondary_used_percent 次窗口用量百分比
 * @return 无
 */
fn insert_usage_snapshot(
    storage: &Storage,
    account_id: &str,
    used_percent: f64,
    secondary_used_percent: Option<f64>,
) {
    let now = now_ts();
    let snapshot = UsageSnapshotRecord {
        account_id: account_id.to_string(),
        used_percent: Some(used_percent),
        window_minutes: Some(300),
        resets_at: None,
        secondary_used_percent,
        secondary_window_minutes: secondary_used_percent.map(|_| 10_080),
        secondary_resets_at: None,
        credits_json: None,
        captured_at: now,
    };
    storage
        .insert_usage_snapshot(&snapshot)
        .expect("insert usage snapshot");
}

#[test]
fn defaults_to_ordered_strategy() {
    let _guard = route_strategy_test_guard();
    let previous = std::env::var(ROUTE_STRATEGY_ENV).ok();
    std::env::remove_var(ROUTE_STRATEGY_ENV);
    reload_from_env();
    clear_route_state_for_tests();

    let mut candidates = candidate_list();
    apply_route_strategy(&mut candidates, "gk_1", Some("gpt-5.3-codex"));
    assert_eq!(
        account_ids(&candidates),
        vec![
            "acc-a".to_string(),
            "acc-b".to_string(),
            "acc-c".to_string()
        ]
    );

    let mut second = candidate_list();
    apply_route_strategy(&mut second, "gk_1", Some("gpt-5.3-codex"));
    assert_eq!(
        account_ids(&second),
        vec![
            "acc-a".to_string(),
            "acc-b".to_string(),
            "acc-c".to_string()
        ]
    );

    if let Some(value) = previous {
        std::env::set_var(ROUTE_STRATEGY_ENV, value);
    } else {
        std::env::remove_var(ROUTE_STRATEGY_ENV);
    }
    reload_from_env();
}

#[test]
fn balanced_round_robin_rotates_start_by_key_and_model() {
    let _guard = route_strategy_test_guard();
    let previous = std::env::var(ROUTE_STRATEGY_ENV).ok();
    std::env::set_var(ROUTE_STRATEGY_ENV, "balanced");
    reload_from_env();
    clear_route_state_for_tests();

    let mut first = candidate_list();
    apply_route_strategy(&mut first, "gk_1", Some("gpt-5.3-codex"));
    assert_eq!(
        account_ids(&first),
        vec![
            "acc-a".to_string(),
            "acc-b".to_string(),
            "acc-c".to_string()
        ]
    );

    let mut second = candidate_list();
    apply_route_strategy(&mut second, "gk_1", Some("gpt-5.3-codex"));
    assert_eq!(
        account_ids(&second),
        vec![
            "acc-b".to_string(),
            "acc-c".to_string(),
            "acc-a".to_string()
        ]
    );

    let mut third = candidate_list();
    apply_route_strategy(&mut third, "gk_1", Some("gpt-5.3-codex"));
    assert_eq!(
        account_ids(&third),
        vec![
            "acc-c".to_string(),
            "acc-a".to_string(),
            "acc-b".to_string()
        ]
    );

    if let Some(value) = previous {
        std::env::set_var(ROUTE_STRATEGY_ENV, value);
    } else {
        std::env::remove_var(ROUTE_STRATEGY_ENV);
    }
    reload_from_env();
}

/**
 * @brief balanced 模式下排除低配额账号参与正常轮转
 * @return 无
 */
#[test]
fn balanced_round_robin_skips_low_quota_when_enabled() {
    let _guard = route_strategy_test_guard();
    let previous = std::env::var(ROUTE_STRATEGY_ENV).ok();
    std::env::set_var(ROUTE_STRATEGY_ENV, "balanced");
    reload_from_env();
    clear_route_state_for_tests();
    let _low_quota_setting = LowQuotaBalancedRoutingRestore::new(true);

    with_temp_db(|storage, _| {
        insert_usage_snapshot(storage, "acc-b", 85.0, None);

        let mut first = candidate_list();
        apply_route_strategy(&mut first, "gk_1", Some("gpt-5.3-codex"));
        assert_eq!(account_ids(&first), vec!["acc-a", "acc-c", "acc-b"]);

        let mut second = candidate_list();
        apply_route_strategy(&mut second, "gk_1", Some("gpt-5.3-codex"));
        assert_eq!(account_ids(&second), vec!["acc-c", "acc-a", "acc-b"]);
    });

    if let Some(value) = previous {
        std::env::set_var(ROUTE_STRATEGY_ENV, value);
    } else {
        std::env::remove_var(ROUTE_STRATEGY_ENV);
    }
    reload_from_env();
}

/**
 * @brief 全部候选为低配额时保持 balanced 轮转
 * @return 无
 */
#[test]
fn balanced_round_robin_falls_back_when_all_low_quota() {
    let _guard = route_strategy_test_guard();
    let previous = std::env::var(ROUTE_STRATEGY_ENV).ok();
    std::env::set_var(ROUTE_STRATEGY_ENV, "balanced");
    reload_from_env();
    clear_route_state_for_tests();
    let _low_quota_setting = LowQuotaBalancedRoutingRestore::new(true);

    with_temp_db(|storage, _| {
        insert_usage_snapshot(storage, "acc-a", 90.0, None);
        insert_usage_snapshot(storage, "acc-b", 92.0, None);
        insert_usage_snapshot(storage, "acc-c", 95.0, None);

        let mut first = candidate_list();
        apply_route_strategy(&mut first, "gk_1", Some("gpt-5.3-codex"));
        assert_eq!(account_ids(&first), vec!["acc-a", "acc-b", "acc-c"]);

        let mut second = candidate_list();
        apply_route_strategy(&mut second, "gk_1", Some("gpt-5.3-codex"));
        assert_eq!(account_ids(&second), vec!["acc-b", "acc-c", "acc-a"]);
    });

    if let Some(value) = previous {
        std::env::set_var(ROUTE_STRATEGY_ENV, value);
    } else {
        std::env::remove_var(ROUTE_STRATEGY_ENV);
    }
    reload_from_env();
}

/**
 * @brief 关闭开关时仍按原 balanced 轮转
 * @return 无
 */
#[test]
fn balanced_round_robin_respects_disable_low_quota_setting() {
    let _guard = route_strategy_test_guard();
    let previous = std::env::var(ROUTE_STRATEGY_ENV).ok();
    std::env::set_var(ROUTE_STRATEGY_ENV, "balanced");
    reload_from_env();
    clear_route_state_for_tests();
    let _low_quota_setting = LowQuotaBalancedRoutingRestore::new(false);

    with_temp_db(|storage, _| {
        insert_usage_snapshot(storage, "acc-b", 85.0, None);

        let mut first = candidate_list();
        apply_route_strategy(&mut first, "gk_1", Some("gpt-5.3-codex"));
        assert_eq!(account_ids(&first), vec!["acc-a", "acc-b", "acc-c"]);

        let mut second = candidate_list();
        apply_route_strategy(&mut second, "gk_1", Some("gpt-5.3-codex"));
        assert_eq!(account_ids(&second), vec!["acc-b", "acc-c", "acc-a"]);
    });

    if let Some(value) = previous {
        std::env::set_var(ROUTE_STRATEGY_ENV, value);
    } else {
        std::env::remove_var(ROUTE_STRATEGY_ENV);
    }
    reload_from_env();
}

#[test]
fn balanced_round_robin_isolated_by_key_and_model() {
    let _guard = route_strategy_test_guard();
    let previous = std::env::var(ROUTE_STRATEGY_ENV).ok();
    std::env::set_var(ROUTE_STRATEGY_ENV, "balanced");
    reload_from_env();
    clear_route_state_for_tests();

    let mut gpt_first = candidate_list();
    apply_route_strategy(&mut gpt_first, "gk_1", Some("gpt-5.3-codex"));
    assert_eq!(account_ids(&gpt_first)[0], "acc-a");

    let mut gpt_second = candidate_list();
    apply_route_strategy(&mut gpt_second, "gk_1", Some("gpt-5.3-codex"));
    assert_eq!(account_ids(&gpt_second)[0], "acc-b");

    let mut o3_first = candidate_list();
    apply_route_strategy(&mut o3_first, "gk_1", Some("o3"));
    assert_eq!(account_ids(&o3_first)[0], "acc-a");

    let mut other_key_first = candidate_list();
    apply_route_strategy(&mut other_key_first, "gk_2", Some("gpt-5.3-codex"));
    assert_eq!(account_ids(&other_key_first)[0], "acc-a");

    if let Some(value) = previous {
        std::env::set_var(ROUTE_STRATEGY_ENV, value);
    } else {
        std::env::remove_var(ROUTE_STRATEGY_ENV);
    }
    reload_from_env();
}

#[test]
fn balanced_round_robin_keeps_low_quota_candidates_as_tail_fallback() {
    let _guard = route_strategy_test_guard();
    let previous = std::env::var(ROUTE_STRATEGY_ENV).ok();
    std::env::set_var(ROUTE_STRATEGY_ENV, "balanced");
    reload_from_env();
    clear_route_state_for_tests();

    let low_quota = low_quota_ids(&["acc-b"]);

    let mut first = candidate_list();
    apply_route_strategy_with_low_quota_fallback(
        &mut first,
        "gk_1",
        Some("gpt-5.3-codex"),
        &low_quota,
    );
    assert_eq!(
        account_ids(&first),
        vec![
            "acc-a".to_string(),
            "acc-c".to_string(),
            "acc-b".to_string()
        ]
    );

    let mut second = candidate_list();
    apply_route_strategy_with_low_quota_fallback(
        &mut second,
        "gk_1",
        Some("gpt-5.3-codex"),
        &low_quota,
    );
    assert_eq!(
        account_ids(&second),
        vec![
            "acc-c".to_string(),
            "acc-a".to_string(),
            "acc-b".to_string()
        ]
    );

    if let Some(value) = previous {
        std::env::set_var(ROUTE_STRATEGY_ENV, value);
    } else {
        std::env::remove_var(ROUTE_STRATEGY_ENV);
    }
    reload_from_env();
}

#[test]
fn balanced_round_robin_all_low_quota_candidates_still_rotate() {
    let _guard = route_strategy_test_guard();
    let previous = std::env::var(ROUTE_STRATEGY_ENV).ok();
    std::env::set_var(ROUTE_STRATEGY_ENV, "balanced");
    reload_from_env();
    clear_route_state_for_tests();

    let low_quota = low_quota_ids(&["acc-a", "acc-b", "acc-c"]);

    let mut first = candidate_list();
    apply_route_strategy_with_low_quota_fallback(
        &mut first,
        "gk-low-all",
        Some("gpt-5.3-codex"),
        &low_quota,
    );
    assert_eq!(account_ids(&first)[0], "acc-a");

    let mut second = candidate_list();
    apply_route_strategy_with_low_quota_fallback(
        &mut second,
        "gk-low-all",
        Some("gpt-5.3-codex"),
        &low_quota,
    );
    assert_eq!(account_ids(&second)[0], "acc-b");

    if let Some(value) = previous {
        std::env::set_var(ROUTE_STRATEGY_ENV, value);
    } else {
        std::env::remove_var(ROUTE_STRATEGY_ENV);
    }
    reload_from_env();
}

#[test]
fn balanced_round_robin_preserves_manual_preferred_low_quota_candidate() {
    let _guard = route_strategy_test_guard();
    let previous = std::env::var(ROUTE_STRATEGY_ENV).ok();
    std::env::set_var(ROUTE_STRATEGY_ENV, "balanced");
    reload_from_env();
    clear_route_state_for_tests();
    set_manual_preferred_account("acc-b").expect("set manual preferred");

    let low_quota = low_quota_ids(&["acc-b"]);
    let mut candidates = candidate_list();
    apply_route_strategy_with_low_quota_fallback(
        &mut candidates,
        "gk-manual-low",
        Some("gpt-5.3-codex"),
        &low_quota,
    );

    assert_eq!(account_ids(&candidates)[0], "acc-b");

    if let Some(value) = previous {
        std::env::set_var(ROUTE_STRATEGY_ENV, value);
    } else {
        std::env::remove_var(ROUTE_STRATEGY_ENV);
    }
    reload_from_env();
}

#[test]
fn set_route_strategy_accepts_aliases_and_reports_canonical_name() {
    let _guard = route_strategy_test_guard();
    clear_route_state_for_tests();
    assert_eq!(
        set_route_strategy("ordered").expect("set ordered"),
        "ordered"
    );
    assert_eq!(
        set_route_strategy("round_robin").expect("set rr alias"),
        "balanced"
    );
    assert_eq!(current_route_strategy(), "balanced");
    assert!(set_route_strategy("unsupported").is_err());
}

#[test]
fn route_state_ttl_expires_per_key_state() {
    let _guard = route_strategy_test_guard();
    let prev_strategy = std::env::var(ROUTE_STRATEGY_ENV).ok();
    let prev_ttl = std::env::var(ROUTE_STATE_TTL_SECS_ENV).ok();
    let prev_cap = std::env::var(ROUTE_STATE_CAPACITY_ENV).ok();

    std::env::set_var(ROUTE_STRATEGY_ENV, "balanced");
    std::env::set_var(ROUTE_STATE_TTL_SECS_ENV, "1");
    std::env::set_var(ROUTE_STATE_CAPACITY_ENV, "100");
    reload_from_env();
    clear_route_state_for_tests();

    let key = key_model_key("gk_ttl", Some("m1"));
    let lock = ROUTE_STATE.get_or_init(|| Mutex::new(RouteRoundRobinState::default()));
    let now = Instant::now();
    {
        let mut state = lock.lock().expect("route state");
        state.next_start_by_key_model.insert(
            key.clone(),
            RouteStateEntry::new(2, now - Duration::from_secs(5)),
        );
        state.p2c_nonce_by_key_model.insert(
            key.clone(),
            RouteStateEntry::new(9, now - Duration::from_secs(5)),
        );
    }

    // 中文注释：过期后应视为“无状态”，从 0 开始轮询。
    assert_eq!(next_start_index("gk_ttl", Some("m1"), 3), 0);

    // 中文注释：nonce 过期后应重置；第一次调用后 value=1（从 0 自增）。
    let _ = p2c_challenger_index("gk_ttl", Some("m1"), 3);
    {
        let state = lock.lock().expect("route state");
        let entry = state
            .p2c_nonce_by_key_model
            .get(key.as_str())
            .expect("nonce entry");
        assert_eq!(entry.value, 1);
    }

    if let Some(value) = prev_strategy {
        std::env::set_var(ROUTE_STRATEGY_ENV, value);
    } else {
        std::env::remove_var(ROUTE_STRATEGY_ENV);
    }
    if let Some(value) = prev_ttl {
        std::env::set_var(ROUTE_STATE_TTL_SECS_ENV, value);
    } else {
        std::env::remove_var(ROUTE_STATE_TTL_SECS_ENV);
    }
    if let Some(value) = prev_cap {
        std::env::set_var(ROUTE_STATE_CAPACITY_ENV, value);
    } else {
        std::env::remove_var(ROUTE_STATE_CAPACITY_ENV);
    }
    reload_from_env();
}

#[test]
fn route_state_capacity_evicts_lru_and_keeps_maps_in_sync() {
    let _guard = route_strategy_test_guard();
    let prev_ttl = std::env::var(ROUTE_STATE_TTL_SECS_ENV).ok();
    let prev_cap = std::env::var(ROUTE_STATE_CAPACITY_ENV).ok();

    // 中文注释：禁用 TTL，单测只验证容量淘汰逻辑。
    std::env::set_var(ROUTE_STATE_TTL_SECS_ENV, "0");
    std::env::set_var(ROUTE_STATE_CAPACITY_ENV, "2");
    reload_from_env();
    clear_route_state_for_tests();

    let k1 = key_model_key("k1", None);
    let k2 = key_model_key("k2", None);
    let k3 = key_model_key("k3", None);

    let _ = next_start_index("k1", None, 3);
    let _ = next_start_index("k2", None, 3);

    // 中文注释：预填充另一张 map，用于验证“同 key 联动清理”。
    let lock = ROUTE_STATE.get_or_init(|| Mutex::new(RouteRoundRobinState::default()));
    {
        let mut state = lock.lock().expect("route state");
        let now = Instant::now();
        state
            .p2c_nonce_by_key_model
            .insert(k1.clone(), RouteStateEntry::new(0, now));
        state
            .p2c_nonce_by_key_model
            .insert(k2.clone(), RouteStateEntry::new(0, now));
    }

    let _ = next_start_index("k3", None, 3);

    {
        let state = lock.lock().expect("route state");
        assert_eq!(state.next_start_by_key_model.len(), 2);
        assert!(!state.next_start_by_key_model.contains_key(k1.as_str()));
        assert!(state.next_start_by_key_model.contains_key(k2.as_str()));
        assert!(state.next_start_by_key_model.contains_key(k3.as_str()));

        assert!(!state.p2c_nonce_by_key_model.contains_key(k1.as_str()));
    }

    if let Some(value) = prev_ttl {
        std::env::set_var(ROUTE_STATE_TTL_SECS_ENV, value);
    } else {
        std::env::remove_var(ROUTE_STATE_TTL_SECS_ENV);
    }
    if let Some(value) = prev_cap {
        std::env::set_var(ROUTE_STATE_CAPACITY_ENV, value);
    } else {
        std::env::remove_var(ROUTE_STATE_CAPACITY_ENV);
    }
    reload_from_env();
}

#[test]
fn health_p2c_promotes_healthier_candidate_in_ordered_mode() {
    let _guard = route_strategy_test_guard();
    let _quality_guard = super::super::route_quality::route_quality_test_guard();
    super::super::route_quality::clear_route_quality_for_tests();
    std::env::set_var(ROUTE_HEALTH_P2C_ENABLED_ENV, "1");
    // 中文注释：窗口=2 时挑战者固定为 index=1，确保测试稳定可复现。
    std::env::set_var(ROUTE_HEALTH_P2C_ORDERED_WINDOW_ENV, "2");
    std::env::set_var(ROUTE_STRATEGY_ENV, "ordered");
    reload_from_env();
    clear_route_state_for_tests();

    for _ in 0..4 {
        super::super::route_quality::record_route_quality("acc-a", 429);
        super::super::route_quality::record_route_quality("acc-b", 200);
    }

    let mut candidates = candidate_list();
    apply_route_strategy(&mut candidates, "gk-health-1", Some("gpt-5.3-codex"));
    assert_eq!(account_ids(&candidates)[0], "acc-b");

    std::env::remove_var(ROUTE_HEALTH_P2C_ENABLED_ENV);
    std::env::remove_var(ROUTE_HEALTH_P2C_ORDERED_WINDOW_ENV);
    std::env::remove_var(ROUTE_STRATEGY_ENV);
    reload_from_env();
}

#[test]
fn balanced_mode_keeps_strict_round_robin_by_default() {
    let _guard = route_strategy_test_guard();
    let _quality_guard = super::super::route_quality::route_quality_test_guard();
    let prev_strategy = std::env::var(ROUTE_STRATEGY_ENV).ok();
    let prev_p2c = std::env::var(ROUTE_HEALTH_P2C_ENABLED_ENV).ok();
    let prev_balanced_window = std::env::var(ROUTE_HEALTH_P2C_BALANCED_WINDOW_ENV).ok();

    std::env::set_var(ROUTE_HEALTH_P2C_ENABLED_ENV, "1");
    std::env::remove_var(ROUTE_HEALTH_P2C_BALANCED_WINDOW_ENV);
    std::env::set_var(ROUTE_STRATEGY_ENV, "balanced");
    reload_from_env();
    clear_route_state_for_tests();

    for _ in 0..4 {
        super::super::route_quality::record_route_quality("acc-a", 429);
        super::super::route_quality::record_route_quality("acc-b", 200);
    }

    let mut first = candidate_list();
    apply_route_strategy(&mut first, "gk-strict-default", Some("gpt-5.3-codex"));
    assert_eq!(account_ids(&first)[0], "acc-a");

    let mut second = candidate_list();
    apply_route_strategy(&mut second, "gk-strict-default", Some("gpt-5.3-codex"));
    assert_eq!(account_ids(&second)[0], "acc-b");

    if let Some(value) = prev_strategy {
        std::env::set_var(ROUTE_STRATEGY_ENV, value);
    } else {
        std::env::remove_var(ROUTE_STRATEGY_ENV);
    }
    if let Some(value) = prev_p2c {
        std::env::set_var(ROUTE_HEALTH_P2C_ENABLED_ENV, value);
    } else {
        std::env::remove_var(ROUTE_HEALTH_P2C_ENABLED_ENV);
    }
    if let Some(value) = prev_balanced_window {
        std::env::set_var(ROUTE_HEALTH_P2C_BALANCED_WINDOW_ENV, value);
    } else {
        std::env::remove_var(ROUTE_HEALTH_P2C_BALANCED_WINDOW_ENV);
    }
    reload_from_env();
}

#[test]
fn manual_preferred_account_is_preserved_when_current_candidates_do_not_include_it() {
    let _guard = route_strategy_test_guard();
    clear_route_state_for_tests();
    set_manual_preferred_account("acc-missing").expect("set manual preferred");

    let mut candidates = candidate_list();
    apply_route_strategy(&mut candidates, "gk-manual-missing", Some("gpt-5.3-codex"));

    assert_eq!(
        get_manual_preferred_account().as_deref(),
        Some("acc-missing")
    );
    assert_eq!(account_ids(&candidates)[0], "acc-a");
}
