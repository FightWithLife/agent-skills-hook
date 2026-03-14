"use client";

import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle
} from "@/components/ui/dialog";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { accountClient } from "@/lib/api/account-client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { FileUp, Info, LogIn, Clipboard, ExternalLink, Hash } from "lucide-react";

interface AddAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddAccountModal({ open, onOpenChange }: AddAccountModalProps) {
  const [activeTab, setActiveTab] = useState("login");
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  // Login Form
  const [tags, setTags] = useState("");
  const [note, setNote] = useState("");
  const [group, setGroup] = useState("");
  const [loginUrl, setLoginUrl] = useState("");
  const [manualCallback, setManualCallback] = useState("");

  // Bulk Import
  const [bulkContent, setBulkContent] = useState("");

  const handleStartLogin = async () => {
    setIsLoading(true);
    try {
      const result = await accountClient.startLogin({
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
        note,
        group: group || null,
      });
      setLoginUrl(result.authUrl);
      if (result.warning) {
        toast.warning(result.warning);
      }
      toast.success("已生成登录链接，请在浏览器中完成授权");
    } catch (err: unknown) {
      toast.error(`启动登录失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualCallback = async () => {
    if (!manualCallback) {
      toast.error("请先粘贴回调链接");
      return;
    }
    setIsLoading(true);
    try {
      const url = new URL(manualCallback);
      const state = url.searchParams.get("state") || "";
      const code = url.searchParams.get("code") || "";
      const redirectUri = `${url.origin}${url.pathname}`;
      
      await accountClient.completeLogin(state, code, redirectUri);
      toast.success("登录回调解析成功");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["usage"] }),
        queryClient.invalidateQueries({ queryKey: ["startup-snapshot"] }),
      ]);
      onOpenChange(false);
      setManualCallback("");
    } catch (err: unknown) {
      toast.error(`解析失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkImport = async () => {
    if (!bulkContent.trim()) return;
    setIsLoading(true);
    try {
      const lines = bulkContent.split("\n").filter(l => l.trim());
      await accountClient.import(lines);
      toast.success(`成功导入 ${lines.length} 个账号内容`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["usage"] }),
        queryClient.invalidateQueries({ queryKey: ["startup-snapshot"] }),
      ]);
      onOpenChange(false);
      setBulkContent("");
    } catch (err: unknown) {
      toast.error(`导入失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const copyUrl = () => {
    if (!loginUrl) return;
    navigator.clipboard.writeText(loginUrl);
    toast.success("链接已复制");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden glass-card border-none">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-6 pt-6 bg-muted/20">
            <DialogHeader className="mb-4">
              <DialogTitle className="flex items-center gap-2">
                <LogIn className="h-5 w-5 text-primary" />
                新增账号
              </DialogTitle>
              <DialogDescription>
                通过登录授权或批量导入文本内容来添加账号。
              </DialogDescription>
            </DialogHeader>
            <TabsList className="grid w-full grid-cols-2 h-10 mb-0">
              <TabsTrigger value="login" className="gap-2">
                <LogIn className="h-3.5 w-3.5" /> 登录授权
              </TabsTrigger>
              <TabsTrigger value="bulk" className="gap-2">
                <FileUp className="h-3.5 w-3.5" /> 批量导入
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-6">
            <TabsContent value="login" className="mt-0 space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>标签 (逗号分隔)</Label>
                  <Input placeholder="例如：高频, 团队A" value={tags} onChange={e => setTags(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>分组</Label>
                  <Select value={group} onValueChange={(val) => val && setGroup(val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择分组" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TEAM">团队 (TEAM)</SelectItem>
                      <SelectItem value="PERSONAL">个人 (PERSONAL)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>备注/描述</Label>
                <Input placeholder="例如：主号 / 测试号" value={note} onChange={e => setNote(e.target.value)} />
              </div>

              <div className="pt-2">
                <Button onClick={handleStartLogin} disabled={isLoading} className="w-full gap-2">
                  <ExternalLink className="h-4 w-4" /> 登录授权
                </Button>
                {loginUrl && (
                  <div className="mt-3 p-2 rounded-lg bg-primary/5 border border-primary/10 flex items-center gap-2 animate-in fade-in zoom-in duration-300">
                    <Input value={loginUrl} readOnly className="font-mono text-[10px] h-8 border-none bg-transparent" />
                    <Button variant="ghost" size="sm" onClick={copyUrl} className="h-8 w-8 p-0">
                      <Clipboard className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-4 border-t">
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">
                    <Hash className="h-3 w-3" /> 手动解析回调 (当本地 48760 端口占用时)
                  </Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="粘贴浏览器跳转后的完整回调 URL (包含 state 和 code)" 
                      value={manualCallback}
                      onChange={e => setManualCallback(e.target.value)}
                      className="font-mono text-[10px] h-9" 
                    />
                    <Button 
                      variant="secondary" 
                      onClick={handleManualCallback} 
                      disabled={isLoading} 
                      className="h-9 px-4 shrink-0"
                    >
                      解析
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="bulk" className="mt-0 space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-2">
                <Label>账号数据 (每行一个)</Label>
                <Textarea 
                  placeholder="粘贴账号数据，例如 Refresh Token 或 Access Token..."
                  className="min-h-[250px] font-mono text-[10px]"
                  value={bulkContent}
                  onChange={(e) => setBulkContent(e.target.value)}
                />
              </div>
              <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-3 text-[10px] text-blue-600 dark:text-blue-400 leading-relaxed">
                <Info className="h-3.5 w-3.5 inline-block mr-1.5 -mt-0.5" />
                支持格式：ChatGPT 账号（Refresh Token）、 Claude Session 等。系统将自动识别格式并导入。
              </div>
              <Button onClick={handleBulkImport} disabled={isLoading} className="w-full">
                开始导入
              </Button>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
