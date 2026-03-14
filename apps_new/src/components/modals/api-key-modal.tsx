"use client";

import { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Key, Globe, Clipboard, ShieldCheck } from "lucide-react";
import { ApiKey } from "@/types";

interface ApiKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiKey?: ApiKey | null;
}

export function ApiKeyModal({ open, onOpenChange, apiKey }: ApiKeyModalProps) {
  const [name, setName] = useState("");
  const [protocolType, setProtocolType] = useState("openai_compat");
  const [modelSlug, setModelSlug] = useState("");
  const [reasoningEffort, setReasoningEffort] = useState("");
  const [upstreamBaseUrl, setUpstreamBaseUrl] = useState("");
  const [azureEndpoint, setAzureEndpoint] = useState("");
  const [azureApiKey, setAzureApiKey] = useState("");
  const [generatedKey, setGeneratedKey] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const { data: models } = useQuery({
    queryKey: ["apikey-models"],
    queryFn: () => accountClient.listModels(false),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;

    if (!apiKey) {
      setName("");
      setProtocolType("openai_compat");
      setModelSlug("");
      setReasoningEffort("");
      setUpstreamBaseUrl("");
      setAzureEndpoint("");
      setAzureApiKey("");
      setGeneratedKey("");
      return;
    }

    setName(apiKey.name || "");
    setProtocolType(apiKey.protocol || "openai_compat");
    setModelSlug(apiKey.modelSlug || "");
    setReasoningEffort(apiKey.reasoningEffort || "");
    setGeneratedKey("");

    if (apiKey.protocol === "azure_openai") {
      setAzureEndpoint(apiKey.upstreamBaseUrl || "");
      try {
        const headers = apiKey.staticHeadersJson
          ? JSON.parse(apiKey.staticHeadersJson)
          : {};
        setAzureApiKey(typeof headers["api-key"] === "string" ? headers["api-key"] : "");
      } catch {
        setAzureApiKey("");
      }
      setUpstreamBaseUrl("");
    } else {
      setUpstreamBaseUrl(apiKey.upstreamBaseUrl || "");
      setAzureEndpoint("");
      setAzureApiKey("");
    }
  }, [apiKey, open]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const staticHeaders: Record<string, string> = {};
      if (protocolType === "azure_openai" && azureApiKey) {
        staticHeaders["api-key"] = azureApiKey;
      }

      const params = {
        name: name || null,
        modelSlug: modelSlug || null,
        reasoningEffort: reasoningEffort || null,
        protocolType,
        upstreamBaseUrl: protocolType === "azure_openai" ? azureEndpoint : (upstreamBaseUrl || null),
        staticHeadersJson: Object.keys(staticHeaders).length > 0 ? JSON.stringify(staticHeaders) : null,
      };

      if (apiKey?.id) {
        await accountClient.updateApiKey(apiKey.id, params);
        toast.success("密钥配置已更新");
      } else {
        const result = await accountClient.createApiKey(params);
        setGeneratedKey(result.key);
        toast.success("平台密钥已创建");
      }
      
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["apikeys"] }),
        queryClient.invalidateQueries({ queryKey: ["apikey-models"] }),
        queryClient.invalidateQueries({ queryKey: ["startup-snapshot"] }),
      ]);
      if (apiKey?.id) onOpenChange(false);
    } catch (err: unknown) {
      toast.error(`操作失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(generatedKey);
    toast.success("密钥已复制");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] glass-card border-none">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-primary/10">
              <Key className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>{apiKey?.id ? "编辑平台密钥" : "创建平台密钥"}</DialogTitle>
          </div>
          <DialogDescription>
            配置网关访问凭据，您可以绑定特定模型、推理等级或自定义上游。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">密钥名称 (可选)</Label>
            <Input 
              id="name"
              placeholder="例如：主机房 / 测试"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>协议类型</Label>
              <Select value={protocolType} onValueChange={(val) => val && setProtocolType(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai_compat">OpenAI 兼容</SelectItem>
                  <SelectItem value="azure_openai">Azure OpenAI</SelectItem>
                  <SelectItem value="anthropic_native">Claude Code 兼容</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>绑定模型 (可选)</Label>
              <Select value={modelSlug} onValueChange={(val) => val && setModelSlug(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="跟随请求" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">跟随请求</SelectItem>
                  {models?.map((model) => (
                    <SelectItem key={model.slug} value={model.slug}>
                      {model.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>推理等级 (可选)</Label>
            <Select value={reasoningEffort} onValueChange={(val) => val && setReasoningEffort(val)}>
              <SelectTrigger>
                <SelectValue placeholder="跟随请求等级" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">跟随请求</SelectItem>
                <SelectItem value="low">低 (low)</SelectItem>
                <SelectItem value="medium">中 (medium)</SelectItem>
                <SelectItem value="high">高 (high)</SelectItem>
                <SelectItem value="xhigh">极高 (xhigh)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {protocolType === "azure_openai" ? (
            <div className="grid gap-4 p-4 rounded-xl bg-accent/20 border border-primary/10">
               <div className="grid gap-2">
                <Label className="text-xs">Azure 接入地址</Label>
                <Input 
                  placeholder="https://your-resource.openai.azure.com"
                  value={azureEndpoint}
                  onChange={(e) => setAzureEndpoint(e.target.value)}
                  className="h-9 font-mono text-xs"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs">Azure 接口密钥</Label>
                <Input 
                  type="password"
                  placeholder="your-azure-key"
                  value={azureApiKey}
                  onChange={(e) => setAzureApiKey(e.target.value)}
                  className="h-9 font-mono text-xs"
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-2">
              <Label className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5" /> 自定义上游 Base URL (可选)
              </Label>
              <Input 
                placeholder="https://api.openai.com/v1"
                value={upstreamBaseUrl}
                onChange={(e) => setUpstreamBaseUrl(e.target.value)}
              />
            </div>
          )}

          {generatedKey && (
            <div className="space-y-2 pt-4 border-t">
              <Label className="text-xs text-primary flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> 平台密钥已生成
              </Label>
              <div className="flex gap-2">
                <Input value={generatedKey} readOnly className="font-mono text-sm bg-primary/5" />
                <Button variant="outline" onClick={copyKey}>
                  <Clipboard className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {generatedKey ? "关闭" : "取消"}
          </Button>
          {!generatedKey && (
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? "保存中..." : "完成"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
