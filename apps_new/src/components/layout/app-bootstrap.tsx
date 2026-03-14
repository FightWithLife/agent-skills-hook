"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store/useAppStore";
import { serviceClient } from "@/lib/api/service-client";
import { appClient } from "@/lib/api/app-client";
import { isTauriRuntime } from "@/lib/api/transport";
import { Button } from "@/components/ui/button";
import {
  formatServiceError,
  isExpectedInitializeResult,
  normalizeServiceAddr,
} from "@/lib/utils/service";

const DEFAULT_SERVICE_ADDR = "localhost:48760";
const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export function AppBootstrap({ children }: { children: React.ReactNode }) {
  const { setServiceStatus, setAppSettings, serviceStatus } = useAppStore();
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyLowTransparency = (enabled: boolean) => {
    if (enabled) {
      document.body.classList.add("low-transparency");
    } else {
      document.body.classList.remove("low-transparency");
    }
  };

  const initializeService = useCallback(async (addr: string, retries = 0) => {
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const initializeResult = await serviceClient.initialize();
        if (!isExpectedInitializeResult(initializeResult)) {
          throw new Error("Port is in use or unexpected service responded (missing server_name)");
        }
        return initializeResult;
      } catch (serviceError: unknown) {
        lastError = serviceError;
        if (attempt < retries) {
          await sleep(300);
        }
      }
    }

    throw lastError || new Error(`服务初始化失败: ${addr}`);
  }, []);

  const startAndInitializeService = useCallback(
    async (addr: string) => {
      await serviceClient.start(addr);
      return initializeService(addr, 2);
    },
    [initializeService]
  );

  const init = useCallback(async () => {
    if (!isTauriRuntime()) {
      setIsInitializing(false);
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      const settings = await appClient.getSettings();
      const addr = normalizeServiceAddr(settings.serviceAddr || DEFAULT_SERVICE_ADDR);
      setAppSettings(settings);
      setServiceStatus({ addr, connected: false, version: "" });
      applyLowTransparency(settings.lowTransparency);

      try {
        let initializeResult;
        try {
          initializeResult = await initializeService(addr, 1);
        } catch {
          initializeResult = await startAndInitializeService(addr);
        }
        setServiceStatus({
          addr,
          connected: true,
          version: initializeResult.version,
        });
        setIsInitializing(false);
      } catch (serviceError: unknown) {
        setServiceStatus({ addr, connected: false, version: "" });
        setError(formatServiceError(serviceError));
        setIsInitializing(false);
      }
    } catch (appError: unknown) {
      setError(appError instanceof Error ? appError.message : String(appError));
      setIsInitializing(false);
    }
  }, [initializeService, setAppSettings, setServiceStatus, startAndInitializeService]);

  const handleForceStart = async () => {
    setIsInitializing(true);
    setError(null);
    try {
      const addr = normalizeServiceAddr(serviceStatus.addr || DEFAULT_SERVICE_ADDR);
      const settings = await appClient.setSettings({ serviceAddr: addr });
      setAppSettings(settings);
      const initializeResult = await startAndInitializeService(addr);
      setServiceStatus({
        addr,
        connected: true,
        version: initializeResult.version,
      });
      applyLowTransparency(settings.lowTransparency);
      setIsInitializing(false);
      toast.success("服务已启动");
    } catch (startError: unknown) {
      setServiceStatus({ connected: false, version: "" });
      setError(formatServiceError(startError));
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    void init();
  }, [init]);

  if (isInitializing || error) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
        <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-3xl glass-card p-10 shadow-2xl animate-in fade-in zoom-in duration-500">
          {!error ? (
            <>
              <div className="h-14 w-14 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <div className="flex flex-col items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight">正在准备环境</h2>
                <p className="px-4 text-center text-sm text-muted-foreground">
                  正在同步本地配置，请稍候...
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <div className="flex flex-col items-center gap-2 text-center">
                <h2 className="text-xl font-bold tracking-tight text-destructive">
                  无法同步核心服务状态
                </h2>
                <p className="max-h-32 overflow-y-auto break-all rounded-lg bg-muted/50 p-3 font-mono text-[10px] text-muted-foreground">
                  {error}
                </p>
              </div>
              <div className="grid w-full grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => void init()} className="h-11 gap-2">
                  <RefreshCw className="h-4 w-4" /> 重试
                </Button>
                <Button onClick={handleForceStart} className="h-11 gap-2 bg-primary">
                  <Play className="h-4 w-4" /> 强制启动
                </Button>
              </div>
              <p className="text-center text-[10px] text-muted-foreground">
                如果服务未运行，请点击“强制启动”。
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
