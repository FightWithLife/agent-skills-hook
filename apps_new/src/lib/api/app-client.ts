import { invoke, invokeFirst } from "./transport";
import { AppSettings } from "../../types";
import { normalizeAppSettings } from "./normalize";

export const appClient = {
  async getSettings(): Promise<AppSettings> {
    const result = await invoke<unknown>("app_settings_get");
    return normalizeAppSettings(result);
  },
  async setSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    const result = await invoke<unknown>("app_settings_set", { patch });
    return normalizeAppSettings(result);
  },

  getCloseToTray: () => invoke<boolean>("app_close_to_tray_on_close_get"),
  setCloseToTray: (enabled: boolean) =>
    invoke("app_close_to_tray_on_close_set", { enabled }),

  openInBrowser: (url: string) => invoke("open_in_browser", { url }),

  checkUpdate: () =>
    invokeFirst<unknown>(["app_update_check", "update_check", "check_update"], {}),
  prepareUpdate: (payload: Record<string, unknown> = {}) =>
    invokeFirst<unknown>(
      ["app_update_prepare", "update_download", "download_update"],
      payload
    ),
  launchInstaller: (payload: Record<string, unknown> = {}) =>
    invokeFirst<unknown>(
      ["app_update_launch_installer", "update_install", "install_update"],
      payload
    ),
  applyUpdatePortable: (payload: Record<string, unknown> = {}) =>
    invokeFirst<unknown>(
      ["app_update_apply_portable", "update_restart", "restart_update"],
      payload
    ),
  getStatus: () => invokeFirst<unknown>(["app_update_status", "update_status"], {}),
};
