use codexmanager_core::auth::{extract_token_exp, DEFAULT_CLIENT_ID, DEFAULT_ISSUER};
use codexmanager_core::storage::{now_ts, Account, Storage, Token};
use codexmanager_core::usage::parse_usage_snapshot;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize};
use std::sync::OnceLock;
use std::thread;
use std::time::{Duration, Instant};

use crate::account_status::mark_account_unavailable_for_refresh_token_error;
use crate::storage_helpers::open_storage;
use crate::usage_account_meta::{
    build_workspace_map_from_accounts, clean_header_value, derive_account_meta, patch_account_meta,
    patch_account_meta_cached, workspace_header_for_account,
};
use crate::usage_http::fetch_usage_snapshot;
use crate::usage_keepalive::{is_keepalive_error_ignorable, run_gateway_keepalive_once};
use crate::usage_scheduler::{
    parse_interval_secs, DEFAULT_GATEWAY_KEEPALIVE_FAILURE_BACKOFF_MAX_SECS,
    DEFAULT_GATEWAY_KEEPALIVE_INTERVAL_SECS, DEFAULT_GATEWAY_KEEPALIVE_JITTER_SECS,
    DEFAULT_USAGE_POLL_FAILURE_BACKOFF_MAX_SECS, DEFAULT_USAGE_POLL_INTERVAL_SECS,
    DEFAULT_USAGE_POLL_JITTER_SECS, MIN_GATEWAY_KEEPALIVE_INTERVAL_SECS,
    MIN_USAGE_POLL_INTERVAL_SECS,
};
use crate::usage_snapshot_store::store_usage_snapshot;
use crate::usage_token_refresh::refresh_and_persist_access_token;

mod batch;
mod errors;
mod queue;
mod runner;
mod settings;

static USAGE_POLLING_STARTED: OnceLock<()> = OnceLock::new();
static GATEWAY_KEEPALIVE_STARTED: OnceLock<()> = OnceLock::new();
static TOKEN_REFRESH_POLLING_STARTED: OnceLock<()> = OnceLock::new();
static BACKGROUND_TASKS_CONFIG_LOADED: OnceLock<()> = OnceLock::new();
static USAGE_POLL_CURSOR: AtomicUsize = AtomicUsize::new(0);
static USAGE_POLLING_ENABLED: AtomicBool = AtomicBool::new(true);
static USAGE_POLL_INTERVAL_SECS: AtomicU64 = AtomicU64::new(DEFAULT_USAGE_POLL_INTERVAL_SECS);
static GATEWAY_KEEPALIVE_ENABLED: AtomicBool = AtomicBool::new(true);
static GATEWAY_KEEPALIVE_INTERVAL_SECS: AtomicU64 =
    AtomicU64::new(DEFAULT_GATEWAY_KEEPALIVE_INTERVAL_SECS);
static TOKEN_REFRESH_POLLING_ENABLED: AtomicBool = AtomicBool::new(true);
static TOKEN_REFRESH_POLL_INTERVAL_SECS_ATOMIC: AtomicU64 =
    AtomicU64::new(DEFAULT_TOKEN_REFRESH_POLL_INTERVAL_SECS);
static USAGE_REFRESH_WORKERS: AtomicUsize = AtomicUsize::new(DEFAULT_USAGE_REFRESH_WORKERS);
static HTTP_WORKER_FACTOR: AtomicUsize = AtomicUsize::new(DEFAULT_HTTP_WORKER_FACTOR);
static HTTP_WORKER_MIN: AtomicUsize = AtomicUsize::new(DEFAULT_HTTP_WORKER_MIN);
static HTTP_STREAM_WORKER_FACTOR: AtomicUsize = AtomicUsize::new(DEFAULT_HTTP_STREAM_WORKER_FACTOR);
static HTTP_STREAM_WORKER_MIN: AtomicUsize = AtomicUsize::new(DEFAULT_HTTP_STREAM_WORKER_MIN);
/// @brief balanced 轮询时是否排除低配额账号参与正常轮转
static EXCLUDE_LOW_QUOTA_FROM_BALANCED_ROUTING: AtomicBool = AtomicBool::new(true);

const ENV_DISABLE_POLLING: &str = "CODEXMANAGER_DISABLE_POLLING";
const ENV_USAGE_POLLING_ENABLED: &str = "CODEXMANAGER_USAGE_POLLING_ENABLED";
const ENV_USAGE_POLL_INTERVAL_SECS: &str = "CODEXMANAGER_USAGE_POLL_INTERVAL_SECS";
const ENV_USAGE_POLL_BATCH_LIMIT: &str = "CODEXMANAGER_USAGE_POLL_BATCH_LIMIT";
const ENV_USAGE_POLL_CYCLE_BUDGET_SECS: &str = "CODEXMANAGER_USAGE_POLL_CYCLE_BUDGET_SECS";
const ENV_GATEWAY_KEEPALIVE_ENABLED: &str = "CODEXMANAGER_GATEWAY_KEEPALIVE_ENABLED";
const ENV_GATEWAY_KEEPALIVE_INTERVAL_SECS: &str = "CODEXMANAGER_GATEWAY_KEEPALIVE_INTERVAL_SECS";
const ENV_TOKEN_REFRESH_POLLING_ENABLED: &str = "CODEXMANAGER_TOKEN_REFRESH_POLLING_ENABLED";
const ENV_TOKEN_REFRESH_POLL_INTERVAL_SECS: &str = "CODEXMANAGER_TOKEN_REFRESH_POLL_INTERVAL_SECS";
const COMMON_POLL_JITTER_ENV: &str = "CODEXMANAGER_POLL_JITTER_SECS";
const COMMON_POLL_FAILURE_BACKOFF_MAX_ENV: &str = "CODEXMANAGER_POLL_FAILURE_BACKOFF_MAX_SECS";
const USAGE_POLL_JITTER_ENV: &str = "CODEXMANAGER_USAGE_POLL_JITTER_SECS";
const USAGE_POLL_FAILURE_BACKOFF_MAX_ENV: &str = "CODEXMANAGER_USAGE_POLL_FAILURE_BACKOFF_MAX_SECS";
const USAGE_REFRESH_WORKERS_ENV: &str = "CODEXMANAGER_USAGE_REFRESH_WORKERS";
const DEFAULT_USAGE_POLL_BATCH_LIMIT: usize = 100;
const DEFAULT_USAGE_POLL_CYCLE_BUDGET_SECS: u64 = 30;
const DEFAULT_USAGE_REFRESH_WORKERS: usize = 4;
const DEFAULT_HTTP_WORKER_FACTOR: usize = 4;
const DEFAULT_HTTP_WORKER_MIN: usize = 8;
const DEFAULT_HTTP_STREAM_WORKER_FACTOR: usize = 1;
const DEFAULT_HTTP_STREAM_WORKER_MIN: usize = 2;
const ENV_HTTP_WORKER_FACTOR: &str = "CODEXMANAGER_HTTP_WORKER_FACTOR";
const ENV_HTTP_WORKER_MIN: &str = "CODEXMANAGER_HTTP_WORKER_MIN";
const ENV_HTTP_STREAM_WORKER_FACTOR: &str = "CODEXMANAGER_HTTP_STREAM_WORKER_FACTOR";
const ENV_HTTP_STREAM_WORKER_MIN: &str = "CODEXMANAGER_HTTP_STREAM_WORKER_MIN";
const GATEWAY_KEEPALIVE_JITTER_ENV: &str = "CODEXMANAGER_GATEWAY_KEEPALIVE_JITTER_SECS";
const GATEWAY_KEEPALIVE_FAILURE_BACKOFF_MAX_ENV: &str =
    "CODEXMANAGER_GATEWAY_KEEPALIVE_FAILURE_BACKOFF_MAX_SECS";
const DEFAULT_TOKEN_REFRESH_POLL_INTERVAL_SECS: u64 = 60;
const MIN_TOKEN_REFRESH_POLL_INTERVAL_SECS: u64 = 10;
const TOKEN_REFRESH_FAILURE_BACKOFF_MAX_SECS: u64 = 300;
const TOKEN_REFRESH_AHEAD_SECS: i64 = 600;
const TOKEN_REFRESH_FALLBACK_AGE_SECS: i64 = 2700;
const TOKEN_REFRESH_BATCH_LIMIT: usize = 256;
const BACKGROUND_TASK_RESTART_REQUIRED_KEYS: [&str; 5] = [
    "usageRefreshWorkers",
    "httpWorkerFactor",
    "httpWorkerMin",
    "httpStreamWorkerFactor",
    "httpStreamWorkerMin",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum UsageAvailabilityStatus {
    Available,
    PrimaryWindowAvailableOnly,
    Unavailable,
    Unknown,
}

impl UsageAvailabilityStatus {
    fn as_code(self) -> &'static str {
        match self {
            Self::Available => "available",
            Self::PrimaryWindowAvailableOnly => "primary_window_available_only",
            Self::Unavailable => "unavailable",
            Self::Unknown => "unknown",
        }
    }
}

#[derive(Debug, Clone, Copy)]
struct UsageRefreshResult {
    _status: UsageAvailabilityStatus,
}

pub(crate) use self::batch::refresh_usage_for_all_accounts;
use self::batch::refresh_usage_for_polling_batch;
#[cfg(test)]
use self::batch::{next_usage_poll_cursor, usage_poll_batch_indices};
use self::errors::{
    mark_usage_unreachable_if_needed, record_usage_refresh_failure, should_retry_with_refresh,
};
#[cfg(test)]
use self::queue::clear_pending_usage_refresh_tasks_for_tests;
pub(crate) use self::queue::enqueue_usage_refresh_with_worker;
use self::runner::{gateway_keepalive_loop, token_refresh_polling_loop, usage_polling_loop};
use self::settings::ensure_background_tasks_config_loaded;
pub(crate) use self::settings::{
    background_tasks_settings, reload_background_tasks_runtime_from_env,
    set_background_tasks_settings, BackgroundTasksSettingsPatch,
};
pub(crate) use self::settings::exclude_low_quota_from_balanced_routing;

pub(crate) fn ensure_usage_polling() {
    ensure_background_tasks_config_loaded();
    USAGE_POLLING_STARTED.get_or_init(|| {
        spawn_background_loop("usage-polling", usage_polling_loop);
    });
}

pub(crate) fn ensure_gateway_keepalive() {
    ensure_background_tasks_config_loaded();
    GATEWAY_KEEPALIVE_STARTED.get_or_init(|| {
        spawn_background_loop("gateway-keepalive", gateway_keepalive_loop);
    });
}

pub(crate) fn ensure_token_refresh_polling() {
    ensure_background_tasks_config_loaded();
    TOKEN_REFRESH_POLLING_STARTED.get_or_init(|| {
        spawn_background_loop("token-refresh-polling", token_refresh_polling_loop);
    });
}

fn spawn_background_loop(name: &str, worker: fn()) {
    let thread_name = name.to_string();
    let _ = thread::Builder::new()
        .name(thread_name.clone())
        .spawn(move || loop {
            let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(worker));
            if result.is_ok() {
                break;
            }
            log::error!(
                "background task panicked and will restart: task={}",
                thread_name
            );
            thread::sleep(Duration::from_secs(1));
        });
}

pub(crate) fn enqueue_usage_refresh_for_account(account_id: &str) -> bool {
    enqueue_usage_refresh_with_worker(account_id, |id| {
        if let Err(err) = refresh_usage_for_account(&id) {
            let status = classify_usage_status_from_error(&err);
            log::warn!(
                "async usage refresh failed: account_id={} status={} err={}",
                id,
                status.as_code(),
                err
            );
        }
    })
}

#[cfg(test)]
fn reset_usage_poll_cursor_for_tests() {
    USAGE_POLL_CURSOR.store(0, std::sync::atomic::Ordering::Relaxed);
}

pub(crate) fn refresh_tokens_before_expiry_for_all_accounts() -> Result<(), String> {
    let storage = open_storage().ok_or_else(|| "storage unavailable".to_string())?;
    let now = now_ts();
    let mut tokens = storage
        .list_tokens_due_for_refresh(now, TOKEN_REFRESH_BATCH_LIMIT)
        .map_err(|e| e.to_string())?;
    if tokens.is_empty() {
        return Ok(());
    }

    let issuer =
        std::env::var("CODEXMANAGER_ISSUER").unwrap_or_else(|_| DEFAULT_ISSUER.to_string());
    let client_id =
        std::env::var("CODEXMANAGER_CLIENT_ID").unwrap_or_else(|_| DEFAULT_CLIENT_ID.to_string());
    let mut refreshed = 0usize;
    let mut skipped = 0usize;

    for token in tokens.iter_mut() {
        let _ = storage.touch_token_refresh_attempt(&token.account_id, now);
        let (exp_opt, scheduled_at) = token_refresh_schedule(
            token,
            now,
            TOKEN_REFRESH_AHEAD_SECS,
            TOKEN_REFRESH_FALLBACK_AGE_SECS,
        );
        let _ =
            storage.update_token_refresh_schedule(&token.account_id, exp_opt, Some(scheduled_at));
        if scheduled_at > now {
            skipped = skipped.saturating_add(1);
            continue;
        }
        match refresh_and_persist_access_token(&storage, token, &issuer, &client_id) {
            Ok(_) => {
                refreshed = refreshed.saturating_add(1);
            }
            Err(err) => {
                let _ = mark_account_unavailable_for_refresh_token_error(
                    &storage,
                    &token.account_id,
                    &err,
                );
                log::warn!(
                    "token refresh polling failed: account_id={} err={}",
                    token.account_id,
                    err
                );
            }
        }
    }

    let _ = (refreshed, skipped);
    Ok(())
}

pub(crate) fn refresh_usage_for_account(account_id: &str) -> Result<(), String> {
    // 刷新单个账号用量
    let storage = open_storage().ok_or_else(|| "storage unavailable".to_string())?;
    let token = match storage
        .find_token_by_account_id(account_id)
        .map_err(|e| e.to_string())?
    {
        Some(token) => token,
        None => return Ok(()),
    };

    let account = storage
        .find_account_by_id(account_id)
        .map_err(|e| e.to_string())?;
    let workspace_id = account.as_ref().and_then(workspace_header_for_account);
    let mut account_map = account
        .map(|value| {
            let mut map = HashMap::new();
            map.insert(value.id.clone(), value);
            map
        })
        .unwrap_or_default();

    let started_at = Instant::now();
    let account_cache = if account_map.is_empty() {
        None
    } else {
        Some(&mut account_map)
    };
    match refresh_usage_for_token(&storage, &token, workspace_id.as_deref(), account_cache) {
        Ok(_) => {}
        Err(err) => {
            record_usage_refresh_metrics(false, started_at);
            record_usage_refresh_failure(&storage, &token.account_id, &err);
            return Err(err);
        }
    }
    record_usage_refresh_metrics(true, started_at);
    Ok(())
}

fn record_usage_refresh_metrics(success: bool, started_at: Instant) {
    crate::gateway::record_usage_refresh_outcome(
        success,
        crate::gateway::duration_to_millis(started_at.elapsed()),
    );
}

fn refresh_usage_for_token(
    storage: &Storage,
    token: &Token,
    workspace_id: Option<&str>,
    account_cache: Option<&mut HashMap<String, Account>>,
) -> Result<UsageRefreshResult, String> {
    // 读取用量接口所需的基础配置
    let issuer =
        std::env::var("CODEXMANAGER_ISSUER").unwrap_or_else(|_| DEFAULT_ISSUER.to_string());
    let client_id =
        std::env::var("CODEXMANAGER_CLIENT_ID").unwrap_or_else(|_| DEFAULT_CLIENT_ID.to_string());
    let base_url = std::env::var("CODEXMANAGER_USAGE_BASE_URL")
        .unwrap_or_else(|_| "https://chatgpt.com".to_string());

    let mut current = token.clone();
    let mut resolved_workspace_id = workspace_id.map(|v| v.to_string());
    let (derived_chatgpt_id, derived_workspace_id) = derive_account_meta(&current);

    if resolved_workspace_id.is_none() {
        resolved_workspace_id = derived_workspace_id
            .clone()
            .or_else(|| derived_chatgpt_id.clone());
    }

    if let Some(accounts) = account_cache {
        patch_account_meta_cached(
            storage,
            accounts,
            &current.account_id,
            derived_chatgpt_id,
            derived_workspace_id,
        );
    } else {
        patch_account_meta(
            storage,
            &current.account_id,
            derived_chatgpt_id,
            derived_workspace_id,
        );
    }

    let resolved_workspace_id = clean_header_value(resolved_workspace_id);
    let bearer = current.access_token.clone();

    match fetch_usage_snapshot(&base_url, &bearer, resolved_workspace_id.as_deref()) {
        Ok(value) => {
            let status = classify_usage_status_from_snapshot_value(&value);
            store_usage_snapshot(storage, &current.account_id, value)?;
            Ok(UsageRefreshResult { _status: status })
        }
        Err(err) if should_retry_with_refresh(&err) => {
            // 中文注释：token 刷新与持久化独立封装，避免轮询流程继续膨胀；
            // 不下沉会让后续 async 迁移时刷新链路与业务编排强耦合，回归范围扩大。
            if let Err(refresh_err) =
                refresh_and_persist_access_token(storage, &mut current, &issuer, &client_id)
            {
                mark_usage_unreachable_if_needed(storage, &current.account_id, &refresh_err);
                return Err(refresh_err);
            }
            let bearer = current.access_token.clone();
            match fetch_usage_snapshot(&base_url, &bearer, resolved_workspace_id.as_deref()) {
                Ok(value) => {
                    let status = classify_usage_status_from_snapshot_value(&value);
                    store_usage_snapshot(storage, &current.account_id, value)?;
                    Ok(UsageRefreshResult { _status: status })
                }
                Err(err) => {
                    mark_usage_unreachable_if_needed(storage, &current.account_id, &err);
                    Err(err)
                }
            }
        }
        Err(err) => {
            mark_usage_unreachable_if_needed(storage, &current.account_id, &err);
            Err(err)
        }
    }
}

#[cfg(test)]
#[path = "../../../tests/usage/usage_refresh_status_tests.rs"]
mod status_tests;

#[cfg(test)]
#[path = "../tests/usage_refresh_tests.rs"]
mod tests;

fn classify_usage_status_from_snapshot_value(value: &serde_json::Value) -> UsageAvailabilityStatus {
    let parsed = parse_usage_snapshot(value);

    let primary_present = parsed.used_percent.is_some() && parsed.window_minutes.is_some();
    if !primary_present {
        return UsageAvailabilityStatus::Unknown;
    }

    if parsed.used_percent.map(|v| v >= 100.0).unwrap_or(false) {
        return UsageAvailabilityStatus::Unavailable;
    }

    let secondary_used = parsed.secondary_used_percent;
    let secondary_window = parsed.secondary_window_minutes;
    let secondary_present = secondary_used.is_some() || secondary_window.is_some();
    let secondary_complete = secondary_used.is_some() && secondary_window.is_some();

    if !secondary_present {
        return UsageAvailabilityStatus::PrimaryWindowAvailableOnly;
    }
    if !secondary_complete {
        return UsageAvailabilityStatus::Unknown;
    }
    if secondary_used.map(|v| v >= 100.0).unwrap_or(false) {
        return UsageAvailabilityStatus::Unavailable;
    }
    UsageAvailabilityStatus::Available
}

fn classify_usage_status_from_error(err: &str) -> UsageAvailabilityStatus {
    if err.starts_with("usage endpoint status ") {
        return UsageAvailabilityStatus::Unavailable;
    }
    UsageAvailabilityStatus::Unknown
}

fn token_refresh_schedule(
    token: &Token,
    now_ts_secs: i64,
    ahead_secs: i64,
    fallback_age_secs: i64,
) -> (Option<i64>, i64) {
    if token.refresh_token.trim().is_empty() {
        return (None, i64::MAX);
    }
    if let Some(exp) = extract_token_exp(&token.access_token) {
        return (Some(exp), exp.saturating_sub(ahead_secs));
    }
    (
        None,
        token
            .last_refresh
            .saturating_add(fallback_age_secs)
            .max(now_ts_secs),
    )
}
