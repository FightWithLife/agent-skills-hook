use codexmanager_core::auth::{
    extract_chatgpt_account_id, extract_workspace_id, parse_id_token_claims, DEFAULT_CLIENT_ID,
    DEFAULT_ISSUER,
};
use codexmanager_core::storage::{now_ts, Account, Storage, Token};
use serde::Serialize;

use crate::account_identity::{
    build_account_storage_id, build_fallback_subject_key, clean_value,
    pick_existing_account_id_by_identity,
};
use crate::account_status::mark_account_unavailable_for_refresh_token_error;
use crate::app_settings::{get_persisted_app_setting, save_persisted_app_setting};
use crate::gateway::clear_manual_preferred_account_if;
use crate::storage_helpers::open_storage;
use crate::usage_token_refresh::refresh_and_persist_access_token;

const CURRENT_AUTH_ACCOUNT_ID_KEY: &str = "auth.current_account_id";
const CURRENT_AUTH_MODE_KEY: &str = "auth.current_auth_mode";
const AUTH_MODE_CHATGPT: &str = "chatgpt";
const AUTH_MODE_CHATGPT_AUTH_TOKENS: &str = "chatgptAuthTokens";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AccountReadResponse {
    pub(crate) account: Option<CurrentAuthAccount>,
    pub(crate) auth_mode: Option<String>,
    pub(crate) requires_openai_auth: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CurrentAuthAccount {
    #[serde(rename = "type")]
    pub(crate) kind: String,
    pub(crate) account_id: String,
    pub(crate) email: String,
    pub(crate) plan_type: String,
    pub(crate) plan_type_raw: Option<String>,
    pub(crate) chatgpt_account_id: Option<String>,
    pub(crate) workspace_id: Option<String>,
    pub(crate) status: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ChatgptAuthTokensRefreshResponse {
    pub(crate) account_id: String,
    pub(crate) access_token: String,
    pub(crate) chatgpt_account_id: String,
    pub(crate) chatgpt_plan_type: Option<String>,
    pub(crate) chatgpt_plan_type_raw: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ChatgptAuthTokensLoginResponse {
    #[serde(rename = "type")]
    pub(crate) kind: String,
    pub(crate) account_id: String,
    pub(crate) chatgpt_account_id: String,
    pub(crate) workspace_id: String,
}

#[derive(Debug, Clone)]
pub(crate) struct ChatgptAuthTokensLoginInput {
    pub(crate) access_token: String,
    pub(crate) refresh_token: Option<String>,
    pub(crate) id_token: Option<String>,
    pub(crate) chatgpt_account_id: Option<String>,
    pub(crate) workspace_id: Option<String>,
    pub(crate) chatgpt_plan_type: Option<String>,
}

pub(crate) fn login_with_chatgpt_auth_tokens(
    input: ChatgptAuthTokensLoginInput,
) -> Result<ChatgptAuthTokensLoginResponse, String> {
    let storage = open_storage().ok_or_else(|| "storage unavailable".to_string())?;
    let access_token = input.access_token.trim();
    if access_token.is_empty() {
        return Err("accessToken is required".to_string());
    }
    let _requested_plan_type = input
        .chatgpt_plan_type
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());

    let claims = parse_id_token_claims(access_token)
        .map_err(|err| format!("invalid access token jwt: {err}"))?;
    let subject_account_id = claims.sub.trim();
    if subject_account_id.is_empty() {
        return Err("access token missing subject".to_string());
    }

    let chatgpt_account_id = clean_value(
        input
            .chatgpt_account_id
            .or_else(|| extract_chatgpt_account_id(access_token))
            .or_else(|| {
                claims
                    .auth
                    .as_ref()
                    .and_then(|auth| auth.chatgpt_account_id.clone())
            }),
    );
    let workspace_id = clean_value(
        input
            .workspace_id
            .or_else(|| extract_workspace_id(access_token))
            .or_else(|| claims.workspace_id.clone())
            .or_else(|| chatgpt_account_id.clone()),
    );
    let resolved_scope_id = workspace_id
        .clone()
        .or_else(|| chatgpt_account_id.clone())
        .ok_or_else(|| "chatgptAccountId/workspaceId is required".to_string())?;

    let fallback_subject_key = build_fallback_subject_key(Some(subject_account_id), None);
    let account_storage_id = build_account_storage_id(
        subject_account_id,
        chatgpt_account_id.as_deref(),
        workspace_id.as_deref(),
        None,
    );
    let accounts = storage.list_accounts().map_err(|err| err.to_string())?;
    let account_id = pick_existing_account_id_by_identity(
        accounts.iter(),
        chatgpt_account_id.as_deref(),
        workspace_id.as_deref(),
        fallback_subject_key.as_deref(),
        None,
    )
    .unwrap_or(account_storage_id);

    let existing_account = storage
        .find_account_by_id(&account_id)
        .map_err(|err| err.to_string())?;
    let now = now_ts();
    let account = Account {
        id: account_id.clone(),
        label: claims
            .email
            .clone()
            .unwrap_or_else(|| resolved_scope_id.clone()),
        issuer: std::env::var("CODEXMANAGER_ISSUER").unwrap_or_else(|_| DEFAULT_ISSUER.to_string()),
        chatgpt_account_id: chatgpt_account_id.clone(),
        workspace_id: workspace_id.clone(),
        group_name: existing_account
            .as_ref()
            .and_then(|account| account.group_name.clone()),
        sort: existing_account
            .as_ref()
            .map(|account| account.sort)
            .unwrap_or_else(|| super::tokens::next_account_sort(&storage)),
        status: "active".to_string(),
        created_at: existing_account
            .as_ref()
            .map(|account| account.created_at)
            .unwrap_or(now),
        updated_at: now,
    };
    storage
        .insert_account(&account)
        .map_err(|err| err.to_string())?;

    let mut token = Token {
        account_id: account_id.clone(),
        id_token: input.id_token.unwrap_or_default(),
        access_token: access_token.to_string(),
        refresh_token: input.refresh_token.unwrap_or_default(),
        api_key_access_token: None,
        last_refresh: now,
    };
    if token.id_token.trim().is_empty() {
        token.id_token = token.access_token.clone();
    }
    storage
        .insert_token(&token)
        .map_err(|err| err.to_string())?;

    set_current_auth_account_id(Some(&account_id))?;
    set_current_auth_mode(Some(AUTH_MODE_CHATGPT_AUTH_TOKENS))?;
    let _ = crate::gateway::set_manual_preferred_account(&account_id);

    Ok(ChatgptAuthTokensLoginResponse {
        kind: "chatgptAuthTokens".to_string(),
        account_id,
        chatgpt_account_id: chatgpt_account_id.unwrap_or_else(|| resolved_scope_id.clone()),
        workspace_id: resolved_scope_id,
    })
}

pub(crate) fn read_current_account(refresh_token: bool) -> Result<AccountReadResponse, String> {
    let Some(storage) = open_storage() else {
        return Ok(AccountReadResponse {
            account: None,
            auth_mode: None,
            requires_openai_auth: true,
        });
    };
    let Some((account, token)) = resolve_current_account_with_token(&storage)? else {
        return Ok(AccountReadResponse {
            account: None,
            auth_mode: None,
            requires_openai_auth: true,
        });
    };

    let mut token = token;
    if refresh_token && !token.refresh_token.trim().is_empty() {
        let issuer =
            std::env::var("CODEXMANAGER_ISSUER").unwrap_or_else(|_| DEFAULT_ISSUER.to_string());
        let client_id = std::env::var("CODEXMANAGER_CLIENT_ID")
            .unwrap_or_else(|_| DEFAULT_CLIENT_ID.to_string());
        if let Err(err) =
            refresh_and_persist_access_token(&storage, &mut token, &issuer, &client_id)
        {
            let _ = mark_account_unavailable_for_refresh_token_error(&storage, &account.id, &err);
            return Err(err);
        }
    }

    let auth_mode = resolve_current_auth_mode(&token);
    Ok(AccountReadResponse {
        account: Some(current_account_payload(
            &account,
            &token,
            auth_mode.as_str(),
        )),
        auth_mode: Some(auth_mode),
        requires_openai_auth: true,
    })
}

pub(crate) fn refresh_current_chatgpt_auth_tokens(
    previous_account_id: Option<&str>,
) -> Result<ChatgptAuthTokensRefreshResponse, String> {
    let storage = open_storage().ok_or_else(|| "storage unavailable".to_string())?;
    let (account, mut token) = resolve_refresh_target(&storage, previous_account_id)?
        .ok_or_else(|| "no current chatgptAuthTokens account".to_string())?;
    if token.refresh_token.trim().is_empty() {
        return Err("current account does not have refresh_token".to_string());
    }

    let issuer =
        std::env::var("CODEXMANAGER_ISSUER").unwrap_or_else(|_| DEFAULT_ISSUER.to_string());
    let client_id =
        std::env::var("CODEXMANAGER_CLIENT_ID").unwrap_or_else(|_| DEFAULT_CLIENT_ID.to_string());
    if let Err(err) = refresh_and_persist_access_token(&storage, &mut token, &issuer, &client_id) {
        let _ = mark_account_unavailable_for_refresh_token_error(&storage, &account.id, &err);
        return Err(err);
    }

    let refreshed_account = storage
        .find_account_by_id(&account.id)
        .map_err(|err| err.to_string())?
        .unwrap_or(account);
    let chatgpt_account_id = refreshed_account
        .chatgpt_account_id
        .clone()
        .or_else(|| refreshed_account.workspace_id.clone())
        .or_else(|| extract_chatgpt_account_id(&token.access_token))
        .or_else(|| extract_workspace_id(&token.access_token))
        .ok_or_else(|| "refreshed token missing chatgptAccountId".to_string())?;
    let access_claims = parse_id_token_claims(&token.access_token).ok();
    let plan_type_resolution = resolve_plan_type_resolution(&token, access_claims.as_ref());

    Ok(ChatgptAuthTokensRefreshResponse {
        account_id: refreshed_account.id,
        access_token: token.access_token,
        chatgpt_account_id,
        chatgpt_plan_type: plan_type_resolution
            .as_ref()
            .map(|plan| plan.normalized.clone()),
        chatgpt_plan_type_raw: plan_type_resolution.and_then(|plan| plan.raw),
    })
}

pub(crate) fn logout_current_account() -> Result<serde_json::Value, String> {
    let storage = open_storage().ok_or_else(|| "storage unavailable".to_string())?;
    let current_account_id = get_persisted_app_setting(CURRENT_AUTH_ACCOUNT_ID_KEY);
    if let Some(account_id) = current_account_id.as_deref() {
        let _ = clear_manual_preferred_account_if(account_id);
        if storage
            .find_account_by_id(account_id)
            .map_err(|err| err.to_string())?
            .is_some()
        {
            storage
                .update_account_status(account_id, "inactive")
                .map_err(|err| format!("update account status failed: {err}"))?;
        }
    }
    set_current_auth_account_id(None)?;
    set_current_auth_mode(None)?;
    Ok(serde_json::json!({
        "ok": true,
        "accountId": current_account_id,
    }))
}

fn resolve_current_account_with_token(
    storage: &Storage,
) -> Result<Option<(Account, Token)>, String> {
    let Some(account_id) = get_persisted_app_setting(CURRENT_AUTH_ACCOUNT_ID_KEY) else {
        return Ok(None);
    };
    let account = storage
        .find_account_by_id(&account_id)
        .map_err(|err| err.to_string())?;
    let token = storage
        .find_token_by_account_id(&account_id)
        .map_err(|err| err.to_string())?;
    match (account, token) {
        (Some(account), Some(token)) => Ok(Some((account, token))),
        _ => {
            set_current_auth_account_id(None)?;
            set_current_auth_mode(None)?;
            let _ = clear_manual_preferred_account_if(&account_id);
            Ok(None)
        }
    }
}

fn resolve_refresh_target(
    storage: &Storage,
    previous_account_id: Option<&str>,
) -> Result<Option<(Account, Token)>, String> {
    if let Some((account, token)) = resolve_current_account_with_token(storage)? {
        return Ok(Some((account, token)));
    }
    let Some(previous_account_id) = previous_account_id
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return Ok(None);
    };

    let accounts = storage.list_accounts().map_err(|err| err.to_string())?;
    let found = accounts.into_iter().find(|account| {
        account.id == previous_account_id
            || account.chatgpt_account_id.as_deref() == Some(previous_account_id)
            || account.workspace_id.as_deref() == Some(previous_account_id)
    });
    let Some(account) = found else {
        return Ok(None);
    };
    let token = storage
        .find_token_by_account_id(&account.id)
        .map_err(|err| err.to_string())?;
    Ok(token.map(|token| (account, token)))
}

fn current_account_payload(
    account: &Account,
    token: &Token,
    auth_mode: &str,
) -> CurrentAuthAccount {
    let claims = parse_id_token_claims(&token.access_token).ok();
    let plan_type_resolution = resolve_plan_type_resolution(token, claims.as_ref());
    CurrentAuthAccount {
        kind: auth_mode.to_string(),
        account_id: account.id.clone(),
        email: claims
            .as_ref()
            .and_then(|claims| claims.email.clone())
            .unwrap_or_else(|| account.label.clone()),
        plan_type: plan_type_resolution
            .as_ref()
            .map(|plan| plan.normalized.clone())
            .unwrap_or_else(|| "unknown".to_string()),
        plan_type_raw: plan_type_resolution.and_then(|plan| plan.raw),
        chatgpt_account_id: account.chatgpt_account_id.clone(),
        workspace_id: account.workspace_id.clone(),
        status: account.status.clone(),
    }
}

#[cfg(test)]
fn resolve_plan_type(
    token: &Token,
    parsed_claims: Option<&codexmanager_core::auth::IdTokenClaims>,
) -> Option<String> {
    resolve_plan_type_resolution(token, parsed_claims).map(|plan| plan.normalized)
}

#[cfg(test)]
fn resolve_plan_type_raw(
    token: &Token,
    parsed_claims: Option<&codexmanager_core::auth::IdTokenClaims>,
) -> Option<String> {
    resolve_plan_type_resolution(token, parsed_claims).and_then(|plan| plan.raw)
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ResolvedPlanType {
    normalized: String,
    raw: Option<String>,
}

fn resolve_plan_type_resolution(
    token: &Token,
    parsed_claims: Option<&codexmanager_core::auth::IdTokenClaims>,
) -> Option<ResolvedPlanType> {
    if let Some(claims) = parsed_claims {
        if let Some(plan_type) = claims
            .auth
            .as_ref()
            .and_then(|auth| auth.chatgpt_plan_type.clone())
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
        {
            return normalize_plan_type(plan_type);
        }
    }
    if let Some(plan_type) = parse_id_token_claims(&token.access_token)
        .ok()
        .and_then(|claims| claims.auth.and_then(|auth| auth.chatgpt_plan_type))
        .and_then(normalize_plan_type)
    {
        return Some(plan_type);
    }
    parse_id_token_claims(&token.id_token)
        .ok()
        .and_then(|claims| claims.auth.and_then(|auth| auth.chatgpt_plan_type))
        .and_then(normalize_plan_type)
}

fn normalize_plan_type(value: String) -> Option<ResolvedPlanType> {
    let normalized = value.trim().to_ascii_lowercase();
    match normalized.as_str() {
        "free" | "go" | "plus" | "pro" | "team" | "business" | "enterprise" | "edu"
        | "education" => Some(ResolvedPlanType {
            normalized: match normalized.as_str() {
                "education" => "edu".to_string(),
                _ => normalized,
            },
            raw: None,
        }),
        "" => None,
        _ => Some(ResolvedPlanType {
            normalized: "unknown".to_string(),
            raw: Some(value.trim().to_string()),
        }),
    }
}

pub(crate) fn set_current_auth_account_id(account_id: Option<&str>) -> Result<(), String> {
    save_persisted_app_setting(CURRENT_AUTH_ACCOUNT_ID_KEY, account_id)
}

pub(crate) fn set_current_auth_mode(auth_mode: Option<&str>) -> Result<(), String> {
    save_persisted_app_setting(CURRENT_AUTH_MODE_KEY, auth_mode)
}

fn resolve_current_auth_mode(token: &Token) -> String {
    get_persisted_app_setting(CURRENT_AUTH_MODE_KEY)
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| infer_auth_mode_from_token(token).to_string())
}

fn infer_auth_mode_from_token(token: &Token) -> &'static str {
    if token.id_token.trim() == token.access_token.trim() {
        AUTH_MODE_CHATGPT_AUTH_TOKENS
    } else {
        AUTH_MODE_CHATGPT
    }
}

#[cfg(test)]
#[path = "tests/auth_account_tests.rs"]
mod tests;
