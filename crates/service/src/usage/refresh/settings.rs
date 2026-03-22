use serde::Serialize;
use std::sync::atomic::Ordering;

use super::{
    parse_interval_secs, BACKGROUND_TASKS_CONFIG_LOADED, BACKGROUND_TASK_RESTART_REQUIRED_KEYS,
    DEFAULT_GATEWAY_KEEPALIVE_INTERVAL_SECS, DEFAULT_HTTP_STREAM_WORKER_FACTOR,
    DEFAULT_HTTP_STREAM_WORKER_MIN, DEFAULT_HTTP_WORKER_FACTOR, DEFAULT_HTTP_WORKER_MIN,
    DEFAULT_TOKEN_REFRESH_POLL_INTERVAL_SECS, DEFAULT_USAGE_POLL_INTERVAL_SECS,
    DEFAULT_USAGE_REFRESH_WORKERS, ENV_DISABLE_POLLING, ENV_GATEWAY_KEEPALIVE_ENABLED,
    ENV_GATEWAY_KEEPALIVE_INTERVAL_SECS, ENV_HTTP_STREAM_WORKER_FACTOR, ENV_HTTP_STREAM_WORKER_MIN,
    ENV_HTTP_WORKER_FACTOR, ENV_HTTP_WORKER_MIN, ENV_TOKEN_REFRESH_POLLING_ENABLED,
    ENV_TOKEN_REFRESH_POLL_INTERVAL_SECS, ENV_USAGE_POLLING_ENABLED, ENV_USAGE_POLL_INTERVAL_SECS,
    EXCLUDE_LOW_QUOTA_FROM_BALANCED_ROUTING, GATEWAY_KEEPALIVE_ENABLED,
    GATEWAY_KEEPALIVE_INTERVAL_SECS, HTTP_STREAM_WORKER_FACTOR,
    HTTP_STREAM_WORKER_MIN, HTTP_WORKER_FACTOR, HTTP_WORKER_MIN,
    MIN_GATEWAY_KEEPALIVE_INTERVAL_SECS, MIN_TOKEN_REFRESH_POLL_INTERVAL_SECS,
    MIN_USAGE_POLL_INTERVAL_SECS, TOKEN_REFRESH_POLLING_ENABLED,
    TOKEN_REFRESH_POLL_INTERVAL_SECS_ATOMIC, USAGE_POLLING_ENABLED, USAGE_POLL_INTERVAL_SECS,
    USAGE_REFRESH_WORKERS, USAGE_REFRESH_WORKERS_ENV,
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BackgroundTasksSettings {
    usage_polling_enabled: bool,
    usage_poll_interval_secs: u64,
    gateway_keepalive_enabled: bool,
    gateway_keepalive_interval_secs: u64,
    token_refresh_polling_enabled: bool,
    token_refresh_poll_interval_secs: u64,
    usage_refresh_workers: usize,
    http_worker_factor: usize,
    http_worker_min: usize,
    http_stream_worker_factor: usize,
    http_stream_worker_min: usize,
    /// @brief balanced 轮询时是否排除低配额账号参与正常轮转
    exclude_low_quota_from_balanced_routing: bool,
    requires_restart_keys: Vec<&'static str>,
}

#[derive(Debug, Clone, Default)]
pub(crate) struct BackgroundTasksSettingsPatch {
    pub usage_polling_enabled: Option<bool>,
    pub usage_poll_interval_secs: Option<u64>,
    pub gateway_keepalive_enabled: Option<bool>,
    pub gateway_keepalive_interval_secs: Option<u64>,
    pub token_refresh_polling_enabled: Option<bool>,
    pub token_refresh_poll_interval_secs: Option<u64>,
    pub usage_refresh_workers: Option<usize>,
    pub http_worker_factor: Option<usize>,
    pub http_worker_min: Option<usize>,
    pub http_stream_worker_factor: Option<usize>,
    pub http_stream_worker_min: Option<usize>,
    /// @brief balanced 轮询时是否排除低配额账号参与正常轮转
    pub exclude_low_quota_from_balanced_routing: Option<bool>,
}

/**
 * @brief 获取当前是否排除低配额账号参与 balanced 轮转
 * @return true 表示排除，false 表示参与
 */
pub(crate) fn exclude_low_quota_from_balanced_routing() -> bool {
    ensure_background_tasks_config_loaded();
    EXCLUDE_LOW_QUOTA_FROM_BALANCED_ROUTING.load(Ordering::Relaxed)
}

/**
 * @brief 获取当前后台任务配置快照
 * @return 后台任务配置
 */
pub(crate) fn background_tasks_settings() -> BackgroundTasksSettings {
    ensure_background_tasks_config_loaded();
    BackgroundTasksSettings {
        usage_polling_enabled: USAGE_POLLING_ENABLED.load(Ordering::Relaxed),
        usage_poll_interval_secs: USAGE_POLL_INTERVAL_SECS.load(Ordering::Relaxed),
        gateway_keepalive_enabled: GATEWAY_KEEPALIVE_ENABLED.load(Ordering::Relaxed),
        gateway_keepalive_interval_secs: GATEWAY_KEEPALIVE_INTERVAL_SECS.load(Ordering::Relaxed),
        token_refresh_polling_enabled: TOKEN_REFRESH_POLLING_ENABLED.load(Ordering::Relaxed),
        token_refresh_poll_interval_secs: TOKEN_REFRESH_POLL_INTERVAL_SECS_ATOMIC
            .load(Ordering::Relaxed),
        usage_refresh_workers: USAGE_REFRESH_WORKERS.load(Ordering::Relaxed),
        http_worker_factor: HTTP_WORKER_FACTOR.load(Ordering::Relaxed),
        http_worker_min: HTTP_WORKER_MIN.load(Ordering::Relaxed),
        http_stream_worker_factor: HTTP_STREAM_WORKER_FACTOR.load(Ordering::Relaxed),
        http_stream_worker_min: HTTP_STREAM_WORKER_MIN.load(Ordering::Relaxed),
        exclude_low_quota_from_balanced_routing: EXCLUDE_LOW_QUOTA_FROM_BALANCED_ROUTING
            .load(Ordering::Relaxed),
        requires_restart_keys: BACKGROUND_TASK_RESTART_REQUIRED_KEYS.to_vec(),
    }
}

/**
 * @brief 应用后台任务配置变更并返回最新配置
 * @param patch 需要更新的配置片段
 * @return 更新后的后台任务配置
 */
pub(crate) fn set_background_tasks_settings(
    patch: BackgroundTasksSettingsPatch,
) -> BackgroundTasksSettings {
    ensure_background_tasks_config_loaded();

    if let Some(enabled) = patch.usage_polling_enabled {
        USAGE_POLLING_ENABLED.store(enabled, Ordering::Relaxed);
        std::env::set_var(ENV_USAGE_POLLING_ENABLED, if enabled { "1" } else { "0" });
        if enabled {
            std::env::remove_var(ENV_DISABLE_POLLING);
        } else {
            std::env::set_var(ENV_DISABLE_POLLING, "1");
        }
    }
    if let Some(secs) = patch.usage_poll_interval_secs {
        let normalized = secs.max(MIN_USAGE_POLL_INTERVAL_SECS);
        USAGE_POLL_INTERVAL_SECS.store(normalized, Ordering::Relaxed);
        std::env::set_var(ENV_USAGE_POLL_INTERVAL_SECS, normalized.to_string());
    }
    if let Some(enabled) = patch.gateway_keepalive_enabled {
        GATEWAY_KEEPALIVE_ENABLED.store(enabled, Ordering::Relaxed);
        std::env::set_var(
            ENV_GATEWAY_KEEPALIVE_ENABLED,
            if enabled { "1" } else { "0" },
        );
    }
    if let Some(secs) = patch.gateway_keepalive_interval_secs {
        let normalized = secs.max(MIN_GATEWAY_KEEPALIVE_INTERVAL_SECS);
        GATEWAY_KEEPALIVE_INTERVAL_SECS.store(normalized, Ordering::Relaxed);
        std::env::set_var(ENV_GATEWAY_KEEPALIVE_INTERVAL_SECS, normalized.to_string());
    }
    if let Some(enabled) = patch.token_refresh_polling_enabled {
        TOKEN_REFRESH_POLLING_ENABLED.store(enabled, Ordering::Relaxed);
        std::env::set_var(
            ENV_TOKEN_REFRESH_POLLING_ENABLED,
            if enabled { "1" } else { "0" },
        );
    }
    if let Some(secs) = patch.token_refresh_poll_interval_secs {
        let normalized = secs.max(MIN_TOKEN_REFRESH_POLL_INTERVAL_SECS);
        TOKEN_REFRESH_POLL_INTERVAL_SECS_ATOMIC.store(normalized, Ordering::Relaxed);
        std::env::set_var(ENV_TOKEN_REFRESH_POLL_INTERVAL_SECS, normalized.to_string());
    }
    if let Some(workers) = patch.usage_refresh_workers {
        let normalized = workers.max(1);
        USAGE_REFRESH_WORKERS.store(normalized, Ordering::Relaxed);
        std::env::set_var(USAGE_REFRESH_WORKERS_ENV, normalized.to_string());
    }
    if let Some(value) = patch.http_worker_factor {
        let normalized = value.max(1);
        HTTP_WORKER_FACTOR.store(normalized, Ordering::Relaxed);
        std::env::set_var(ENV_HTTP_WORKER_FACTOR, normalized.to_string());
    }
    if let Some(value) = patch.http_worker_min {
        let normalized = value.max(1);
        HTTP_WORKER_MIN.store(normalized, Ordering::Relaxed);
        std::env::set_var(ENV_HTTP_WORKER_MIN, normalized.to_string());
    }
    if let Some(value) = patch.http_stream_worker_factor {
        let normalized = value.max(1);
        HTTP_STREAM_WORKER_FACTOR.store(normalized, Ordering::Relaxed);
        std::env::set_var(ENV_HTTP_STREAM_WORKER_FACTOR, normalized.to_string());
    }
    if let Some(value) = patch.http_stream_worker_min {
        let normalized = value.max(1);
        HTTP_STREAM_WORKER_MIN.store(normalized, Ordering::Relaxed);
        std::env::set_var(ENV_HTTP_STREAM_WORKER_MIN, normalized.to_string());
    }
    if let Some(enabled) = patch.exclude_low_quota_from_balanced_routing {
        EXCLUDE_LOW_QUOTA_FROM_BALANCED_ROUTING.store(enabled, Ordering::Relaxed);
    }

    background_tasks_settings()
}

pub(crate) fn reload_background_tasks_runtime_from_env() {
    reload_background_tasks_from_env();
}

pub(super) fn ensure_background_tasks_config_loaded() {
    let _ = BACKGROUND_TASKS_CONFIG_LOADED.get_or_init(reload_background_tasks_from_env);
}

fn reload_background_tasks_from_env() {
    let usage_polling_default_enabled = std::env::var(ENV_DISABLE_POLLING).is_err();
    USAGE_POLLING_ENABLED.store(
        env_bool_or(ENV_USAGE_POLLING_ENABLED, usage_polling_default_enabled),
        Ordering::Relaxed,
    );
    USAGE_POLL_INTERVAL_SECS.store(
        parse_interval_secs(
            std::env::var(ENV_USAGE_POLL_INTERVAL_SECS).ok().as_deref(),
            DEFAULT_USAGE_POLL_INTERVAL_SECS,
            MIN_USAGE_POLL_INTERVAL_SECS,
        ),
        Ordering::Relaxed,
    );
    GATEWAY_KEEPALIVE_ENABLED.store(
        env_bool_or(ENV_GATEWAY_KEEPALIVE_ENABLED, true),
        Ordering::Relaxed,
    );
    GATEWAY_KEEPALIVE_INTERVAL_SECS.store(
        parse_interval_secs(
            std::env::var(ENV_GATEWAY_KEEPALIVE_INTERVAL_SECS)
                .ok()
                .as_deref(),
            DEFAULT_GATEWAY_KEEPALIVE_INTERVAL_SECS,
            MIN_GATEWAY_KEEPALIVE_INTERVAL_SECS,
        ),
        Ordering::Relaxed,
    );
    TOKEN_REFRESH_POLLING_ENABLED.store(
        env_bool_or(ENV_TOKEN_REFRESH_POLLING_ENABLED, true),
        Ordering::Relaxed,
    );
    TOKEN_REFRESH_POLL_INTERVAL_SECS_ATOMIC.store(
        parse_interval_secs(
            std::env::var(ENV_TOKEN_REFRESH_POLL_INTERVAL_SECS)
                .ok()
                .as_deref(),
            DEFAULT_TOKEN_REFRESH_POLL_INTERVAL_SECS,
            MIN_TOKEN_REFRESH_POLL_INTERVAL_SECS,
        ),
        Ordering::Relaxed,
    );
    USAGE_REFRESH_WORKERS.store(
        env_usize_or(USAGE_REFRESH_WORKERS_ENV, DEFAULT_USAGE_REFRESH_WORKERS).max(1),
        Ordering::Relaxed,
    );
    HTTP_WORKER_FACTOR.store(
        env_usize_or(ENV_HTTP_WORKER_FACTOR, DEFAULT_HTTP_WORKER_FACTOR).max(1),
        Ordering::Relaxed,
    );
    HTTP_WORKER_MIN.store(
        env_usize_or(ENV_HTTP_WORKER_MIN, DEFAULT_HTTP_WORKER_MIN).max(1),
        Ordering::Relaxed,
    );
    HTTP_STREAM_WORKER_FACTOR.store(
        env_usize_or(
            ENV_HTTP_STREAM_WORKER_FACTOR,
            DEFAULT_HTTP_STREAM_WORKER_FACTOR,
        )
        .max(1),
        Ordering::Relaxed,
    );
    HTTP_STREAM_WORKER_MIN.store(
        env_usize_or(ENV_HTTP_STREAM_WORKER_MIN, DEFAULT_HTTP_STREAM_WORKER_MIN).max(1),
        Ordering::Relaxed,
    );
}

fn env_usize_or(name: &str, default: usize) -> usize {
    std::env::var(name)
        .ok()
        .and_then(|value| value.trim().parse::<usize>().ok())
        .unwrap_or(default)
}

fn env_bool_or(name: &str, default: bool) -> bool {
    let Some(raw) = std::env::var(name).ok() else {
        return default;
    };
    match raw.trim().to_ascii_lowercase().as_str() {
        "1" | "true" | "yes" | "on" => true,
        "0" | "false" | "no" | "off" => false,
        _ => default,
    }
}
