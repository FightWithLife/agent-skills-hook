"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { serviceClient } from "@/lib/api/service-client";
import { useAppStore } from "@/lib/store/useAppStore";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  RefreshCw, 
  Trash2, 
  Search, 
  Clock,
  Zap,
  Shield
} from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function LogsPage() {
  const { serviceStatus } = useAppStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const { data: logs, isLoading } = useQuery({
    queryKey: ["logs", search, filter],
    queryFn: () => serviceClient.listRequestLogs(search, 100),
    enabled: serviceStatus.connected,
    refetchInterval: 5000,
  });

  const clearMutation = useMutation({
    mutationFn: () => serviceClient.clearRequestLogs(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logs"] });
      toast.success("日志已清空");
    },
  });

  const filteredLogs = (logs as any[])?.filter((log: any) => {
    if (filter === "all") return true;
    if (filter === "2xx") return log.status >= 200 && log.status < 300;
    if (filter === "4xx") return log.status >= 400 && log.status < 500;
    if (filter === "5xx") return log.status >= 500;
    return true;
  }) || [];

  const getStatusBadge = (status: number) => {
    if (status >= 200 && status < 300) return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">{status}</Badge>;
    if (status >= 400 && status < 500) return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">{status}</Badge>;
    return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">{status}</Badge>;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索方法、路径或密钥..."
              className="pl-9 h-10 glass-card"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex border rounded-lg p-1 bg-muted/30">
            {["all", "2xx", "4xx", "5xx"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1 text-[10px] font-bold rounded-md transition-all",
                  filter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"
                )}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="glass-card" onClick={() => queryClient.invalidateQueries({ queryKey: ["logs"] })}>
            <RefreshCw className="h-4 w-4 mr-2" /> 刷新
          </Button>
          <Button variant="destructive" size="sm" onClick={() => clearMutation.mutate()}>
            <Trash2 className="h-4 w-4 mr-2" /> 清空日志
          </Button>
        </div>
      </div>

      <Card className="border-none glass-card shadow-xl backdrop-blur-md overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[160px]">时间</TableHead>
                <TableHead>方法 / 路径</TableHead>
                <TableHead>账号 / 密钥</TableHead>
                <TableHead>模型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>耗时</TableHead>
                <TableHead>令牌</TableHead>
                <TableHead>上游 / 错误</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-12 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-48 text-center text-muted-foreground">
                    {!serviceStatus.connected ? "服务未连接，无法获取日志" : "暂无请求日志"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log: any) => (
                  <TableRow key={log.id} className="text-[11px] group hover:bg-muted/30">
                    <TableCell className="text-muted-foreground font-mono">
                      {(() => {
                        try {
                          const date = new Date(log.timestamp);
                          if (isNaN(date.getTime())) return "未知时间";
                          return format(date, "MM/dd HH:mm:ss");
                        } catch {
                          return "格式错误";
                        }
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-primary">{log.method}</span>
                        <span className="text-muted-foreground truncate max-w-[150px]">{log.path}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5 opacity-80">
                        <div className="flex items-center gap-1">
                          <Zap className="h-3 w-3 text-yellow-500" />
                          <span className="truncate max-w-[120px]">{log.account_name || "默认账号"}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                          <Shield className="h-2.5 w-2.5" />
                          <span className="font-mono">{log.api_key_id ? `gk_${log.api_key_id.slice(0, 6)}` : "-"}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal text-[9px] bg-accent/30">{log.model || "-"}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                    <TableCell>
                       <div className="flex items-center gap-1 font-mono text-primary font-medium">
                         <Clock className="h-3 w-3" />
                         {log.latency_ms ? `${log.latency_ms}ms` : "-"}
                       </div>
                    </TableCell>
                    <TableCell>
                       <div className="flex flex-col text-[9px] text-muted-foreground">
                         <span>总 {log.total_tokens?.toLocaleString() || 0}</span>
                         <span className="opacity-60">缓存 {log.cached_tokens?.toLocaleString() || 0}</span>
                       </div>
                    </TableCell>
                    <TableCell className={cn("max-w-[200px] truncate font-medium", log.error ? "text-red-400" : "text-muted-foreground")} title={log.error}>
                      {log.error || "默认"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
