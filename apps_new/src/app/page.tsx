"use client";

import { useDashboardStats } from "@/hooks/useDashboardStats";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Users, 
  CheckCircle2, 
  XCircle, 
  Zap, 
  Database, 
  BrainCircuit, 
  DollarSign, 
  PieChart,
  Activity
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

function formatNumberWithUnit(value: number | string | undefined): string {
  const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
  if (num === undefined || isNaN(num)) return "0";
  
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(2).replace(/\.00$/, '') + "B";
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2).replace(/\.00$/, '') + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(2).replace(/\.00$/, '') + "K";
  }
  return num.toString();
}

function StatProgressCard({ title, value, total, icon: Icon, color, sub }: { title: string, value: number, total: number, icon: any, color: string, sub: string }) {
  const percentage = total > 0 ? Math.min(Math.round((value / total) * 100), 100) : 0;
  
  return (
    <Card className="overflow-hidden glass-card border-none shadow-md backdrop-blur-md transition-all hover:scale-[1.02]">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn("h-4 w-4", color)} />
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">占比</span>
            <span className="font-mono font-medium">{percentage}%</span>
          </div>
          <Progress value={percentage} className="h-1.5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { stats, isLoading } = useDashboardStats();

  const parsePercentage = (val: any) => {
    if (typeof val === 'number') return val;
    if (typeof val !== 'string') return 0;
    const match = val.match(/(\d+)%/);
    return match ? parseInt(match[1]) : 0;
  };

  const poolPrimary = parsePercentage(stats.poolRemain?.primary);
  const poolSecondary = parsePercentage(stats.poolRemain?.secondary);

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-2xl" />
          ))
        ) : (
          <>
            <Card className="overflow-hidden glass-card border-none shadow-md backdrop-blur-md transition-all hover:scale-[1.02]">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">总账号数</CardTitle>
                <Users className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-[10px] text-muted-foreground mt-1">池中所有配置账号</p>
                <div className="mt-4 flex items-center gap-2 text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 w-fit px-2 py-0.5 rounded-full">
                  <Activity className="h-3 w-3" /> 系统运行正常
                </div>
              </CardContent>
            </Card>

            <StatProgressCard 
              title="可用账号" 
              value={stats.available} 
              total={stats.total} 
              icon={CheckCircle2} 
              color="text-green-500" 
              sub="当前健康可调用的账号" 
            />

            <StatProgressCard 
              title="不可用账号" 
              value={stats.unavailable} 
              total={stats.total} 
              icon={XCircle} 
              color="text-red-500" 
              sub="额度耗尽或授权失效" 
            />

            <Card className="overflow-hidden border-none bg-primary/10 shadow-md backdrop-blur-md transition-all hover:scale-[1.02]">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-primary">账号池剩余</CardTitle>
                <PieChart className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">5小时内</span>
                    <span className="font-bold">{stats.poolRemain?.primary || "--"}</span>
                  </div>
                  <Progress value={poolPrimary} className="h-1.5 bg-primary/20" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">7天内</span>
                    <span className="font-bold">{stats.poolRemain?.secondary || "--"}</span>
                  </div>
                  <Progress value={poolSecondary} className="h-1.5 bg-primary/20" />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "今日令牌", value: stats.todayTokens, icon: Zap, color: "text-yellow-500", sub: "输入 + 输出合计" },
          { title: "缓存令牌", value: stats.cachedTokens, icon: Database, color: "text-indigo-500", sub: "上下文缓存命中" },
          { title: "推理令牌", value: stats.reasoningTokens, icon: BrainCircuit, color: "text-purple-500", sub: "大模型思考过程" },
          { title: "预计费用", value: `$${Number(stats.todayCost || 0).toFixed(2)}`, icon: DollarSign, color: "text-emerald-500", sub: "按官价估算", isCurrency: true },
        ].map((card, i) => (
          <Card key={i} className="overflow-hidden glass-card border-none shadow-md backdrop-blur-md transition-all hover:scale-[1.02]">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className={cn("h-4 w-4", card.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" title={card.value?.toLocaleString()}>
                {card.isCurrency ? card.value : formatNumberWithUnit(card.value)}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{card.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="min-h-[300px] border-none glass-card shadow-md">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">当前活跃状态</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center h-[200px] text-muted-foreground text-sm gap-2">
            <div className="p-4 rounded-full bg-accent/30 animate-pulse">
              <Activity className="h-8 w-8 opacity-20" />
            </div>
            <p>暂无活跃请求</p>
          </CardContent>
        </Card>

        <Card className="min-h-[300px] border-none glass-card shadow-md">
          <CardHeader>
            <CardTitle className="text-base font-semibold">智能推荐</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
             <div className="rounded-xl bg-primary/5 border border-dashed border-primary/20 p-6 text-center text-sm text-muted-foreground">
               <p className="leading-relaxed">基于当前配额，系统建议优先使用可用性更稳定的账号进行长文本推理任务。</p>
             </div>
             <div className="flex items-center gap-4 p-4 rounded-xl bg-accent/20">
                <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">策略生效中</p>
                  <p className="text-xs text-muted-foreground">已自动跳过 0 个低配额账号</p>
                </div>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
