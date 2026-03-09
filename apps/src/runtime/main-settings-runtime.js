import { createSettingsController } from "../settings/controller.js";
import { createSettingsServiceSync } from "../settings/service-sync.js";

export function createMainSettingsRuntime(deps = {}) {
  const {
    serviceLifecycle,
    serviceGatewayRouteStrategySet,
    serviceGatewayHeaderPolicySet,
    serviceGatewayUpstreamProxySet,
    serviceGatewayBackgroundTasksSet,
    ...controllerDeps
  } = deps;

  const settingsController = createSettingsController(controllerDeps);
  const settingsServiceSync = createSettingsServiceSync({
    state: controllerDeps.state,
    showToast: controllerDeps.showToast,
    normalizeErrorMessage: controllerDeps.normalizeErrorMessage,
    isTauriRuntime: controllerDeps.isTauriRuntime,
    ensureConnected: controllerDeps.ensureConnected,
    serviceLifecycle,
    serviceGatewayRouteStrategySet,
    serviceGatewayHeaderPolicySet,
    serviceGatewayUpstreamProxySet,
    serviceGatewayBackgroundTasksSet,
    readRouteStrategySetting: settingsController.readRouteStrategySetting,
    saveRouteStrategySetting: settingsController.saveRouteStrategySetting,
    setRouteStrategySelect: settingsController.setRouteStrategySelect,
    normalizeRouteStrategy: settingsController.normalizeRouteStrategy,
    routeStrategyLabel: settingsController.routeStrategyLabel,
    readCpaNoCookieHeaderModeSetting: settingsController.readCpaNoCookieHeaderModeSetting,
    saveCpaNoCookieHeaderModeSetting: settingsController.saveCpaNoCookieHeaderModeSetting,
    setCpaNoCookieHeaderModeToggle: settingsController.setCpaNoCookieHeaderModeToggle,
    normalizeCpaNoCookieHeaderMode: settingsController.normalizeCpaNoCookieHeaderMode,
    readUpstreamProxyUrlSetting: settingsController.readUpstreamProxyUrlSetting,
    saveUpstreamProxyUrlSetting: settingsController.saveUpstreamProxyUrlSetting,
    setUpstreamProxyInput: settingsController.setUpstreamProxyInput,
    setUpstreamProxyHint: settingsController.setUpstreamProxyHint,
    normalizeUpstreamProxyUrl: settingsController.normalizeUpstreamProxyUrl,
    upstreamProxyHintText: settingsController.upstreamProxyHintText,
    readBackgroundTasksSetting: settingsController.readBackgroundTasksSetting,
    saveBackgroundTasksSetting: settingsController.saveBackgroundTasksSetting,
    setBackgroundTasksForm: settingsController.setBackgroundTasksForm,
    normalizeBackgroundTasksSettings: settingsController.normalizeBackgroundTasksSettings,
    updateBackgroundTasksHint: settingsController.updateBackgroundTasksHint,
    backgroundTasksRestartKeysDefault: settingsController.backgroundTasksRestartKeysDefault,
  });

  return {
    ...settingsController,
    applyRouteStrategyToService: settingsServiceSync.applyRouteStrategyToService,
    applyCpaNoCookieHeaderModeToService: settingsServiceSync.applyCpaNoCookieHeaderModeToService,
    applyUpstreamProxyToService: settingsServiceSync.applyUpstreamProxyToService,
    applyBackgroundTasksToService: settingsServiceSync.applyBackgroundTasksToService,
    syncRuntimeSettingsForCurrentProbe: settingsServiceSync.syncRuntimeSettingsForCurrentProbe,
    syncRuntimeSettingsOnStartup: settingsServiceSync.syncRuntimeSettingsOnStartup,
  };
}
