import { createFeedbackHandlers } from "../ui/feedback";
import { createThemeController } from "../ui/theme";
import { createStartupMaskController } from "../ui/startup-mask";
import { createNavigationHandlers } from "../views/navigation";
import { bindMainEvents } from "../views/event-bindings";
import { bindSettingsEvents } from "../settings/bind-settings-events.js";

export function createAppShellRuntime({
  dom,
  state,
  saveAppSettingsPatch,
  onPageActivated,
}) {
  const { showToast, showConfirmDialog } = createFeedbackHandlers({ dom });
  const {
    renderThemeButtons,
    setTheme,
    restoreTheme,
    closeThemePanel,
    toggleThemePanel,
  } = createThemeController({
    dom,
    onThemeChange: (theme) => saveAppSettingsPatch({ theme }),
  });

  const { switchPage, updateRequestLogFilterButtons } = createNavigationHandlers({
    state,
    dom,
    closeThemePanel,
    onPageActivated,
  });

  const { setStartupMask } = createStartupMaskController({ dom, state });

  function bindEvents({
    handleLogin,
    handleCancelLogin,
    handleManualCallback,
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
    handleServiceToggle,
    renderAccountsView,
    reloadAccountsPage,
    normalizeErrorMessage,
    handleCheckUpdateClick,
    isTauriRuntime,
    settingsBindings,
    openAccountModal,
    openApiKeyModal,
  }) {
    bindMainEvents({
      dom,
      state,
      switchPage,
      openAccountModal,
      openApiKeyModal,
      closeAccountModal,
      handleLogin,
      handleCancelLogin,
      showToast,
      handleManualCallback,
      closeUsageModal,
      refreshUsageForAccount,
      closeApiKeyModal,
      createApiKey,
      handleClearRequestLogs,
      refreshRequestLogs,
      renderRequestLogs,
      refreshAll: handleRefreshAllClick,
      ensureConnected,
      refreshApiModels,
      refreshApiModelsNow,
      populateApiKeyModelSelect,
      importAccountsFromFiles,
      importAccountsFromDirectory,
      deleteSelectedAccounts,
      deleteUnavailableFreeAccounts,
      exportAccountsByFile,
      toggleThemePanel,
      closeThemePanel,
      setTheme,
      handleServiceToggle,
      renderAccountsView,
      refreshAccountsPage: (options) => reloadAccountsPage(options),
      updateRequestLogFilterButtons,
    });

    bindSettingsEvents({
      dom,
      showToast,
      normalizeErrorMessage,
      handleCheckUpdateClick,
      isTauriRuntime,
      ...settingsBindings,
    });
  }

  return {
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
  };
}
