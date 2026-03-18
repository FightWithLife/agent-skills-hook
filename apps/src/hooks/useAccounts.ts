"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { accountClient } from "@/lib/api/account-client";
import { attachUsagesToAccounts } from "@/lib/api/normalize";
import { serviceClient } from "@/lib/api/service-client";
import { getAppErrorMessage } from "@/lib/api/transport";
import { useAppStore } from "@/lib/store/useAppStore";

type ImportByDirectoryResult = Awaited<ReturnType<typeof accountClient.importByDirectory>>;
type ImportByFileResult = Awaited<ReturnType<typeof accountClient.importByFile>>;
type ExportResult = Awaited<ReturnType<typeof accountClient.export>>;
type DeleteUnavailableFreeResult = { deleted?: number };

function isAccountRefreshBlocked(status: string | null | undefined): boolean {
  return String(status || "").trim().toLowerCase() === "disabled";
}

function buildImportSummaryMessage(result: ImportByDirectoryResult): string {
  const total = Number(result?.total || 0);
  const created = Number(result?.created || 0);
  const updated = Number(result?.updated || 0);
  const failed = Number(result?.failed || 0);
  return `导入完成：共${total}，新增${created}，更新${updated}，失败${failed}`;
}

function formatUsageRefreshErrorMessage(error: unknown): string {
  const message = getAppErrorMessage(error);
  if (message.toLowerCase().includes("refresh token failed with status 401")) {
    return "账号长期未登录，refresh 已过期，已改为不可用状态";
  }
  return message;
}

export function useAccounts() {
  const queryClient = useQueryClient();
  const serviceStatus = useAppStore((state) => state.serviceStatus);

  const accountsQuery = useQuery({
    queryKey: ["accounts", "list"],
    queryFn: () => accountClient.list(),
    retry: 1,
  });

  const usagesQuery = useQuery({
    queryKey: ["usage", "list"],
    queryFn: () => accountClient.listUsage(),
    retry: 1,
  });

  const manualPreferredAccountQuery = useQuery({
    queryKey: ["gateway", "manual-account", serviceStatus.addr || null],
    queryFn: () => serviceClient.getManualPreferredAccountId(),
    enabled: serviceStatus.connected,
    retry: 1,
  });

  const accounts = useMemo(() => {
    return attachUsagesToAccounts(
      accountsQuery.data?.items || [],
      usagesQuery.data || []
    );
  }, [accountsQuery.data?.items, usagesQuery.data]);

  const groups = useMemo(() => {
    const map = new Map<string, number>();
    for (const account of accounts) {
      const group = account.group || "默认";
      map.set(group, (map.get(group) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((left, right) => left[0].localeCompare(right[0], "zh-Hans-CN"))
      .map(([label, count]) => ({ label, count }));
  }, [accounts]);

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["accounts"] }),
      queryClient.invalidateQueries({ queryKey: ["usage"] }),
      queryClient.invalidateQueries({ queryKey: ["usage-aggregate"] }),
      queryClient.invalidateQueries({ queryKey: ["today-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["startup-snapshot"] }),
      queryClient.invalidateQueries({ queryKey: ["gateway", "manual-account"] }),
      queryClient.invalidateQueries({ queryKey: ["logs"] }),
    ]);
  };

  const invalidateManualPreferred = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["gateway", "manual-account"] }),
      queryClient.invalidateQueries({ queryKey: ["startup-snapshot"] }),
    ]);
  };

  const refreshAccountMutation = useMutation({
    mutationFn: (accountId: string) => accountClient.refreshUsage(accountId),
    onSuccess: () => {
      toast.success("账号用量已刷新");
    },
    onError: (error: unknown) => {
      toast.error(`刷新失败: ${formatUsageRefreshErrorMessage(error)}`);
    },
    onSettled: async () => {
      await invalidateAll();
    },
  });

  const refreshAllMutation = useMutation({
    mutationFn: () => accountClient.refreshUsage(),
    onSuccess: () => {
      toast.success("账号用量已刷新");
    },
    onError: (error: unknown) => {
      toast.error(`刷新失败: ${formatUsageRefreshErrorMessage(error)}`);
    },
    onSettled: async () => {
      await invalidateAll();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (accountId: string) => accountClient.delete(accountId),
    onSuccess: async () => {
      await invalidateAll();
      toast.success("账号已删除");
    },
    onError: (error: unknown) => {
      toast.error(`删除失败: ${getAppErrorMessage(error)}`);
    },
  });

  const deleteManyMutation = useMutation({
    mutationFn: (accountIds: string[]) => accountClient.deleteMany(accountIds),
    onSuccess: async (_result, accountIds) => {
      await invalidateAll();
      toast.success(`已删除 ${accountIds.length} 个账号`);
    },
    onError: (error: unknown) => {
      toast.error(`批量删除失败: ${getAppErrorMessage(error)}`);
    },
  });

  const deleteUnavailableFreeMutation = useMutation({
    mutationFn: () => accountClient.deleteUnavailableFree(),
    onSuccess: async (result: DeleteUnavailableFreeResult) => {
      await invalidateAll();
      const deleted = Number(result?.deleted || 0);
      if (deleted > 0) {
        toast.success(`已移除 ${deleted} 个不可用免费账号`);
      } else {
        toast.success("未发现可清理的不可用免费账号");
      }
    },
    onError: (error: unknown) => {
      toast.error(`清理失败: ${getAppErrorMessage(error)}`);
    },
  });

  const updateAccountSortMutation = useMutation({
    mutationFn: ({ accountId, sort }: { accountId: string; sort: number }) =>
      accountClient.updateSort(accountId, sort),
    onSuccess: async () => {
      await invalidateAll();
      toast.success("账号顺序已更新");
    },
    onError: (error: unknown) => {
      toast.error(`更新顺序失败: ${getAppErrorMessage(error)}`);
    },
  });

  const toggleAccountStatusMutation = useMutation({
    mutationFn: ({
      accountId,
      enabled,
      sourceStatus,
    }: {
      accountId: string;
      enabled: boolean;
      sourceStatus?: string | null;
    }) =>
      enabled
        ? accountClient.enableAccount(accountId)
        : accountClient.disableAccount(accountId),
    onSuccess: async (_result, variables) => {
      await invalidateAll();
      const normalizedSourceStatus = String(variables.sourceStatus || "")
        .trim()
        .toLowerCase();
      toast.success(
        variables.enabled
          ? normalizedSourceStatus === "inactive"
            ? "账号已恢复"
            : "账号已启用"
          : "账号已禁用"
      );
    },
    onError: (error: unknown, variables) => {
      const normalizedSourceStatus = String(variables.sourceStatus || "")
        .trim()
        .toLowerCase();
      const actionLabel = variables.enabled
        ? normalizedSourceStatus === "inactive"
          ? "恢复"
          : "启用"
        : "禁用";
      toast.error(
        `${actionLabel}账号失败: ${getAppErrorMessage(error)}`
      );
    },
  });

  const importByDirectoryMutation = useMutation({
    mutationFn: () => accountClient.importByDirectory(),
    onSuccess: async (result: ImportByDirectoryResult) => {
      if (result?.canceled) {
        toast.info("已取消导入");
        return;
      }
      await invalidateAll();
      toast.success(buildImportSummaryMessage(result));
    },
    onError: (error: unknown) => {
      toast.error(`导入失败: ${getAppErrorMessage(error)}`);
    },
  });

  const importByFileMutation = useMutation({
    mutationFn: () => accountClient.importByFile(),
    onSuccess: async (result: ImportByFileResult) => {
      if (result?.canceled) {
        toast.info("已取消导入");
        return;
      }
      await invalidateAll();
      toast.success(buildImportSummaryMessage(result));
    },
    onError: (error: unknown) => {
      toast.error(`导入失败: ${getAppErrorMessage(error)}`);
    },
  });

  const exportMutation = useMutation({
    mutationFn: () => accountClient.export(),
    onSuccess: (result: ExportResult) => {
      if (result?.canceled) {
        toast.info("已取消导出");
        return;
      }
      const exported = Number(result?.exported || 0);
      const outputDir = String(result?.outputDir || "").trim();
      toast.success(
        outputDir
          ? `已导出 ${exported} 个账号到 ${outputDir}`
          : `已导出 ${exported} 个账号`
      );
    },
    onError: (error: unknown) => {
      toast.error(`导出失败: ${getAppErrorMessage(error)}`);
    },
  });

  const setManualPreferredMutation = useMutation({
    mutationFn: (accountId: string) => serviceClient.setManualPreferredAccount(accountId),
    onSuccess: async () => {
      await invalidateManualPreferred();
      toast.success("已设为优先账号");
    },
    onError: (error: unknown) => {
      toast.error(`设置优先账号失败: ${getAppErrorMessage(error)}`);
    },
  });

  const clearManualPreferredMutation = useMutation({
    mutationFn: () => serviceClient.clearManualPreferredAccount(),
    onSuccess: async () => {
      await invalidateManualPreferred();
      toast.success("已取消优先账号");
    },
    onError: (error: unknown) => {
      toast.error(`取消优先账号失败: ${getAppErrorMessage(error)}`);
    },
  });

  return {
    accounts,
    groups,
    total: accountsQuery.data?.total || accounts.length,
    isLoading: accountsQuery.isLoading || usagesQuery.isLoading,
    manualPreferredAccountId: manualPreferredAccountQuery.data || "",
    refreshAccount: (accountId: string) => refreshAccountMutation.mutate(accountId),
    refreshAllAccounts: () => {
      if (!accounts.some((account) => !isAccountRefreshBlocked(account.status))) {
        toast.info("当前没有可刷新的账号");
        return;
      }
      refreshAllMutation.mutate();
    },
    deleteAccount: (accountId: string) => deleteMutation.mutate(accountId),
    deleteManyAccounts: (accountIds: string[]) => deleteManyMutation.mutate(accountIds),
    deleteUnavailableFree: () => deleteUnavailableFreeMutation.mutate(),
    importByFile: () => importByFileMutation.mutate(),
    importByDirectory: () => importByDirectoryMutation.mutate(),
    exportAccounts: () => exportMutation.mutate(),
    setPreferredAccount: (accountId: string) => setManualPreferredMutation.mutate(accountId),
    clearPreferredAccount: () => clearManualPreferredMutation.mutate(),
    updateAccountSort: (accountId: string, sort: number) =>
      updateAccountSortMutation.mutateAsync({ accountId, sort }),
    toggleAccountStatus: (
      accountId: string,
      enabled: boolean,
      sourceStatus?: string | null
    ) => toggleAccountStatusMutation.mutate({ accountId, enabled, sourceStatus }),
    isRefreshingAccountId:
      refreshAccountMutation.isPending && typeof refreshAccountMutation.variables === "string"
        ? refreshAccountMutation.variables
        : "",
    isRefreshingAllAccounts: refreshAllMutation.isPending,
    isExporting: exportMutation.isPending,
    isDeletingMany: deleteManyMutation.isPending,
    isUpdatingPreferred:
      setManualPreferredMutation.isPending || clearManualPreferredMutation.isPending,
    isUpdatingSortAccountId:
      updateAccountSortMutation.isPending &&
      updateAccountSortMutation.variables &&
      typeof updateAccountSortMutation.variables === "object" &&
      "accountId" in updateAccountSortMutation.variables
        ? String(
            (updateAccountSortMutation.variables as { accountId?: unknown }).accountId || ""
          )
        : "",
    isUpdatingStatusAccountId:
      toggleAccountStatusMutation.isPending &&
      toggleAccountStatusMutation.variables &&
      typeof toggleAccountStatusMutation.variables === "object" &&
      "accountId" in toggleAccountStatusMutation.variables
        ? String(
            (toggleAccountStatusMutation.variables as { accountId?: unknown }).accountId || ""
          )
        : "",
  };
}
