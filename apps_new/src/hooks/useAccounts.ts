"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { accountClient } from "@/lib/api/account-client";
import { attachUsagesToAccounts } from "@/lib/api/normalize";

type ImportByDirectoryResult = Awaited<ReturnType<typeof accountClient.importByDirectory>>;
type ExportResult = Awaited<ReturnType<typeof accountClient.export>>;
type DeleteUnavailableFreeResult = { deleted?: number };

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || "");
}

function buildImportSummaryMessage(result: ImportByDirectoryResult): string {
  const total = Number(result?.total || 0);
  const created = Number(result?.created || 0);
  const updated = Number(result?.updated || 0);
  const failed = Number(result?.failed || 0);
  return `导入完成：共${total}，新增${created}，更新${updated}，失败${failed}`;
}

export function useAccounts() {
  const queryClient = useQueryClient();

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
      queryClient.invalidateQueries({ queryKey: ["logs"] }),
    ]);
  };

  const refreshMutation = useMutation({
    mutationFn: (accountId?: string) => accountClient.refreshUsage(accountId),
    onSuccess: async (_, accountId) => {
      await invalidateAll();
      toast.success(accountId ? "账号用量已刷新" : "全部账号用量已刷新");
    },
    onError: (error: unknown) => {
      toast.error(`刷新失败: ${getErrorMessage(error)}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (accountId: string) => accountClient.delete(accountId),
    onSuccess: async () => {
      await invalidateAll();
      toast.success("账号已删除");
    },
    onError: (error: unknown) => {
      toast.error(`删除失败: ${getErrorMessage(error)}`);
    },
  });

  const deleteManyMutation = useMutation({
    mutationFn: (accountIds: string[]) => accountClient.deleteMany(accountIds),
    onSuccess: async (_result, accountIds) => {
      await invalidateAll();
      toast.success(`已删除 ${accountIds.length} 个账号`);
    },
    onError: (error: unknown) => {
      toast.error(`批量删除失败: ${getErrorMessage(error)}`);
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
      toast.error(`清理失败: ${getErrorMessage(error)}`);
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
      toast.error(`导入失败: ${getErrorMessage(error)}`);
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
      toast.error(`导出失败: ${getErrorMessage(error)}`);
    },
  });

  return {
    accounts,
    groups,
    total: accountsQuery.data?.total || accounts.length,
    isLoading: accountsQuery.isLoading || usagesQuery.isLoading,
    refreshAccount: (accountId: string) => refreshMutation.mutate(accountId),
    refreshAllAccounts: () => refreshMutation.mutate(undefined),
    deleteAccount: (accountId: string) => deleteMutation.mutate(accountId),
    deleteManyAccounts: (accountIds: string[]) => deleteManyMutation.mutate(accountIds),
    deleteUnavailableFree: () => deleteUnavailableFreeMutation.mutate(),
    importByDirectory: () => importByDirectoryMutation.mutate(),
    exportAccounts: () => exportMutation.mutate(),
    isRefreshing: refreshMutation.isPending,
    isExporting: exportMutation.isPending,
    isDeletingMany: deleteManyMutation.isPending,
  };
}
