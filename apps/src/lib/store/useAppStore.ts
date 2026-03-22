import { create } from "zustand";
import { AppSettings, RuntimeCapabilities, ServiceStatus } from "../../types";

interface AppState {
  serviceStatus: ServiceStatus;
  appSettings: AppSettings;
  runtimeCapabilities: RuntimeCapabilities | null;
  isSidebarOpen: boolean;
  pendingRoutePath: string;
  
  setServiceStatus: (status: Partial<ServiceStatus>) => void;
  setAppSettings: (settings: Partial<AppSettings>) => void;
  setRuntimeCapabilities: (capabilities: RuntimeCapabilities | null) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setPendingRoutePath: (path: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  serviceStatus: {
    connected: false,
    version: "",
    uptime: 0,
    addr: "localhost:48760",
  },
  appSettings: {
    updateAutoCheck: true,
    closeToTrayOnClose: false,
    closeToTraySupported: false,
    lowTransparency: false,
    lightweightModeOnCloseToTray: false,
    webAccessPasswordConfigured: false,
    serviceAddr: "localhost:48760",
    serviceListenMode: "loopback",
    serviceListenModeOptions: ["loopback", "all_interfaces"],
    routeStrategy: "ordered",
    routeStrategyOptions: ["ordered", "balanced"],
    freeAccountMaxModel: "auto",
    freeAccountMaxModelOptions: [
      "auto",
      "gpt-5",
      "gpt-5-codex",
      "gpt-5-codex-mini",
      "gpt-5.1",
      "gpt-5.1-codex",
      "gpt-5.1-codex-max",
      "gpt-5.1-codex-mini",
      "gpt-5.2",
      "gpt-5.2-codex",
      "gpt-5.3-codex",
      "gpt-5.4",
    ],
    requestCompressionEnabled: true,
    gatewayOriginator: "codex_cli_rs",
    gatewayUserAgentVersion: "0.101.0",
    gatewayResidencyRequirement: "",
    gatewayResidencyRequirementOptions: ["", "us"],
    upstreamProxyUrl: "",
    upstreamStreamTimeoutMs: 1800000,
    sseKeepaliveIntervalMs: 15000,
    backgroundTasks: {
      usagePollingEnabled: true,
      usagePollIntervalSecs: 600,
      gatewayKeepaliveEnabled: true,
      gatewayKeepaliveIntervalSecs: 180,
      tokenRefreshPollingEnabled: true,
      tokenRefreshPollIntervalSecs: 60,
      /** @brief 低配额账号不参与均衡轮询，但仍可作为兜底账号 */
      excludeLowQuotaFromBalancedRouting: true,
      usageRefreshWorkers: 4,
      httpWorkerFactor: 4,
      httpWorkerMin: 8,
      httpStreamWorkerFactor: 1,
      httpStreamWorkerMin: 2,
    },
    envOverrides: {},
    envOverrideCatalog: [],
    envOverrideReservedKeys: [],
    envOverrideUnsupportedKeys: [],
    theme: "tech",
    appearancePreset: "classic",
  },
  runtimeCapabilities: null,
  isSidebarOpen: true,
  pendingRoutePath: "",

  setServiceStatus: (status) => 
    set((state) => ({ serviceStatus: { ...state.serviceStatus, ...status } })),
  
  setAppSettings: (settings) =>
    set((state) => ({ appSettings: { ...state.appSettings, ...settings } })),

  setRuntimeCapabilities: (runtimeCapabilities) => set({ runtimeCapabilities }),
    
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),

  setPendingRoutePath: (path) => set({ pendingRoutePath: path }),
}));
