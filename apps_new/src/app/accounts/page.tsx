"use client";

import { useState, useMemo } from "react";
import { useAccounts } from "@/hooks/useAccounts";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  RefreshCw, 
  Search, 
  MoreVertical, 
  Trash2, 
  ExternalLink,
  FolderOpen,
  ArrowUpDown,
  Clock,
  Calendar,
  BarChart3
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { AddAccountModal } from "@/components/modals/add-account-modal";
import UsageModal from "@/components/modals/usage-modal";
import { cn } from "@/lib/utils";
import { Account } from "@/types";

type StatusFilter = "all" | "available" | "low_quota";

function QuotaProgress({ label, used, total, icon: Icon }: { label: string, used: number, total: number, icon: any }) {
  const percentage = total > 0 ? Math.min(Math.round((used / total) * 100), 100) : 0;
  const remaining = Math.max(total - used, 0);
  
  return (
    <div className="flex flex-col gap-1 min-w-[100px]">
      <div className="flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Icon className="h-3 w-3" />
          <span>{label}</span>
        </div>
        <span className="font-medium">{remaining}/{total}</span>
      </div>
      <Progress value={percentage} className="h-1.5" />
    </div>
  );
}

export default function AccountsPage() {
  const { accounts, groups, isLoading, refreshAccount, deleteAccount, deleteUnavailableFree, importByDirectory, isRefreshing } = useAccounts();
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("ALL_GROUPS");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [pageSize, setPageSize] = useState("20");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Modals
  const [addAccountModalOpen, setAddAccountModalOpen] = useState(false);
  const [usageModalOpen, setUsageModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  const filteredAccounts = useMemo(() => {
    return accounts.filter(acc => {
      const matchSearch = !search || 
        acc.name.toLowerCase().includes(search.toLowerCase()) ||
        acc.id.toLowerCase().includes(search.toLowerCase());
      const matchGroup = groupFilter === "ALL_GROUPS" || (acc.group || "默认") === groupFilter;
      const matchStatus = statusFilter === "all" || 
        (statusFilter === "available" && acc.is_available) ||
        (statusFilter === "low_quota" && acc.is_low_quota);
      return matchSearch && matchGroup && matchStatus;
    });
  }, [accounts, search, groupFilter, statusFilter]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev => prev.length === filteredAccounts.length ? [] : filteredAccounts.map(a => a.id));
  };

  const openUsage = (account: Account) => {
    setSelectedAccount(account);
    setUsageModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索账号名 / 编号..."
                className="pl-9 h-10 bg-card/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={groupFilter} onValueChange={(val) => val && setGroupFilter(val)}>
              <SelectTrigger className="w-[160px] h-10 bg-card/50">
                <SelectValue placeholder="全部分组" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL_GROUPS">全部分组 ({accounts.length})</SelectItem>
                {groups.map(g => (
                  <SelectItem key={g.label} value={g.label}>{g.label} ({g.count})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center rounded-lg border bg-muted/30 p-1">
              {["all", "available", "low_quota"].map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f as StatusFilter)}
                  className={cn(
                    "px-4 py-1.5 text-xs font-medium rounded-md transition-all",
                    statusFilter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f === "all" ? "全部" : f === "available" ? "可用" : "低配额"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="outline" className="gap-2 h-10" nativeButton={false}>
                  账号操作 <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setAddAccountModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> 添加账号
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => importByDirectory()}>
                  <FolderOpen className="h-4 w-4 mr-2" /> 按文件夹导入
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-primary">
                  <RefreshCw className="h-4 w-4 mr-2" /> 刷新所有账号
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={selectedIds.length === 0} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" /> 删除选中账号
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => deleteUnavailableFree()} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" /> 一键清理不可用免费
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button className="gap-2 h-10 shadow-lg shadow-primary/20">
              <RefreshCw className="h-4 w-4" /> 刷新所有
            </Button>
          </div>
        </div>
      </div>

      <Card className="border-none bg-card/50 shadow-xl backdrop-blur-md overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-12 text-center">
                  <Checkbox 
                    checked={filteredAccounts.length > 0 && selectedIds.length === filteredAccounts.length}
                    onCheckedChange={toggleSelectAll}
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
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24 mx-auto" /></TableCell>
                  </TableRow>
                ))
              ) : (
                filteredAccounts.map((account) => (
                  <TableRow key={account.id} className="group transition-colors hover:bg-muted/30">
                    <TableCell className="text-center">
                      <Checkbox 
                        checked={selectedIds.includes(account.id)}
                        onCheckedChange={() => toggleSelect(account.id)}
                      />
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <div className="flex flex-col overflow-hidden">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="font-semibold text-sm truncate">{account.name}</span>
                          <Badge variant="secondary" className="text-[9px] px-1.5 h-4 bg-accent/50 shrink-0">{account.group || "默认"}</Badge>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono opacity-60 uppercase truncate">{account.id.slice(0, 16)}...</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <QuotaProgress 
                        label="5小时" 
                        used={account.usage?.used || 0} 
                        total={account.usage?.total || 0} 
                        icon={Clock} 
                      />
                    </TableCell>
                    <TableCell>
                      <QuotaProgress 
                        label="7天" 
                        used={account.usage?.used || 0} 
                        total={account.usage?.total || 0} 
                        icon={Calendar} 
                      />
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-mono bg-muted/50 px-2 py-0.5 rounded">{account.priority || 0}</span>
                    </TableCell>
                    <TableCell>
                      {account.is_available ? (
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                          <span className="text-[11px] text-green-600 font-medium">可用</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                          <span className="text-[11px] text-red-600 font-medium">不可用</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="table-action-cell gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors"
                          onClick={() => openUsage(account)}
                          title="用量查询"
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors"
                          onClick={() => refreshAccount(account.id)}
                          title="立即刷新"
                        >
                          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger>
                            <Button variant="ghost" size="icon" className="h-8 w-8" nativeButton={false}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="gap-2">
                              <ExternalLink className="h-4 w-4" /> 详情
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 text-red-500" onClick={() => deleteAccount(account.id)}>
                              <Trash2 className="h-4 w-4" /> 删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <div className="flex items-center justify-between px-2">
        <div className="text-xs text-muted-foreground">
          共 {filteredAccounts.length} 个账号 {selectedIds.length > 0 && <span className="text-primary ml-1">(已选择 {selectedIds.length} 个)</span>}
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">每页显示</span>
            <Select value={pageSize} onValueChange={(val) => val && setPageSize(val)}>
              <SelectTrigger className="h-8 w-[70px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["5", "10", "20", "50", "100", "500"].map(v => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
             <Button variant="outline" size="sm" className="h-8 px-3 text-xs" disabled>上一页</Button>
             <div className="text-xs font-medium min-w-[60px] text-center">第 1 / 1 页</div>
             <Button variant="outline" size="sm" className="h-8 px-3 text-xs" disabled>下一页</Button>
          </div>
        </div>
      </div>

      <AddAccountModal open={addAccountModalOpen} onOpenChange={setAddAccountModalOpen} />
      <UsageModal 
        account={selectedAccount} 
        open={usageModalOpen} 
        onOpenChange={setUsageModalOpen} 
        onRefresh={refreshAccount}
        isRefreshing={isRefreshing}
      />
    </div>
  );
}
