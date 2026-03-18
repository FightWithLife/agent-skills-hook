use codexmanager_core::storage::{now_ts, Event, Storage};

pub(crate) fn set_account_status(storage: &Storage, account_id: &str, status: &str, reason: &str) {
    if matches!(
        storage.update_account_status_if_changed(account_id, status),
        Ok(true)
    ) {
        let _ = storage.insert_event(&Event {
            account_id: Some(account_id.to_string()),
            event_type: "account_status_update".to_string(),
            message: format!("status={status} reason={reason}"),
            created_at: now_ts(),
        });
    }
}

pub(crate) fn mark_account_unavailable_for_refresh_token_error(
    storage: &Storage,
    account_id: &str,
    err: &str,
) -> bool {
    let Some(reason) = crate::usage_http::refresh_token_auth_error_reason_from_message(err) else {
        return false;
    };
    let status_reason = format!("refresh_token_invalid:{}", reason.as_code());
    set_account_status(storage, account_id, "unavailable", &status_reason);
    true
}
