import "./styles/base.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles/responsive.css";
import "./styles/performance.css";

import {
  appSettingsGet,
  appSettingsSet,
  serviceGatewayBackgroundTasksSet,
  serviceGatewayHeaderPolicySet,
  serviceGatewayUpstreamProxySet,
  serviceGatewayRouteStrategySet,
  serviceUsageRefresh,
  updateCheck,
  updateDownload,
  updateInstall,
  updateRestart,
  updateStatus,
} from "./api";
import { state } from "./state";
import { dom } from "./ui/dom";
import { setStatus, setServiceHint } from "./ui/status";
import {
  buildEnvOverrideDescription,
  buildEnvOverrideOptionLabel,
  filterEnvOverrideCatalog,
  formatEnvOverrideDisplayValue,
  normalizeEnvOverrideCatalog,
  normalizeEnvOverrides,
  normalizeStringList,
} from "./ui/env-overrides";
import { withButtonBusy } from "./ui/button-busy";
import { normalizeUpstreamProxyUrl } from "./utils/upstream-proxy.js";
import {
  ensureConnected,
  normalizeAddr,
  startService,
  stopService,
  waitForConnection,
} from "./services/connection";
import {
  refreshAccounts,
  refreshAccountsPage,
  refreshUsageList,
  refreshApiKeys,
  refreshApiModels,
  refreshRequestLogs,
  refreshRequestLogTodaySummary,
  clearRequestLogs,
} from "./services/data";
import {
  ensureAutoRefreshTimer,
  runRefreshTasks,
  stopAutoRefreshTimer,
} from "./services/refresh";
import { createServiceLifecycle } from "./services/service-lifecycle";
import { createLoginFlow } from "./services/login-flow";
import { createUpdateController } from "./services/update-controller.js";
import { openAccountModal, closeAccountModal } from "./views/accounts";
import { renderAccountsRefreshProgress } from "./views/accounts/render";
import {
  clearRefreshAllProgress,
  setRefreshAllProgress,
} from "./services/management/account-actions";
import { renderApiKeys, openApiKeyModal, closeApiKeyModal, populateApiKeyModelSelect } from "./views/apikeys";
import { openUsageModal, closeUsageModal, renderUsageSnapshot } from "./views/usage";
import { renderRequestLogs } from "./views/requestlogs";
import { createAppRuntime } from "./runtime/app-runtime.js";
import { createBootstrapRunner } from "./runtime/app-bootstrap.js";
import { createAppShellRuntime } from "./runtime/app-shell.js";
import { createAccountsPageCoordinator } from "./runtime/accounts-page-coordinator.js";
import { createManagementRuntime } from "./runtime/management-runtime.js";
import { createMainSettingsRuntime } from "./runtime/main-settings-runtime.js";

let serviceLifecycle = null;
let settingsRuntime = null;

function saveAppSettingsPatch(patch = {}) {
  if (!settingsRuntime) {
    throw new Error("settings runtime is not ready");
  }
  return settingsRuntime.saveAppSettingsPatch(patch);
}

const UPDATE_CHECK_DELAY_MS = 1200;

function isTauriRuntime() {
  return Boolean(window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke);
}

function normalizeErrorMessage(err) {
  const raw = String(err && err.message ? err.message : err).trim();
  if (!raw) {
    return "未知错误";
  }
  return raw.length > 120 ? `${raw.slice(0, 120)}...` : raw;
}

const {
  bindEvents,
  closeThemePanel,
  renderThemeButtons,
  restoreTheme,
  setStartupMask,
  setTheme,
  showConfirmDialog,
  showToast,
  switchPage,
  toggleThemePanel,
  updateRequestLogFilterButtons,
} = createAppShellRuntime({
  dom,
  state,
  saveAppSettingsPatch,
  onPageActivated: (page) => {
    renderCurrentPageView(page);
    if (page === "accounts") {
      void reloadAccountsPage({ silent: true, latestOnly: true });
    }
  },
});

let loadAppSettings;
let getAppSettingsSnapshot;
let applyBrowserModeUi;
let readUpdateAutoCheckSetting;
let saveUpdateAutoCheckSetting;
let initUpdateAutoCheckSetting;
let readCloseToTrayOnCloseSetting;
let saveCloseToTrayOnCloseSetting;
let setCloseToTrayOnCloseToggle;
let applyCloseToTrayOnCloseSetting;
let initCloseToTrayOnCloseSetting;
let readLightweightModeOnCloseToTraySetting;
let saveLightweightModeOnCloseToTraySetting;
let setLightweightModeOnCloseToTrayToggle;
let syncLightweightModeOnCloseToTrayAvailability;
let applyLightweightModeOnCloseToTraySetting;
let initLightweightModeOnCloseToTraySetting;
let readLowTransparencySetting;
let saveLowTransparencySetting;
let applyLowTransparencySetting;
let initLowTransparencySetting;
let normalizeServiceListenMode;
let serviceListenModeLabel;
let buildServiceListenModeHint;
let setServiceListenModeSelect;
let setServiceListenModeHint;
let readServiceListenModeSetting;
let initServiceListenModeSetting;
let applyServiceListenModeToService;
let syncServiceListenModeOnStartup;
let normalizeRouteStrategy;
let routeStrategyLabel;
let readRouteStrategySetting;
let saveRouteStrategySetting;
let setRouteStrategySelect;
let initRouteStrategySetting;
let normalizeCpaNoCookieHeaderMode;
let readCpaNoCookieHeaderModeSetting;
let saveCpaNoCookieHeaderModeSetting;
let setCpaNoCookieHeaderModeToggle;
let initCpaNoCookieHeaderModeSetting;
let readUpstreamProxyUrlSetting;
let saveUpstreamProxyUrlSetting;
let setUpstreamProxyInput;
let setUpstreamProxyHint;
let initUpstreamProxySetting;
let normalizeBackgroundTasksSettings;
let readBackgroundTasksSetting;
let saveBackgroundTasksSetting;
let setBackgroundTasksForm;
let readBackgroundTasksForm;
let updateBackgroundTasksHint;
let initBackgroundTasksSetting;
let getEnvOverrideSelectedKey;
let findEnvOverrideCatalogItem;
let setEnvOverridesHint;
let readEnvOverridesSetting;
let buildEnvOverrideHint;
let saveEnvOverridesSetting;
let renderEnvOverrideEditor;
let initEnvOverridesSetting;
let updateWebAccessPasswordState;
let syncWebAccessPasswordInputs;
let saveWebAccessPassword;
let clearWebAccessPassword;
let openWebSecurityModal;
let closeWebSecurityModal;
let persistServiceAddrInput;
let uiLowTransparencyToggleId;
let upstreamProxyHintText;
let backgroundTasksRestartKeysDefault;
let applyRouteStrategyToService;
let applyCpaNoCookieHeaderModeToService;
let applyUpstreamProxyToService;
let applyBackgroundTasksToService;
let syncRuntimeSettingsForCurrentProbe;
let syncRuntimeSettingsOnStartup;

serviceLifecycle = createServiceLifecycle({
  state,
  dom,
  setServiceHint,
  normalizeAddr,
  startService,
  stopService,
  waitForConnection,
  refreshAll: () => refreshAll(),
  maybeRefreshApiModelsCache: (options) => maybeRefreshApiModelsCache(options),
  ensureAutoRefreshTimer,
  stopAutoRefreshTimer,
  onStartupState: (loading, message) => setStartupMask(loading, message),
});

settingsRuntime = createMainSettingsRuntime({
  dom,
  state,
  appSettingsGet,
  appSettingsSet,
  showToast,
  normalizeErrorMessage,
  isTauriRuntime,
  ensureConnected,
  normalizeAddr,
  normalizeUpstreamProxyUrl,
  buildEnvOverrideDescription,
  buildEnvOverrideOptionLabel,
  filterEnvOverrideCatalog,
  formatEnvOverrideDisplayValue,
  normalizeEnvOverrideCatalog,
  normalizeEnvOverrides,
  normalizeStringList,
  serviceLifecycle,
  serviceGatewayRouteStrategySet,
  serviceGatewayHeaderPolicySet,
  serviceGatewayUpstreamProxySet,
  serviceGatewayBackgroundTasksSet,
});

({
  loadAppSettings,
  getAppSettingsSnapshot,
  applyBrowserModeUi,
  readUpdateAutoCheckSetting,
  saveUpdateAutoCheckSetting,
  initUpdateAutoCheckSetting,
  readCloseToTrayOnCloseSetting,
  saveCloseToTrayOnCloseSetting,
  setCloseToTrayOnCloseToggle,
  applyCloseToTrayOnCloseSetting,
  initCloseToTrayOnCloseSetting,
  readLightweightModeOnCloseToTraySetting,
  saveLightweightModeOnCloseToTraySetting,
  setLightweightModeOnCloseToTrayToggle,
  syncLightweightModeOnCloseToTrayAvailability,
  applyLightweightModeOnCloseToTraySetting,
  initLightweightModeOnCloseToTraySetting,
  readLowTransparencySetting,
  saveLowTransparencySetting,
  applyLowTransparencySetting,
  initLowTransparencySetting,
  normalizeServiceListenMode,
  serviceListenModeLabel,
  buildServiceListenModeHint,
  setServiceListenModeSelect,
  setServiceListenModeHint,
  readServiceListenModeSetting,
  initServiceListenModeSetting,
  applyServiceListenModeToService,
  syncServiceListenModeOnStartup,
  normalizeRouteStrategy,
  routeStrategyLabel,
  readRouteStrategySetting,
  saveRouteStrategySetting,
  setRouteStrategySelect,
  initRouteStrategySetting,
  normalizeCpaNoCookieHeaderMode,
  readCpaNoCookieHeaderModeSetting,
  saveCpaNoCookieHeaderModeSetting,
  setCpaNoCookieHeaderModeToggle,
  initCpaNoCookieHeaderModeSetting,
  readUpstreamProxyUrlSetting,
  saveUpstreamProxyUrlSetting,
  setUpstreamProxyInput,
  setUpstreamProxyHint,
  initUpstreamProxySetting,
  normalizeBackgroundTasksSettings,
  readBackgroundTasksSetting,
  saveBackgroundTasksSetting,
  setBackgroundTasksForm,
  readBackgroundTasksForm,
  updateBackgroundTasksHint,
  initBackgroundTasksSetting,
  getEnvOverrideSelectedKey,
  findEnvOverrideCatalogItem,
  setEnvOverridesHint,
  readEnvOverridesSetting,
  buildEnvOverrideHint,
  saveEnvOverridesSetting,
  renderEnvOverrideEditor,
  initEnvOverridesSetting,
  updateWebAccessPasswordState,
  syncWebAccessPasswordInputs,
  saveWebAccessPassword,
  clearWebAccessPassword,
  openWebSecurityModal,
  closeWebSecurityModal,
  persistServiceAddrInput,
  uiLowTransparencyToggleId,
  upstreamProxyHintText,
  backgroundTasksRestartKeysDefault,
  applyRouteStrategyToService,
  applyCpaNoCookieHeaderModeToService,
  applyUpstreamProxyToService,
  applyBackgroundTasksToService,
  syncRuntimeSettingsForCurrentProbe,
  syncRuntimeSettingsOnStartup,
} = settingsRuntime);

const {
  buildMainRenderActions,
  reloadAccountsPage,
  renderAccountsView,
  renderCurrentPageView,
} = createAccountsPageCoordinator({
  state,
  ensureConnected,
  refreshAccountsPage,
  renderAccountsRefreshProgress,
  setRefreshAllProgress,
  clearRefreshAllProgress,
  showToast,
  normalizeErrorMessage,
  updateServiceToggle: () => serviceLifecycle?.updateServiceToggle(),
  updateAccountSort: (...args) => updateAccountSort(...args),
  handleOpenUsageModal: (...args) => handleOpenUsageModal(...args),
  setManualPreferredAccount: (...args) => setManualPreferredAccount(...args),
  deleteAccount: (...args) => deleteAccount(...args),
  toggleApiKeyStatus: (...args) => toggleApiKeyStatus(...args),
  deleteApiKey: (...args) => deleteApiKey(...args),
  updateApiKeyModel: (...args) => updateApiKeyModel(...args),
  copyApiKey: (...args) => copyApiKey(...args),
});

const {
  nextPaintTick,
  maybeRefreshApiModelsCache,
  refreshAll,
  handleRefreshAllClick,
  refreshAccountsAndUsage,
} = createAppRuntime({
  state,
  dom,
  ensureConnected,
  refreshAccounts,
  refreshAccountsPage,
  refreshUsageList,
  refreshApiKeys,
  refreshApiModels,
  refreshRequestLogs,
  refreshRequestLogTodaySummary,
  serviceUsageRefresh,
  runRefreshTasks,
  renderAccountsRefreshProgress,
  setRefreshAllProgress,
  clearRefreshAllProgress,
  renderCurrentPageView,
  showToast,
  serviceLifecycle,
  syncRuntimeSettingsForCurrentProbe,
  populateApiKeyModelSelect,
});

const { handleCheckUpdateClick, scheduleStartupUpdateCheck, bootstrapUpdateStatus } = createUpdateController({
  dom,
  showToast,
  showConfirmDialog,
  normalizeErrorMessage,
  isTauriRuntime,
  readUpdateAutoCheckSetting,
  updateCheck,
  updateDownload,
  updateInstall,
  updateRestart,
  updateStatus,
  withButtonBusy,
  nextPaintTick,
  updateCheckDelayMs: UPDATE_CHECK_DELAY_MS,
});

const loginFlow = createLoginFlow({
  dom,
  state,
  withButtonBusy,
  ensureConnected,
  refreshAll,
  closeAccountModal,
});

const {
  handleClearRequestLogs,
  updateAccountSort,
  setManualPreferredAccount,
  deleteAccount,
  importAccountsFromFiles,
  importAccountsFromDirectory,
  deleteSelectedAccounts,
  deleteUnavailableFreeAccounts,
  exportAccountsByFile,
  handleOpenUsageModal,
  refreshUsageForAccount,
  createApiKey,
  deleteApiKey,
  toggleApiKeyStatus,
  updateApiKeyModel,
  copyApiKey,
  refreshApiModelsNow,
} = createManagementRuntime({
  dom,
  state,
  ensureConnected,
  withButtonBusy,
  showToast,
  showConfirmDialog,
  clearRequestLogs,
  refreshRequestLogs,
  renderRequestLogs,
  refreshAccountsAndUsage,
  renderAccountsView,
  renderCurrentPageView,
  openUsageModal,
  renderUsageSnapshot,
  refreshApiModels,
  refreshApiKeys,
  populateApiKeyModelSelect,
  renderApiKeys,
});

const bootstrap = createBootstrapRunner({
  setStartupMask,
  setStatus,
  loadAppSettings,
  applyBrowserModeUi,
  setServiceHint,
  renderThemeButtons,
  getAppSettingsSnapshot,
  restoreTheme,
  initLowTransparencySetting,
  initUpdateAutoCheckSetting,
  initCloseToTrayOnCloseSetting,
  initLightweightModeOnCloseToTraySetting,
  initServiceListenModeSetting,
  initRouteStrategySetting,
  initCpaNoCookieHeaderModeSetting,
  initUpstreamProxySetting,
  initBackgroundTasksSetting,
  initEnvOverridesSetting,
  updateWebAccessPasswordState,
  bootstrapUpdateStatus,
  serviceLifecycle,
  bindEvents: () => bindEvents({
    handleLogin: loginFlow.handleLogin,
    handleCancelLogin: loginFlow.handleCancelLogin,
    handleManualCallback: loginFlow.handleManualCallback,
    closeAccountModal,
    closeUsageModal,
    refreshUsageForAccount,
    closeApiKeyModal,
    createApiKey,
    handleClearRequestLogs,
    refreshRequestLogs,
    renderRequestLogs,
    handleRefreshAllClick,
    ensureConnected,
    refreshApiModels,
    refreshApiModelsNow,
    populateApiKeyModelSelect,
    importAccountsFromFiles,
    importAccountsFromDirectory,
    deleteSelectedAccounts,
    deleteUnavailableFreeAccounts,
    exportAccountsByFile,
    handleServiceToggle: serviceLifecycle.handleServiceToggle,
    renderAccountsView,
    reloadAccountsPage,
    normalizeErrorMessage,
    handleCheckUpdateClick,
    isTauriRuntime,
    openAccountModal,
    openApiKeyModal,
    settingsBindings: {
      withButtonBusy,
      saveAppSettingsPatch,
      readUpdateAutoCheckSetting,
      saveUpdateAutoCheckSetting,
      readCloseToTrayOnCloseSetting,
      saveCloseToTrayOnCloseSetting,
      setCloseToTrayOnCloseToggle,
      applyCloseToTrayOnCloseSetting,
      readLightweightModeOnCloseToTraySetting,
      saveLightweightModeOnCloseToTraySetting,
      setLightweightModeOnCloseToTrayToggle,
      syncLightweightModeOnCloseToTrayAvailability,
      applyLightweightModeOnCloseToTraySetting,
      readRouteStrategySetting,
      normalizeRouteStrategy,
      saveRouteStrategySetting,
      setRouteStrategySelect,
      applyRouteStrategyToService,
      routeStrategyLabel,
      readServiceListenModeSetting,
      normalizeServiceListenMode,
      setServiceListenModeSelect,
      setServiceListenModeHint,
      buildServiceListenModeHint,
      applyServiceListenModeToService,
      readCpaNoCookieHeaderModeSetting,
      saveCpaNoCookieHeaderModeSetting,
      setCpaNoCookieHeaderModeToggle,
      normalizeCpaNoCookieHeaderMode,
      applyCpaNoCookieHeaderModeToService,
      readUpstreamProxyUrlSetting,
      saveUpstreamProxyUrlSetting,
      setUpstreamProxyInput,
      setUpstreamProxyHint,
      normalizeUpstreamProxyUrl,
      applyUpstreamProxyToService,
      upstreamProxyHintText,
      readBackgroundTasksSetting,
      readBackgroundTasksForm,
      saveBackgroundTasksSetting,
      setBackgroundTasksForm,
      normalizeBackgroundTasksSettings,
      updateBackgroundTasksHint,
      applyBackgroundTasksToService,
      backgroundTasksRestartKeysDefault,
      getEnvOverrideSelectedKey,
      findEnvOverrideCatalogItem,
      setEnvOverridesHint,
      readEnvOverridesSetting,
      buildEnvOverrideHint,
      normalizeEnvOverrides,
      normalizeEnvOverrideCatalog,
      saveEnvOverridesSetting,
      renderEnvOverrideEditor,
      persistServiceAddrInput,
      uiLowTransparencyToggleId,
      readLowTransparencySetting,
      saveLowTransparencySetting,
      applyLowTransparencySetting,
      syncWebAccessPasswordInputs,
      saveWebAccessPassword,
      clearWebAccessPassword,
      openWebSecurityModal,
      closeWebSecurityModal,
    },
  }),
  renderCurrentPageView,
  updateRequestLogFilterButtons,
  scheduleStartupUpdateCheck,
  syncServiceListenModeOnStartup,
  syncRuntimeSettingsOnStartup,
});

window.addEventListener("DOMContentLoaded", () => {
  void bootstrap();
});








