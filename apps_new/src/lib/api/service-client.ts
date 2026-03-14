import { invoke, withAddr } from "./transport";
import {
  normalizeAppSettings,
  normalizeRequestLogs,
  normalizeStartupSnapshot,
  normalizeTodaySummary,
} from "./normalize";
import {
  BackgroundTaskSettings,
  RequestLog,
  RequestLogTodaySummary,
  ServiceInitializationResult,
  StartupSnapshot,
} from "../../types";
import { readInitializeResult } from "@/lib/utils/service";

export const serviceClient = {
  start: (addr?: string) => invoke("service_start", { addr }),
  stop: () => invoke("service_stop"),
  async initialize(): Promise<ServiceInitializationResult> {
    const result = await invoke<unknown>("service_initialize", withAddr());
    return readInitializeResult(result);
  },
  async getStartupSnapshot(
    params?: Record<string, unknown>
  ): Promise<StartupSnapshot> {
    const result = await invoke<unknown>(
      "service_startup_snapshot",
      withAddr(params)
    );
    return normalizeStartupSnapshot(result);
  },

  getGatewayTransport: () => invoke<unknown>("service_gateway_transport_get", withAddr()),
  setGatewayTransport: (settings: Record<string, unknown>) =>
    invoke("service_gateway_transport_set", withAddr(settings)),
  getUpstreamProxy: () =>
    invoke<string>("service_gateway_upstream_proxy_get", withAddr()),
  setUpstreamProxy: (proxyUrl: string) =>
    invoke("service_gateway_upstream_proxy_set", withAddr({ proxyUrl })),
  getRouteStrategy: () =>
    invoke<string>("service_gateway_route_strategy_get", withAddr()),
  setRouteStrategy: (strategy: string) =>
    invoke("service_gateway_route_strategy_set", withAddr({ strategy })),
  getHeaderPolicy: () =>
    invoke<string>("service_gateway_header_policy_get", withAddr()),
  setHeaderPolicy: (cpaNoCookieHeaderModeEnabled: boolean) =>
    invoke(
      "service_gateway_header_policy_set",
      withAddr({ cpaNoCookieHeaderModeEnabled })
    ),

  getBackgroundTasks: () =>
    invoke<BackgroundTaskSettings>("service_gateway_background_tasks_get", withAddr()),
  setBackgroundTasks: (settings: BackgroundTaskSettings) =>
    invoke(
      "service_gateway_background_tasks_set",
      withAddr({ ...(settings as unknown as Record<string, unknown>) })
    ),

  async listRequestLogs(query: string, limit: number): Promise<RequestLog[]> {
    const result = await invoke<unknown>(
      "service_requestlog_list",
      withAddr({ query, limit })
    );
    return normalizeRequestLogs(result);
  },
  clearRequestLogs: () => invoke("service_requestlog_clear", withAddr()),
  async getTodaySummary(): Promise<RequestLogTodaySummary> {
    const result = await invoke<unknown>(
      "service_requestlog_today_summary",
      withAddr()
    );
    return normalizeTodaySummary(result);
  },

  getListenConfig: () => invoke<unknown>("service_listen_config_get", withAddr()),
  setListenConfig: (mode: string) =>
    invoke("service_listen_config_set", withAddr({ mode })),

  getEnvOverrides: async () => {
    const result = await invoke<unknown>("app_settings_get");
    return normalizeAppSettings(result).envOverrides;
  },
};
