import { invoke, withAddr } from "./transport";
import {
  normalizeAccountList,
  normalizeApiKeyCreateResult,
  normalizeApiKeyList,
  normalizeLoginStartResult,
  normalizeModelOptions,
  normalizeUsageAggregateSummary,
  normalizeUsageList,
  normalizeUsageSnapshot,
} from "./normalize";
import {
  AccountListResult,
  AccountUsage,
  ApiKey,
  ApiKeyCreateResult,
  LoginStartResult,
  ModelOption,
  UsageAggregateSummary,
} from "../../types";

interface AccountImportResult {
  canceled?: boolean;
  total?: number;
  created?: number;
  updated?: number;
  failed?: number;
  fileCount?: number;
  directoryPath?: string;
  contents?: string[];
}

interface AccountExportResult {
  canceled?: boolean;
  exported?: number;
  outputDir?: string;
}

interface DeleteUnavailableFreeResult {
  deleted?: number;
}

interface LoginStartPayload {
  loginType?: string;
  openBrowser?: boolean;
  note?: string | null;
  tags?: string[] | string | null;
  group?: string | null;
  groupName?: string | null;
  workspaceId?: string | null;
}

interface ApiKeyPayload {
  name?: string | null;
  modelSlug?: string | null;
  reasoningEffort?: string | null;
  protocolType?: string | null;
  upstreamBaseUrl?: string | null;
  staticHeadersJson?: string | null;
}

export const accountClient = {
  async list(params?: Record<string, unknown>): Promise<AccountListResult> {
    const result = await invoke<unknown>("service_account_list", withAddr(params));
    return normalizeAccountList(result);
  },
  delete: (accountId: string) =>
    invoke("service_account_delete", withAddr({ accountId })),
  deleteMany: (accountIds: string[]) =>
    invoke("service_account_delete_many", withAddr({ accountIds })),
  deleteUnavailableFree: () =>
    invoke<DeleteUnavailableFreeResult>("service_account_delete_unavailable_free", withAddr()),
  update: (accountId: string, sort: number) =>
    invoke("service_account_update", withAddr({ accountId, sort })),
  import: (contents: string[]) =>
    invoke("service_account_import", withAddr({ contents })),
  async importByDirectory(): Promise<AccountImportResult> {
    const picked = await invoke<AccountImportResult>(
      "service_account_import_by_directory",
      withAddr()
    );
    if (picked?.canceled || !Array.isArray(picked?.contents) || picked.contents.length === 0) {
      return picked;
    }

    const imported = await invoke<AccountImportResult>(
      "service_account_import",
      withAddr({ contents: picked.contents })
    );
    return {
      ...imported,
      canceled: false,
      directoryPath: picked.directoryPath || "",
      fileCount: picked.fileCount || picked.contents.length,
    };
  },
  export: () =>
    invoke<AccountExportResult>("service_account_export_by_account_files", withAddr()),

  async getUsage(accountId: string): Promise<AccountUsage | null> {
    const result = await invoke<unknown>("service_usage_read", withAddr({ accountId }));
    const source =
      result && typeof result === "object" && "snapshot" in result
        ? (result as { snapshot?: unknown }).snapshot
        : result;
    return normalizeUsageSnapshot(source);
  },
  async listUsage(): Promise<AccountUsage[]> {
    const result = await invoke<unknown>("service_usage_list", withAddr());
    return normalizeUsageList(result);
  },
  refreshUsage: (accountId?: string) =>
    invoke(
      "service_usage_refresh",
      withAddr(accountId ? { accountId } : {})
    ),
  async aggregateUsage(): Promise<UsageAggregateSummary> {
    const result = await invoke<unknown>("service_usage_aggregate", withAddr());
    return normalizeUsageAggregateSummary(result);
  },

  async startLogin(params: LoginStartPayload): Promise<LoginStartResult> {
    const result = await invoke<unknown>(
      "service_login_start",
      withAddr({
        loginType: params?.loginType || "chatgpt",
        openBrowser: params?.openBrowser ?? true,
        note: params?.note || null,
        tags: Array.isArray(params?.tags)
          ? params.tags
              .map((item: string) => String(item || "").trim())
              .filter(Boolean)
              .join(",")
          : params?.tags || null,
        groupName: params?.group || params?.groupName || null,
        workspaceId: params?.workspaceId || null,
      })
    );
    return normalizeLoginStartResult(result);
  },
  getLoginStatus: (loginId: string) =>
    invoke<unknown>("service_login_status", withAddr({ loginId })),
  completeLogin: (state: string, code: string, redirectUri: string) =>
    invoke("service_login_complete", withAddr({ state, code, redirectUri })),

  async listApiKeys(): Promise<ApiKey[]> {
    const result = await invoke<unknown>("service_apikey_list", withAddr());
    return normalizeApiKeyList(result);
  },
  async createApiKey(params: ApiKeyPayload): Promise<ApiKeyCreateResult> {
    const result = await invoke<unknown>(
      "service_apikey_create",
      withAddr({
        name: params.name || null,
        modelSlug: params.modelSlug || null,
        reasoningEffort: params.reasoningEffort || null,
        protocolType: params.protocolType || null,
        upstreamBaseUrl: params.upstreamBaseUrl || null,
        staticHeadersJson: params.staticHeadersJson || null,
      })
    );
    return normalizeApiKeyCreateResult(result);
  },
  deleteApiKey: (keyId: string) =>
    invoke("service_apikey_delete", withAddr({ keyId })),
  updateApiKey: (keyId: string, params: ApiKeyPayload) =>
    invoke(
      "service_apikey_update_model",
      withAddr({
        keyId,
        modelSlug: params.modelSlug || null,
        reasoningEffort: params.reasoningEffort || null,
        protocolType: params.protocolType || null,
        upstreamBaseUrl: params.upstreamBaseUrl || null,
        staticHeadersJson: params.staticHeadersJson || null,
      })
    ),
  disableApiKey: (keyId: string) =>
    invoke("service_apikey_disable", withAddr({ keyId })),
  enableApiKey: (keyId: string) =>
    invoke("service_apikey_enable", withAddr({ keyId })),
  async listModels(refreshRemote?: boolean): Promise<ModelOption[]> {
    const result = await invoke<unknown>(
      "service_apikey_models",
      withAddr({ refreshRemote })
    );
    return normalizeModelOptions(result);
  },
  async readApiKeySecret(keyId: string): Promise<string> {
    const result = await invoke<{ key?: string }>(
      "service_apikey_read_secret",
      withAddr({ keyId })
    );
    return String(result?.key || "").trim();
  },
};
