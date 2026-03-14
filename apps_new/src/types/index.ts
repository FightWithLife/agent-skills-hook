export interface ServiceStatus {
  connected: boolean;
  version: string;
  uptime: number;
  addr: string;
}

export interface Account {
  id: string;
  name: string;
  group: string;
  priority: number;
  tags: string[];
  note: string;
  is_available: boolean;
  is_low_quota: boolean;
  last_refresh_at?: string;
  usage?: AccountUsage;
}

export interface AccountUsage {
  total: number;
  used: number;
  remaining: number;
  refresh_at?: string;
}

export interface ApiKey {
  id: string;
  name: string;
  protocol: "openai_compat" | "azure_openai" | "anthropic_native";
  model: string;
  reasoning_level?: string;
  status: "active" | "disabled";
  secret?: string;
  endpoint?: string;
}

export interface RequestLog {
  id: string;
  timestamp: string;
  account_name: string;
  api_key_id: string;
  method: string;
  path: string;
  model: string;
  level: string;
  status: number;
  error?: string;
  total_tokens?: number;
  cached_tokens?: number;
  latency_ms?: number;
}

export interface AppSettings {
  updateAutoCheck: boolean;
  closeToTrayOnClose: boolean;
  lowTransparency: boolean;
  lightweightModeOnCloseToTray: boolean;
  webAccessPasswordConfigured: boolean;
  serviceAddr: string;
  theme?: string;
  [key: string]: any;
}

export interface BackgroundTaskSettings {
  usagePollingEnabled: boolean;
  usagePollIntervalSecs: number;
  gatewayKeepaliveEnabled: boolean;
  gatewayKeepaliveIntervalSecs: number;
  tokenRefreshPollingEnabled: boolean;
  tokenRefreshPollIntervalSecs: number;
  usageRefreshWorkers: number;
  httpWorkerFactor: number;
  httpWorkerMin: number;
  httpStreamWorkerFactor: number;
  httpStreamWorkerMin: number;
}
