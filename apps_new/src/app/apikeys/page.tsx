"use client";

import { useApiKeys } from "@/hooks/useApiKeys";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Card, 
  CardContent 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  RefreshCw, 
  Trash2, 
  Copy, 
  Eye, 
  EyeOff, 
  MoreVertical,
  Settings2
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { ApiKeyModal } from "@/components/modals/api-key-modal";

export default function ApiKeysPage() {
  const { apiKeys, isLoading, deleteApiKey, toggleApiKeyStatus, isToggling } = useApiKeys();
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [editingKeyId, setEditingKeyId] = useState<string | undefined>();

  const openCreateModal = () => {
    setEditingKeyId(undefined);
    setApiKeyModalOpen(true);
  };

  const openEditModal = (id: string) => {
    setEditingKeyId(id);
    setApiKeyModalOpen(true);
  };

  const toggleSecret = (id: string) => {
    setShowSecrets(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("已复制到剪贴板");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">平台密钥</h2>
          <p className="text-sm text-muted-foreground mt-1">创建和管理网关调用所需的访问令牌</p>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" className="gap-2 h-10 glass-card">
            <RefreshCw className="h-4 w-4" /> 刷新模型
          </Button>
          <Button className="gap-2 h-10 shadow-lg shadow-primary/20" onClick={openCreateModal}>
            <Plus className="h-4 w-4" /> 创建密钥
          </Button>
        </div>
      </div>

      <Card className="border-none glass-card shadow-xl backdrop-blur-md overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>密钥编号 / ID</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>协议</TableHead>
                <TableHead>绑定模型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-8 w-8 mx-auto" /></TableCell>
                  </TableRow>
                ))
              ) : apiKeys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                      <Plus className="h-8 w-8 opacity-20" />
                      <p>暂无平台密钥，点击右上角创建</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                apiKeys.map((key) => (
                  <TableRow key={key.id} className="group transition-colors hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-[10px] font-mono bg-muted/50 px-2 py-1 rounded border border-primary/5 text-primary">
                          {showSecrets[key.id] ? key.id : `${key.id.slice(0, 8)}...`}
                        </code>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-muted-foreground hover:text-primary" 
                          onClick={() => toggleSecret(key.id)}
                        >
                          {showSecrets[key.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-muted-foreground hover:text-primary" 
                          onClick={() => copyToClipboard(key.id)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-sm">{key.name || "未命名"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal capitalize text-[10px] bg-accent/20">
                        {key.protocol.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-medium">
                      {key.model || "跟随请求"}
                    </TableCell>
                    <TableCell>
                       <div className="flex items-center gap-2">
                         <Switch 
                           className="scale-75"
                           checked={key.status === "active"} 
                           disabled={isToggling}
                           onCheckedChange={(enabled) => toggleApiKeyStatus({ id: key.id, enabled })}
                         />
                         <span className="text-[10px] font-medium text-muted-foreground">
                           {key.status === "active" ? "启用" : "禁用"}
                         </span>
                       </div>
                    </TableCell>
                    <TableCell>
                       <div className="table-action-cell gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors"
                            onClick={() => openEditModal(key.id)}
                            title="编辑配置"
                          >
                            <Settings2 className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger>
                              <Button variant="ghost" size="icon" className="h-8 w-8" nativeButton={false}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem className="gap-2" onClick={() => openEditModal(key.id)}>
                                设置模型与推理
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-2 text-red-500" onClick={() => deleteApiKey(key.id)}>
                                <Trash2 className="h-4 w-4" /> 删除密钥
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

      <ApiKeyModal 
        open={apiKeyModalOpen} 
        onOpenChange={setApiKeyModalOpen} 
        keyId={editingKeyId}
      />
    </div>
  );
}
