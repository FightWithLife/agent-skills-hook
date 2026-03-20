"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Download,
  PencilLine,
  ExternalLink,
  FileUp,
  FolderOpen,
  MoreVertical,
  Pin,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { AddAccountModal } from "@/components/modals/add-account-modal";
import { ConfirmDialog } from "@/components/modals/confirm-dialog";
import UsageModal from "@/components/modals/usage-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccounts } from "@/hooks/useAccounts";
import { cn } from "@/lib/utils";
import { buildStaticRouteUrl } from "@/lib/utils/static-routes";
import {
  formatTsFromSeconds,
  getUsageDisplayBuckets,
  isBannedAccount,
  isPrimaryWindowOnlyUsage,
  isSecondaryWindowOnlyUsage,
} from "@/lib/utils/usage";
import { Account } from "@/types";

type StatusFilter = "all" | "available" | "low_quota" | "banned";

function formatGroupFilterLabel(value: string) {
  const nextValue = String(value || "").trim();
  if (!nextValue || nextValue === "all") {
    return "全部分组";
  }
  return nextValue;
}

function formatStatusFilterLabel(value: string) {
  const nextValue = String(value || "").trim();
  switch (nextValue) {
    case "available":
      return "可用";
    case "low_quota":
      return "低配额";
    case "banned":
      return "封禁";
    case "all":
    default:
      return "全部";
  }
}

interface QuotaProgressProps {
  label: string;
  remainPercent: number | null;
  resetsAt: number | null;
  icon: LucideIcon;
  tone: "green" | "blue";
  emptyText?: string;
  emptyResetText?: string;
}

function QuotaProgress({
  label,
  remainPercent,
  resetsAt,
  icon: Icon,
  tone,
  emptyText = "--",
  emptyResetText = "未知",
}: QuotaProgressProps) {
  const value = remainPercent ?? 0;
  const trackClassName = tone === "blue" ? "bg-blue-500/20" : "bg-green-500/20";
  const indicatorClassName = tone === "blue" ? "bg-blue-500" : "bg-green-500";

  return (
    <div className="flex min-w-[120px] flex-col gap-1">
      <div className="flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Icon className="h-3 w-3" />
          <span>{label}</span>
        </div>
        <span className="font-medium">
          {remainPercent == null ? emptyText : `${value}%`}
        </span>
      </div>
      <Progress
        value={value}
        trackClassName={trackClassName}
        indicatorClassName={indicatorClassName}
      />
      <div className="text-[10px] text-muted-foreground">
        重置: {formatTsFromSeconds(resetsAt, emptyResetText)}
      </div>
    </div>
  );
}

function getAccountStatusAction(account: Account): {
  enable: boolean;
  label: string;
  icon: LucideIcon;
} {
  const normalizedStatus = String(account.status || "")
    .trim()
    .toLowerCase();
  if (normalizedStatus === "disabled") {
    return { enable: true, label: "启用账号", icon: Power };
  }
  if (normalizedStatus === "inactive") {
    return { enable: true, label: "恢复账号", icon: Power };
  }
  return { enable: false, label: "禁用账号", icon: PowerOff };
}

export default function AccountsPage() {
  const router = useRouter();
  const {
    accounts,
    groups,
    isLoading,
    refreshAccount,
    refreshAllAccounts,
    deleteAccount,
    deleteManyAccounts,
    deleteUnavailableFree,
    importByFile,
    importByDirectory,
    exportAccounts,
    isRefreshingAccountId,
    isRefreshingAllAccounts,
    isExporting,
    isDeletingMany,
    manualPreferredAccountId,
    setPreferredAccount,
    clearPreferredAccount,
    isUpdatingPreferred,
    updateAccountSort,
    isUpdatingSortAccountId,
    toggleAccountStatus,
    isUpdatingStatusAccountId,
  } = useAccounts();

  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [pageSize, setPageSize] = useState("20");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [addAccountModalOpen, setAddAccountModalOpen] = useState(false);
  const [usageModalOpen, setUsageModalOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [sortDraft, setSortDraft] = useState("");
  const [sortDialogState, setSortDialogState] = useState<{
    accountId: string;
    accountName: string;
    currentSort: number;
  } | null>(null);
  const [deleteDialogState, setDeleteDialogState] = useState<
    | { kind: "single"; account: Account }
    | { kind: "selected"; ids: string[]; count: number }
    | null
  >(null);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      const matchSearch =
        !search ||
        account.name.toLowerCase().includes(search.toLowerCase()) ||
        account.id.toLowerCase().includes(search.toLowerCase());
      const matchGroup =
        groupFilter === "all" || (account.group || "默认") === groupFilter;
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "available" && account.isAvailable) ||
        (statusFilter === "low_quota" && account.isLowQuota) ||
        (statusFilter === "banned" && isBannedAccount(account));
      return matchSearch && matchGroup && matchStatus;
    });
  }, [accounts, groupFilter, search, statusFilter]);

  const statusFilterOptions = useMemo(
    () => [
      { id: "all" as const, label: `全部 (${accounts.length})` },
      {
        id: "available" as const,
        label: `可用 (${accounts.filter((account) => account.isAvailable).length})`,
      },
      {
        id: "low_quota" as const,
        label: `低配额 (${accounts.filter((account) => account.isLowQuota).length})`,
      },
      {
        id: "banned" as const,
        label: `封禁 (${accounts.filter((account) => isBannedAccount(account)).length})`,
      },
    ],
    [accounts],
  );
  const pageSizeNumber = Number(pageSize) || 20;
  const totalPages = Math.max(
    1,
    Math.ceil(filteredAccounts.length / pageSizeNumber),
  );
  const safePage = Math.min(page, totalPages);
  const accountIdSet = useMemo(
    () => new Set(accounts.map((account) => account.id)),
    [accounts],
  );
  const effectiveSelectedIds = useMemo(
    () => selectedIds.filter((id) => accountIdSet.has(id)),
    [accountIdSet, selectedIds],
  );

  const visibleAccounts = useMemo(() => {
    const offset = (safePage - 1) * pageSizeNumber;
    return filteredAccounts.slice(offset, offset + pageSizeNumber);
  }, [filteredAccounts, pageSizeNumber, safePage]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
  );

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleGroupFilterChange = (value: string | null) => {
    setGroupFilter(value || "all");
    setPage(1);
  };

  const handleStatusFilterChange = (value: StatusFilter) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handlePageSizeChange = (value: string | null) => {
    setPageSize(value || "20");
    setPage(1);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = visibleAccounts.map((account) => account.id);
    const allSelected = visibleIds.every((id) =>
      effectiveSelectedIds.includes(id),
    );
    setSelectedIds((current) => {
      if (allSelected) {
        return current.filter((id) => !visibleIds.includes(id));
      }
      return Array.from(new Set([...current, ...visibleIds]));
    });
  };

  const openUsage = (account: Account) => {
    setSelectedAccountId(account.id);
    setUsageModalOpen(true);
  };

  const handleDeleteSelected = () => {
    if (!effectiveSelectedIds.length) {
      toast.error("请先选择要删除的账号");
      return;
    }
    setDeleteDialogState({
      kind: "selected",
      ids: [...effectiveSelectedIds],
      count: effectiveSelectedIds.length,
    });
  };

  const handleDeleteBanned = () => {
    const bannedIds = accounts
      .filter((account) => isBannedAccount(account))
      .map((account) => account.id);
    if (!bannedIds.length) {
      toast.error("当前没有可清理的封禁账号");
      return;
    }
    setDeleteDialogState({
      kind: "selected",
      ids: bannedIds,
      count: bannedIds.length,
    });
  };

  const handleDeleteSingle = (account: Account) => {
    setDeleteDialogState({ kind: "single", account });
  };

  const openSortEditor = (account: Account) => {
    setSortDialogState({
      accountId: account.id,
      accountName: account.name,
      currentSort: account.priority,
    });
    setSortDraft(String(account.priority));
  };

  const handleConfirmSort = async () => {
    if (!sortDialogState) return;

    const raw = sortDraft.trim();
    if (!raw) {
      toast.error("请输入顺序值");
      return;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      toast.error("顺序必须是数字");
      return;
    }

    const nextSort = Math.max(0, Math.trunc(parsed));
    if (nextSort === sortDialogState.currentSort) {
      setSortDialogState(null);
      return;
    }

    try {
      await updateAccountSort(sortDialogState.accountId, nextSort);
      setSortDialogState(null);
    } catch {
      // mutation 已统一处理 toast，这里保持弹窗不关闭
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteDialogState) return;
    if (deleteDialogState.kind === "single") {
      deleteAccount(deleteDialogState.account.id);
      return;
    }
    deleteManyAccounts(deleteDialogState.ids);
    setSelectedIds((current) =>
      current.filter((id) => !deleteDialogState.ids.includes(id)),
    );
  };

  return (
    <div className="space-y-6">
      <Card className="glass-card border-none shadow-md backdrop-blur-md">
        <CardContent className="grid gap-3 pt-0 lg:grid-cols-[200px_auto_minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <Input
              placeholder="搜索账号名 / 编号..."
              className="glass-card h-10 rounded-xl px-3"
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <Select value={groupFilter} onValueChange={handleGroupFilterChange}>
              <SelectTrigger className="h-10 w-[140px] shrink-0 rounded-xl bg-card/50">
                <SelectValue placeholder="全部分组">
                  {(value) => formatGroupFilterLabel(String(value || ""))}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  全部分组 ({accounts.length})
                </SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.label} value={group.label}>
                    {group.label} ({group.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                handleStatusFilterChange(value as StatusFilter)
              }
            >
              <SelectTrigger className="h-10 w-[152px] shrink-0 rounded-xl bg-card/50">
                <SelectValue placeholder="全部状态">
                  {(value) => formatStatusFilterLabel(String(value || ""))}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {statusFilterOptions.map((filter) => (
                  <SelectItem key={filter.id} value={filter.id}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="hidden min-w-0 lg:block" />

          <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0 lg:justify-self-end">
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button
                  variant="outline"
                  className="glass-card h-10 min-w-[50px] justify-between gap-2 rounded-xl px-3"
                  render={<span />}
                  nativeButton={false}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium">账号操作</span>
                    {effectiveSelectedIds.length > 0 ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        {effectiveSelectedIds.length}
                      </span>
                    ) : null}
                  </span>
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64 rounded-xl border border-border/70 bg-popover/95 p-2 shadow-xl backdrop-blur-md"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground/80">
                    账号管理
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    className="h-9 rounded-lg px-2"
                    onClick={() => setAddAccountModalOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" /> 添加账号
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="h-9 rounded-lg px-2"
                    onClick={() => importByFile()}
                  >
                    <FileUp className="mr-2 h-4 w-4" /> 按文件导入
                    <DropdownMenuShortcut>FILE</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="h-9 rounded-lg px-2"
                    onClick={() => importByDirectory()}
                  >
                    <FolderOpen className="mr-2 h-4 w-4" /> 按文件夹导入
                    <DropdownMenuShortcut>DIR</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="h-9 rounded-lg px-2"
                    disabled={isExporting}
                    onClick={() => exportAccounts()}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    导出账号
                    <DropdownMenuShortcut>
                      {isExporting ? "..." : "ZIP"}
                    </DropdownMenuShortcut>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground/80">
                    清理
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    disabled={!effectiveSelectedIds.length || isDeletingMany}
                    variant="destructive"
                    className="h-9 rounded-lg px-2"
                    onClick={handleDeleteSelected}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> 删除选中账号
                    <DropdownMenuShortcut>
                      {effectiveSelectedIds.length || "-"}
                    </DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    className="h-9 rounded-lg px-2"
                    onClick={() => deleteUnavailableFree()}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> 一键清理不可用免费
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    className="h-9 rounded-lg px-2"
                    onClick={handleDeleteBanned}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> 一键清理封禁账号
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              className="h-10 w-30 gap-1 rounded-xl shadow-lg shadow-primary/20"
              onClick={() => refreshAllAccounts()}
              disabled={isRefreshingAllAccounts}
            >
              <RefreshCw
                className={cn(
                  "h-4 w-1",
                  isRefreshingAllAccounts && "animate-spin",
                )}
              />
              刷新账号用量
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card overflow-hidden border-none py-0 shadow-xl backdrop-blur-md">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">
                  <Checkbox
                    checked={
                      visibleAccounts.length > 0 &&
                      visibleAccounts.every((account) =>
                        effectiveSelectedIds.includes(account.id),
                      )
                    }
                    onCheckedChange={toggleSelectAllVisible}
                  />
                </TableHead>
                <TableHead className="max-w-[220px]">账号信息</TableHead>
                <TableHead>5h 额度</TableHead>
                <TableHead>7d 额度</TableHead>
                <TableHead className="w-20">顺序</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Skeleton className="mx-auto h-4 w-4" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-10" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="mx-auto h-8 w-24" />
                    </TableCell>
                  </TableRow>
                ))
              ) : visibleAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Search className="h-8 w-8 opacity-20" />
                      <p>未找到符合条件的账号</p>
                    </div>
                  </TableCell>
                </TableRow>
                ) : (
                  visibleAccounts.map((account) => {
                    const primaryWindowOnly = isPrimaryWindowOnlyUsage(
                      account.usage,
                    );
                    const secondaryWindowOnly = isSecondaryWindowOnlyUsage(
                      account.usage,
                    );
                    const usageBuckets = getUsageDisplayBuckets(account.usage);
                    const statusAction = getAccountStatusAction(account);
                  const StatusActionIcon = statusAction.icon;
                  return (
                    <TableRow key={account.id} className="group">
                      <TableCell className="text-center">
                        <Checkbox
                          checked={effectiveSelectedIds.includes(account.id)}
                          onCheckedChange={() => toggleSelect(account.id)}
                        />
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        <div className="flex flex-col overflow-hidden">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="truncate text-sm font-semibold">
                              {account.name}
                            </span>
                            <Badge
                              variant="secondary"
                              className="h-4 shrink-0 bg-accent/50 px-1.5 text-[9px]"
                            >
                              {account.group || "默认"}
                            </Badge>
                            {manualPreferredAccountId === account.id ? (
                              <Badge
                                variant="secondary"
                                className="h-4 shrink-0 bg-amber-500/15 px-1.5 text-[9px] text-amber-700 dark:text-amber-300"
                              >
                                优先
                              </Badge>
                            ) : null}
                          </div>
                          <span className="truncate font-mono text-[10px] uppercase text-muted-foreground opacity-60">
                            {account.id.slice(0, 16)}...
                          </span>
                          <span className="mt-1 text-[10px] text-muted-foreground">
                            最近刷新:{" "}
                            {formatTsFromSeconds(
                              account.lastRefreshAt,
                              "从未刷新",
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <QuotaProgress
                          label="5小时"
                          remainPercent={account.primaryRemainPercent}
                          resetsAt={usageBuckets.primaryResetsAt}
                          icon={RefreshCw}
                          tone="green"
                          emptyText={secondaryWindowOnly ? "未提供" : "--"}
                          emptyResetText={
                            secondaryWindowOnly ? "未提供" : "未知"
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <QuotaProgress
                          label="7天"
                          remainPercent={account.secondaryRemainPercent}
                          resetsAt={usageBuckets.secondaryResetsAt}
                          icon={RefreshCw}
                          tone="blue"
                          emptyText={primaryWindowOnly ? "未提供" : "--"}
                          emptyResetText={primaryWindowOnly ? "未提供" : "未知"}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="rounded bg-muted/50 px-2 py-0.5 font-mono text-xs">
                            {account.priority}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground transition-colors hover:text-primary"
                            disabled={isUpdatingSortAccountId === account.id}
                            onClick={() => openSortEditor(account)}
                            title="编辑顺序"
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <div
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              account.isAvailable
                                ? "bg-green-500"
                                : "bg-red-500",
                            )}
                          />
                          <span
                            className={cn(
                              "text-[11px] font-medium",
                              account.isAvailable
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400",
                            )}
                          >
                            {account.availabilityText}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="table-action-cell gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground transition-colors hover:text-primary"
                            onClick={() => openUsage(account)}
                            title="用量详情"
                          >
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                render={<span />}
                                nativeButton={false}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="gap-2"
                                disabled={isUpdatingPreferred}
                                onClick={() =>
                                  manualPreferredAccountId === account.id
                                    ? clearPreferredAccount()
                                    : setPreferredAccount(account.id)
                                }
                              >
                                <Pin className="h-4 w-4" />
                                {manualPreferredAccountId === account.id
                                  ? "取消优先"
                                  : "设为优先"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2"
                                disabled={
                                  isUpdatingStatusAccountId === account.id
                                }
                                onClick={() =>
                                  toggleAccountStatus(
                                    account.id,
                                    statusAction.enable,
                                    account.status,
                                  )
                                }
                              >
                                <StatusActionIcon className="h-4 w-4" />
                                {statusAction.label}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2"
                                onClick={() =>
                                  router.push(
                                    buildStaticRouteUrl(
                                      "/logs",
                                      `?query=${encodeURIComponent(account.id)}`,
                                    ),
                                  )
                                }
                              >
                                <ExternalLink className="h-4 w-4" /> 详情与日志
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="gap-2 text-red-500"
                                onClick={() => handleDeleteSingle(account)}
                              >
                                <Trash2 className="h-4 w-4" /> 删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between px-2">
        <div className="text-xs text-muted-foreground">
          共 {filteredAccounts.length} 个账号
          {effectiveSelectedIds.length > 0 ? (
            <span className="ml-1 text-primary">
              (已选择 {effectiveSelectedIds.length} 个)
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              每页显示
            </span>
            <Select value={pageSize} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="h-8 w-[70px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["5", "10", "20", "50", "100", "500"].map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs"
              disabled={safePage <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              上一页
            </Button>
            <div className="min-w-[60px] text-center text-xs font-medium">
              第 {safePage} / {totalPages} 页
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs"
              disabled={safePage >= totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
            >
              下一页
            </Button>
          </div>
        </div>
      </div>

      {addAccountModalOpen ? (
        <AddAccountModal
          open={addAccountModalOpen}
          onOpenChange={setAddAccountModalOpen}
        />
      ) : null}
      <UsageModal
        account={selectedAccount}
        open={usageModalOpen}
        onOpenChange={(open) => {
          setUsageModalOpen(open);
          if (!open) {
            setSelectedAccountId("");
          }
        }}
        onRefresh={refreshAccount}
        isRefreshing={
          isRefreshingAllAccounts ||
          (!!selectedAccount && isRefreshingAccountId === selectedAccount.id)
        }
      />
      <ConfirmDialog
        open={Boolean(deleteDialogState)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialogState(null);
          }
        }}
        title={
          deleteDialogState?.kind === "single" ? "删除账号" : "批量删除账号"
        }
        description={
          deleteDialogState?.kind === "single"
            ? `确定删除账号 ${deleteDialogState.account.name} 吗？删除后不可恢复。`
            : `确定删除选中的 ${deleteDialogState?.count || 0} 个账号吗？删除后不可恢复。`
        }
        confirmText="删除"
        confirmVariant="destructive"
        onConfirm={handleConfirmDelete}
      />
      <Dialog
        open={Boolean(sortDialogState)}
        onOpenChange={(open) => {
          if (!open && !isUpdatingSortAccountId) {
            setSortDialogState(null);
          }
        }}
      >
        <DialogContent className="glass-card border-none sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>编辑账号顺序</DialogTitle>
            <DialogDescription>
              {sortDialogState
                ? `修改 ${sortDialogState.accountName} 的排序值。值越小越靠前。`
                : "修改账号的排序值。"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="account-sort-input">顺序值</Label>
            <Input
              id="account-sort-input"
              type="number"
              min={0}
              step={1}
              value={sortDraft}
              disabled={Boolean(isUpdatingSortAccountId)}
              onChange={(event) => setSortDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleConfirmSort();
                }
              }}
            />
            <p className="text-[11px] text-muted-foreground">
              仅修改当前账号的排序值，不会自动重排其它账号。
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              disabled={Boolean(isUpdatingSortAccountId)}
              onClick={() => setSortDialogState(null)}
            >
              取消
            </Button>
            <Button
              disabled={Boolean(isUpdatingSortAccountId)}
              onClick={() => void handleConfirmSort()}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
