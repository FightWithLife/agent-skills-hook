use super::{
    mark_usage_unreachable_if_needed, record_usage_refresh_failure, should_retry_with_refresh,
};
use crate::account_availability::Availability;
use crate::account_status::mark_account_unavailable_for_refresh_token_error;
use crate::usage_snapshot_store::apply_status_from_snapshot;
use codexmanager_core::storage::{now_ts, Account, Storage, UsageSnapshotRecord};
use std::time::{SystemTime, UNIX_EPOCH};

fn unique_id(prefix: &str) -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock")
        .as_nanos();
    format!("{prefix}-{nanos}")
}

#[test]
fn apply_status_missing_snapshot_keeps_account_status() {
    let storage = Storage::open_in_memory().expect("open");
    storage.init().expect("init");
    let account = Account {
        id: "acc-1".to_string(),
        label: "main".to_string(),
        issuer: "issuer".to_string(),
        chatgpt_account_id: None,
        workspace_id: None,
        group_name: None,
        sort: 0,
        status: "active".to_string(),
        created_at: now_ts(),
        updated_at: now_ts(),
    };
    storage.insert_account(&account).expect("insert");

    let record = UsageSnapshotRecord {
        account_id: "acc-1".to_string(),
        used_percent: None,
        window_minutes: Some(300),
        resets_at: None,
        secondary_used_percent: Some(10.0),
        secondary_window_minutes: Some(10080),
        secondary_resets_at: None,
        credits_json: None,
        captured_at: now_ts(),
    };

    let availability = apply_status_from_snapshot(&storage, &record);
    assert!(matches!(availability, Availability::Unavailable(_)));
    let loaded = storage
        .list_accounts()
        .expect("list")
        .into_iter()
        .find(|acc| acc.id == "acc-1")
        .expect("exists");
    assert_eq!(loaded.status, "active");
}

#[test]
fn apply_status_skips_db_and_event_when_status_unchanged() {
    let storage = Storage::open_in_memory().expect("open");
    storage.init().expect("init");
    let base_updated_at = now_ts() - 10;
    let account = Account {
        id: "acc-unchanged".to_string(),
        label: "main".to_string(),
        issuer: "issuer".to_string(),
        chatgpt_account_id: None,
        workspace_id: None,
        group_name: None,
        sort: 0,
        status: "inactive".to_string(),
        created_at: base_updated_at,
        updated_at: base_updated_at,
    };
    storage.insert_account(&account).expect("insert");

    let missing_primary = UsageSnapshotRecord {
        account_id: "acc-unchanged".to_string(),
        used_percent: None,
        window_minutes: Some(300),
        resets_at: None,
        secondary_used_percent: Some(10.0),
        secondary_window_minutes: Some(10080),
        secondary_resets_at: None,
        credits_json: None,
        captured_at: now_ts(),
    };

    let availability = apply_status_from_snapshot(&storage, &missing_primary);
    assert!(matches!(availability, Availability::Unavailable(_)));

    let unchanged_account = storage
        .find_account_by_id("acc-unchanged")
        .expect("find")
        .expect("exists");
    assert_eq!(unchanged_account.status, "inactive");
    assert_eq!(unchanged_account.updated_at, base_updated_at);
    assert_eq!(storage.event_count().expect("count events"), 0);

    let available = UsageSnapshotRecord {
        account_id: "acc-unchanged".to_string(),
        used_percent: Some(10.0),
        window_minutes: Some(300),
        resets_at: None,
        secondary_used_percent: Some(20.0),
        secondary_window_minutes: Some(10080),
        secondary_resets_at: None,
        credits_json: None,
        captured_at: now_ts(),
    };

    let availability = apply_status_from_snapshot(&storage, &available);
    assert!(matches!(availability, Availability::Available));
    let reactivated_account = storage
        .find_account_by_id("acc-unchanged")
        .expect("find")
        .expect("exists");
    assert_eq!(reactivated_account.status, "active");
    assert_eq!(storage.event_count().expect("count events"), 1);
}

#[test]
fn mark_usage_unreachable_only_marks_401_as_unavailable() {
    let storage = Storage::open_in_memory().expect("open");
    storage.init().expect("init");
    let account = Account {
        id: "acc-2".to_string(),
        label: "main".to_string(),
        issuer: "issuer".to_string(),
        chatgpt_account_id: None,
        workspace_id: None,
        group_name: None,
        sort: 0,
        status: "active".to_string(),
        created_at: now_ts(),
        updated_at: now_ts(),
    };
    storage.insert_account(&account).expect("insert");

    mark_usage_unreachable_if_needed(&storage, "acc-2", "network timeout");
    let still_active = storage
        .list_accounts()
        .expect("list")
        .into_iter()
        .find(|acc| acc.id == "acc-2")
        .expect("exists");
    assert_eq!(still_active.status, "active");

    mark_usage_unreachable_if_needed(
        &storage,
        "acc-2",
        "usage endpoint status 500 Internal Server Error",
    );
    let still_active_after_500 = storage
        .list_accounts()
        .expect("list")
        .into_iter()
        .find(|acc| acc.id == "acc-2")
        .expect("exists");
    assert_eq!(still_active_after_500.status, "active");

    mark_usage_unreachable_if_needed(&storage, "acc-2", "usage endpoint status 401 Unauthorized");
    let unavailable = storage
        .list_accounts()
        .expect("list")
        .into_iter()
        .find(|acc| acc.id == "acc-2")
        .expect("exists");
    assert_eq!(unavailable.status, "unavailable");
}

#[test]
fn mark_usage_unreachable_does_not_override_manual_disabled_status() {
    let storage = Storage::open_in_memory().expect("open");
    storage.init().expect("init");
    storage
        .insert_account(&Account {
            id: "acc-disabled".to_string(),
            label: "main".to_string(),
            issuer: "issuer".to_string(),
            chatgpt_account_id: None,
            workspace_id: None,
            group_name: None,
            sort: 0,
            status: "disabled".to_string(),
            created_at: now_ts(),
            updated_at: now_ts(),
        })
        .expect("insert");

    mark_usage_unreachable_if_needed(
        &storage,
        "acc-disabled",
        "usage endpoint status 401 Unauthorized",
    );
    let disabled = storage
        .find_account_by_id("acc-disabled")
        .expect("find")
        .expect("exists");
    assert_eq!(disabled.status, "disabled");
}

#[test]
fn apply_status_available_preserves_manual_disabled_status() {
    let storage = Storage::open_in_memory().expect("open");
    storage.init().expect("init");
    let base_updated_at = now_ts() - 10;
    storage
        .insert_account(&Account {
            id: "acc-disabled".to_string(),
            label: "main".to_string(),
            issuer: "issuer".to_string(),
            chatgpt_account_id: None,
            workspace_id: None,
            group_name: None,
            sort: 0,
            status: "disabled".to_string(),
            created_at: base_updated_at,
            updated_at: base_updated_at,
        })
        .expect("insert");

    let available = UsageSnapshotRecord {
        account_id: "acc-disabled".to_string(),
        used_percent: Some(10.0),
        window_minutes: Some(300),
        resets_at: None,
        secondary_used_percent: Some(20.0),
        secondary_window_minutes: Some(10080),
        secondary_resets_at: None,
        credits_json: None,
        captured_at: now_ts(),
    };

    let availability = apply_status_from_snapshot(&storage, &available);
    assert!(matches!(availability, Availability::Available));

    let account = storage
        .find_account_by_id("acc-disabled")
        .expect("find")
        .expect("exists");
    assert_eq!(account.status, "disabled");
    assert_eq!(account.updated_at, base_updated_at);
    assert_eq!(storage.event_count().expect("count events"), 0);
}

#[test]
fn refresh_token_auth_error_marks_account_unavailable() {
    let storage = Storage::open_in_memory().expect("open");
    storage.init().expect("init");
    let account = Account {
        id: "acc-refresh-auth".to_string(),
        label: "main".to_string(),
        issuer: "issuer".to_string(),
        chatgpt_account_id: None,
        workspace_id: None,
        group_name: None,
        sort: 0,
        status: "active".to_string(),
        created_at: now_ts(),
        updated_at: now_ts(),
    };
    storage.insert_account(&account).expect("insert");

    assert!(mark_account_unavailable_for_refresh_token_error(
        &storage,
        "acc-refresh-auth",
        "refresh token failed with status 401 Unauthorized"
    ));
    let unavailable = storage
        .find_account_by_id("acc-refresh-auth")
        .expect("find")
        .expect("exists");
    assert_eq!(unavailable.status, "unavailable");
}

#[test]
fn refresh_token_forbidden_without_invalid_grant_keeps_account_active() {
    let storage = Storage::open_in_memory().expect("open");
    storage.init().expect("init");
    let account = Account {
        id: "acc-refresh-forbidden".to_string(),
        label: "main".to_string(),
        issuer: "issuer".to_string(),
        chatgpt_account_id: None,
        workspace_id: None,
        group_name: None,
        sort: 0,
        status: "active".to_string(),
        created_at: now_ts(),
        updated_at: now_ts(),
    };
    storage.insert_account(&account).expect("insert");

    assert!(!mark_account_unavailable_for_refresh_token_error(
        &storage,
        "acc-refresh-forbidden",
        "refresh token failed with status 403 Forbidden"
    ));
    let active = storage
        .find_account_by_id("acc-refresh-forbidden")
        .expect("find")
        .expect("exists");
    assert_eq!(active.status, "active");
}

#[test]
fn refresh_token_invalid_grant_on_forbidden_keeps_account_active() {
    let storage = Storage::open_in_memory().expect("open");
    storage.init().expect("init");
    let account = Account {
        id: "acc-refresh-invalid-grant-403".to_string(),
        label: "main".to_string(),
        issuer: "issuer".to_string(),
        chatgpt_account_id: None,
        workspace_id: None,
        group_name: None,
        sort: 0,
        status: "active".to_string(),
        created_at: now_ts(),
        updated_at: now_ts(),
    };
    storage.insert_account(&account).expect("insert");

    assert!(!mark_account_unavailable_for_refresh_token_error(
        &storage,
        "acc-refresh-invalid-grant-403",
        "refresh token failed with status 403 Forbidden: {\"error\":\"invalid_grant\"}"
    ));
    let active = storage
        .find_account_by_id("acc-refresh-invalid-grant-403")
        .expect("find")
        .expect("exists");
    assert_eq!(active.status, "active");
}

#[test]
fn refresh_token_unknown_401_marks_account_unavailable() {
    let storage = Storage::open_in_memory().expect("open");
    storage.init().expect("init");
    let account = Account {
        id: "acc-refresh-unknown-401".to_string(),
        label: "main".to_string(),
        issuer: "issuer".to_string(),
        chatgpt_account_id: None,
        workspace_id: None,
        group_name: None,
        sort: 0,
        status: "active".to_string(),
        created_at: now_ts(),
        updated_at: now_ts(),
    };
    storage.insert_account(&account).expect("insert");

    assert!(mark_account_unavailable_for_refresh_token_error(
        &storage,
        "acc-refresh-unknown-401",
        "refresh token failed with status 401 Unauthorized: some_unknown_backend_code"
    ));
    let unavailable = storage
        .find_account_by_id("acc-refresh-unknown-401")
        .expect("find")
        .expect("exists");
    assert_eq!(unavailable.status, "unavailable");
}

#[test]
fn refresh_retry_filter_matches_auth_failures() {
    assert!(should_retry_with_refresh("usage endpoint status 401"));
    assert!(should_retry_with_refresh("usage endpoint status 403"));
    assert!(!should_retry_with_refresh("usage endpoint status 429"));
}

#[test]
fn usage_refresh_failure_events_are_throttled_by_error_class() {
    let storage = Storage::open_in_memory().expect("open");
    storage.init().expect("init");
    let account_id = unique_id("acc-throttle");

    record_usage_refresh_failure(
        &storage,
        &account_id,
        "usage endpoint status 500 Internal Server Error",
    );
    record_usage_refresh_failure(
        &storage,
        &account_id,
        "usage endpoint status 500 upstream overloaded",
    );
    assert_eq!(storage.event_count().expect("count events"), 1);

    record_usage_refresh_failure(
        &storage,
        &account_id,
        "usage endpoint status 503 Service Unavailable",
    );
    assert_eq!(storage.event_count().expect("count events"), 2);
}

#[test]
fn usage_refresh_failure_throttle_splits_401_reason_classes() {
    let storage = Storage::open_in_memory().expect("open");
    storage.init().expect("init");
    let account_id = unique_id("acc-throttle-401");

    record_usage_refresh_failure(
        &storage,
        &account_id,
        "refresh token failed with status 401 Unauthorized: Your access token could not be refreshed because your refresh token was revoked. Please log out and sign in again.",
    );
    record_usage_refresh_failure(
        &storage,
        &account_id,
        "refresh token failed with status 401 Unauthorized: Your access token could not be refreshed. Please log out and sign in again.",
    );

    assert_eq!(storage.event_count().expect("count events"), 2);
}
