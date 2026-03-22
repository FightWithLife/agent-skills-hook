"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { appClient } from "@/lib/api/app-client";
import { getAppErrorMessage } from "@/lib/api/transport";
import { useAppStore } from "@/lib/store/useAppStore";
import { useDesktopPageActive } from "@/hooks/useDesktopPageActive";
import { useDeferredDesktopActivation } from "@/hooks/useDeferredDesktopActivation";
import { usePageTransitionReady } from "@/hooks/usePageTransitionReady";
import { useRuntimeCapabilities } from "@/hooks/useRuntimeCapabilities";
import {
  APPEARANCE_PRESETS,
  applyAppearancePreset,
  normalizeAppearancePreset,
} from "@/lib/appearance";
import { AppSettings, BackgroundTaskSettings } from "@/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AppWindow,
  Check,
  Cpu,
  Download,
  ExternalLink,
  FolderOpen,
  Globe,
  Info,
  Palette,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings as SettingsIcon,
  Variable,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ENV_DESCRIPTION_MAP: Record<string, string> = {
  CODEXMANAGER_UPSTREAM_TOTAL_TIMEOUT_MS:
    "控制单次上游请求允许持续的最长时间，单位毫秒；超过后会主动结束请求并返回超时错误。",
  CODEXMANAGER_UPSTREAM_STREAM_TIMEOUT_MS:
    "控制流式上游请求允许持续的最长时间，单位毫秒；填 0 可关闭流式超时上限。",
  CODEXMANAGER_SSE_KEEPALIVE_INTERVAL_MS:
    "控制向下游补发 SSE keep-alive 帧的间隔，单位毫秒；上游长时间安静时可避免客户端误判连接中断。",
  CODEXMANAGER_UPSTREAM_CONNECT_TIMEOUT_SECS:
    "控制连接上游服务器时的超时时间，单位秒；主要影响握手和网络建立阶段。",
  CODEXMANAGER_UPSTREAM_BASE_URL:
    "控制默认上游地址；修改后，网关会把请求转发到新的目标地址。",
};

const THEMES = [
  { id: "tech", name: "企业蓝", color: "#2563eb" },
  { id: "dark", name: "极夜黑", color: "#09090b" },
  { id: "dark-one", name: "深邃黑", color: "#282c34" },
  { id: "business", name: "事务金", color: "#c28100" },
  { id: "mint", name: "薄荷绿", color: "#059669" },
  { id: "sunset", name: "晚霞橙", color: "#ea580c" },
  { id: "grape", name: "葡萄灰紫", color: "#7c3aed" },
  { id: "ocean", name: "海湾青", color: "#0284c7" },
  { id: "forest", name: "松林绿", color: "#166534" },
  { id: "rose", name: "玫瑰粉", color: "#db2777" },
  { id: "slate", name: "石板灰", color: "#475569" },
  { id: "aurora", name: "极光青", color: "#0d9488" },
];

const ROUTE_STRATEGY_LABELS: Record<string, string> = {
  ordered: "顺序优先 (Ordered)",
  balanced: "均衡轮询 (Balanced)",
};

const SERVICE_LISTEN_MODE_LABELS: Record<string, string> = {
  loopback: "仅本机 (localhost)",
  all_interfaces: "全部网卡 (0.0.0.0)",
};

const RESIDENCY_REQUIREMENT_LABELS: Record<string, string> = {
  "": "不限制",
  us: "仅美国 (us)",
};
const EMPTY_RESIDENCY_OPTION = "__none__";

const DEFAULT_FREE_ACCOUNT_MAX_MODEL_OPTIONS = [
  "auto",
  "gpt-5",
  "gpt-5-codex",
  "gpt-5-codex-mini",
  "gpt-5.1",
  "gpt-5.1-codex",
  "gpt-5.1-codex-max",
  "gpt-5.1-codex-mini",
  "gpt-5.2",
  "gpt-5.2-codex",
  "gpt-5.3-codex",
  "gpt-5.4",
] as const;

function formatFreeAccountModelLabel(value: string | null | undefined): string {
  const normalized = String(value || "").trim();
  if (!normalized || normalized === "auto") {
    return "跟随请求";
  }
  return normalized;
}

const SETTINGS_TABS = ["general", "appearance", "gateway", "tasks", "env"] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];
const SETTINGS_ACTIVE_TAB_KEY = "codexmanager.settings.active-tab";

/** @brief 后台任务配置项及其前端最小间隔，需与后端约束保持一致以避免保存后跳值 */
const BACKGROUND_TASK_ITEMS = [
  {
    label: "用量轮询线程",
    enabledKey: "usagePollingEnabled",
    intervalKey: "usagePollIntervalSecs",
    minimum: 30,
  },
  {
    label: "网关保活线程",
    enabledKey: "gatewayKeepaliveEnabled",
    intervalKey: "gatewayKeepaliveIntervalSecs",
    minimum: 30,
  },
  {
    label: "令牌刷新轮询",
    enabledKey: "tokenRefreshPollingEnabled",
    intervalKey: "tokenRefreshPollIntervalSecs",
    minimum: 10,
  },
] as const;

function readInitialSettingsTab(): SettingsTab {
  if (typeof window === "undefined") return "general";
  const savedTab = window.sessionStorage.getItem(SETTINGS_ACTIVE_TAB_KEY);
  if (savedTab && SETTINGS_TABS.includes(savedTab as SettingsTab)) {
    return savedTab as SettingsTab;
  }
  return "general";
}

function stringifyNumber(value: number | null | undefined): string {
  return value == null ? "" : String(value);
}

function parseIntegerInput(value: string, minimum = 0): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.trunc(numeric);
  if (rounded < minimum) return null;
  return rounded;
}

function inferServiceBindPreview(addr: string, mode: string): string {
  const normalizedAddr = String(addr || "").trim() || "localhost:48760";
  const [, port = "48760"] = normalizedAddr.split(":");
  return mode === "all_interfaces" ? `0.0.0.0:${port}` : `localhost:${port}`;
}

type UpdateCheckSummary = {
  repo: string;
  mode: string;
  isPortable: boolean;
  hasUpdate: boolean;
  canPrepare: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseTag: string;
  releaseName: string;
  reason: string;
};

type UpdatePrepareSummary = {
  prepared: boolean;
  mode: string;
  isPortable: boolean;
  releaseTag: string;
  latestVersion: string;
  assetName: string;
  assetPath: string;
  downloaded: boolean;
};

type UpdateStatusSummary = {
  pending: UpdatePrepareSummary | null;
  lastCheck: UpdateCheckSummary | null;
};

type CheckUpdateRequest = {
  silent?: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readStringField(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === "string" ? value : "";
}

function readBooleanField(source: Record<string, unknown>, key: string): boolean {
  return source[key] === true;
}

function normalizeUpdateCheckSummary(payload: unknown): UpdateCheckSummary {
  const source = asRecord(payload) ?? {};
  return {
    repo: readStringField(source, "repo"),
    mode: readStringField(source, "mode"),
    isPortable: readBooleanField(source, "isPortable"),
    hasUpdate: readBooleanField(source, "hasUpdate"),
    canPrepare: readBooleanField(source, "canPrepare"),
    currentVersion: readStringField(source, "currentVersion"),
    latestVersion: readStringField(source, "latestVersion"),
    releaseTag: readStringField(source, "releaseTag"),
    releaseName: readStringField(source, "releaseName"),
    reason: readStringField(source, "reason"),
  };
}

function normalizeUpdatePrepareSummary(payload: unknown): UpdatePrepareSummary {
  const source = asRecord(payload) ?? {};
  return {
    prepared: readBooleanField(source, "prepared"),
    mode: readStringField(source, "mode"),
    isPortable: readBooleanField(source, "isPortable"),
    releaseTag: readStringField(source, "releaseTag"),
    latestVersion: readStringField(source, "latestVersion"),
    assetName: readStringField(source, "assetName"),
    assetPath: readStringField(source, "assetPath"),
    downloaded: readBooleanField(source, "downloaded"),
  };
}

function normalizePendingUpdateSummary(payload: unknown): UpdatePrepareSummary | null {
  const source = asRecord(payload);
  if (!source) {
    return null;
  }
  return {
    prepared: true,
    mode: readStringField(source, "mode"),
    isPortable: readBooleanField(source, "isPortable"),
    releaseTag: readStringField(source, "releaseTag"),
    latestVersion: readStringField(source, "latestVersion"),
    assetName: readStringField(source, "assetName"),
    assetPath: readStringField(source, "assetPath"),
    downloaded: true,
  };
}

function normalizeUpdateStatusSummary(payload: unknown): UpdateStatusSummary {
  const source = asRecord(payload) ?? {};
  return {
    pending: normalizePendingUpdateSummary(source.pending),
    lastCheck: source.lastCheck ? normalizeUpdateCheckSummary(source.lastCheck) : null,
  };
}

function buildReleaseUrl(summary: UpdateCheckSummary | null): string {
  if (!summary?.repo) {
    return "https://github.com/qxcnm/Codex-Manager/releases";
  }
  const normalizedTag = summary.releaseTag || (summary.latestVersion ? `v${summary.latestVersion}` : "");
  if (!normalizedTag) {
    return `https://github.com/${summary.repo}/releases`;
  }
  return `https://github.com/${summary.repo}/releases/tag/${normalizedTag}`;
}

export default function SettingsPage() {
  const setStoreSettings = useAppStore((state) => state.setAppSettings);
  const storedSettings = useAppStore((state) => state.appSettings);
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const {
    isDesktopRuntime,
    canAccessManagementRpc,
    canSelfUpdate,
    canOpenLocalDir,
    canCloseToTray,
  } =
    useRuntimeCapabilities();
  const isPageActive = useDesktopPageActive("/settings/");
  const isSnapshotQueryEnabled = useDeferredDesktopActivation(canAccessManagementRpc);
  const lastSyncedSnapshotThemeRef = useRef<string | null>(null);
  const lastSyncedAppearancePresetRef = useRef<string | null>(null);
  const autoUpdateCheckedRef = useRef(false);
  const manualUpdateCheckPendingRef = useRef(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>(readInitialSettingsTab);
  const [envSearch, setEnvSearch] = useState("");
  const [selectedEnvKey, setSelectedEnvKey] = useState<string | null>(null);
  const [envDrafts, setEnvDrafts] = useState<Record<string, string>>({});
  const [upstreamProxyDraft, setUpstreamProxyDraft] = useState<string | null>(null);
  const [gatewayOriginatorDraft, setGatewayOriginatorDraft] = useState<string | null>(null);
  const [gatewayUserAgentVersionDraft, setGatewayUserAgentVersionDraft] = useState<string | null>(null);
  const [lastUpdateCheck, setLastUpdateCheck] = useState<UpdateCheckSummary | null>(null);
  const [updateDialogCheck, setUpdateDialogCheck] = useState<UpdateCheckSummary | null>(null);
  const [preparedUpdate, setPreparedUpdate] = useState<UpdatePrepareSummary | null>(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [manualUpdateCheckPending, setManualUpdateCheckPending] = useState(false);
  const [transportDraft, setTransportDraft] = useState<
    Partial<Record<"sseKeepaliveIntervalMs" | "upstreamStreamTimeoutMs", string>>
  >({});
  const [backgroundTaskDraft, setBackgroundTaskDraft] = useState<Record<string, string>>({});

  const { data: fetchedSnapshot, isError: isSnapshotError } = useQuery({
    queryKey: ["app-settings-snapshot"],
    queryFn: () => appClient.getSettings(),
    enabled: isSnapshotQueryEnabled && isPageActive,
  });
  const snapshot = fetchedSnapshot ?? storedSettings;
  usePageTransitionReady(
    "/settings/",
    !canAccessManagementRpc || Boolean(snapshot) || isSnapshotError,
  );

  const updateSettings = useMutation({
    mutationFn: (patch: Partial<AppSettings> & { _silent?: boolean }) => {
      const actualPatch = { ...patch };
      delete actualPatch._silent;
      return appClient.setSettings(actualPatch);
    },
    onSuccess: (nextSnapshot, variables) => {
      queryClient.setQueryData(["app-settings-snapshot"], nextSnapshot);
      setStoreSettings(nextSnapshot);
      if (nextSnapshot.lowTransparency) {
        document.body.classList.add("low-transparency");
      } else {
        document.body.classList.remove("low-transparency");
      }
      applyAppearancePreset(nextSnapshot.appearancePreset);
      if (!variables._silent) {
        toast.success("设置已更新");
      }
    },
    onError: (error: unknown) => {
      toast.error(`更新失败: ${getAppErrorMessage(error)}`);
    },
  });

  const checkUpdate = useMutation({
    mutationFn: (request?: CheckUpdateRequest) => {
      void request;
      return appClient.checkUpdate();
    },
    onSuccess: (result, request) => {
      const summary = normalizeUpdateCheckSummary(result);
      setLastUpdateCheck(summary);
      setUpdateDialogCheck(summary);
      if (summary.hasUpdate) {
        setPreparedUpdate((current) =>
          current && current.latestVersion === summary.latestVersion ? current : null
        );
        if (!request?.silent) {
          toast.success(`发现新版本 ${summary.latestVersion || summary.releaseTag || "可用"}，可立即下载更新`);
        }
        return;
      }
      setPreparedUpdate(null);
      setUpdateDialogOpen(false);
      if (!request?.silent) {
        toast.success(
          summary.reason
            ? `已检查更新：${summary.reason}`
            : `当前已是最新版本 ${summary.currentVersion || ""}`.trim()
        );
      }
    },
    onError: (error: unknown) => {
      toast.error(`检查更新失败: ${getAppErrorMessage(error)}`);
    },
    onSettled: () => {
      if (manualUpdateCheckPendingRef.current) {
        manualUpdateCheckPendingRef.current = false;
        setManualUpdateCheckPending(false);
      }
    },
  });

  const prepareUpdate = useMutation({
    mutationFn: () => appClient.prepareUpdate(),
    onSuccess: (result) => {
      const summary = normalizeUpdatePrepareSummary(result);
      setPreparedUpdate(summary);
      setUpdateDialogOpen(true);
      toast.success(
        summary.isPortable
          ? `更新已下载完成，确认后即可替换到 ${summary.latestVersion || "新版本"}`
          : `更新包已下载完成，确认后开始替换到 ${summary.latestVersion || "新版本"}`
      );
    },
    onError: (error: unknown) => {
      toast.error(`下载更新失败: ${getAppErrorMessage(error)}`);
    },
  });

  const applyPreparedUpdate = useMutation({
    mutationFn: (payload: { isPortable: boolean }) =>
      payload.isPortable ? appClient.applyUpdatePortable() : appClient.launchInstaller(),
    onSuccess: (result, payload) => {
      setPreparedUpdate(null);
      setLastUpdateCheck(null);
      setUpdateDialogCheck(null);
      setUpdateDialogOpen(false);
      const message = readStringField(asRecord(result) ?? {}, "message");
      toast.success(message || (payload.isPortable ? "即将重启并替换更新" : "已开始替换更新流程"));
    },
    onError: (error: unknown, payload) => {
      toast.error(
        `${payload.isPortable ? "替换更新" : "启动安装程序"}失败: ${getAppErrorMessage(error)}`
      );
    },
  });

  useEffect(() => {
    if (!isDesktopRuntime) {
      return;
    }

    let cancelled = false;
    void appClient
      .getStatus()
      .then((result) => {
        if (cancelled) {
          return;
        }
        const summary = normalizeUpdateStatusSummary(result);
        if (summary.lastCheck) {
          setLastUpdateCheck(summary.lastCheck);
          setUpdateDialogCheck(summary.lastCheck);
        }
        if (summary.pending) {
          setPreparedUpdate(summary.pending);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [isDesktopRuntime]);

  useEffect(() => {
    if (!snapshot?.theme) return;
    if (lastSyncedSnapshotThemeRef.current === snapshot.theme) return;

    lastSyncedSnapshotThemeRef.current = snapshot.theme;
    const currentAppliedTheme =
      typeof document !== "undefined"
        ? document.documentElement.getAttribute("data-theme")
        : null;

    if (snapshot.theme !== currentAppliedTheme) {
      setTheme(snapshot.theme);
    }
  }, [setTheme, snapshot?.theme]);

  useEffect(() => {
    if (!snapshot) return;
    const nextPreset = normalizeAppearancePreset(snapshot.appearancePreset);
    if (lastSyncedAppearancePresetRef.current === nextPreset) return;

    lastSyncedAppearancePresetRef.current = nextPreset;
    applyAppearancePreset(nextPreset);
  }, [snapshot]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(SETTINGS_ACTIVE_TAB_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (isPageActive) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      setUpdateDialogOpen(false);
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isPageActive]);

  useEffect(() => {
    if (!isDesktopRuntime || !snapshot?.updateAutoCheck || autoUpdateCheckedRef.current) {
      return;
    }
    autoUpdateCheckedRef.current = true;
    checkUpdate.mutate({ silent: true });
  }, [checkUpdate, isDesktopRuntime, snapshot?.updateAutoCheck]);

  const handleOpenReleasePage = () => {
    void appClient
      .openInBrowser(buildReleaseUrl(updateDialogCheck ?? lastUpdateCheck))
      .catch((error) => {
        toast.error(`打开发布页失败: ${getAppErrorMessage(error)}`);
      });
  };

  const handleManualCheckUpdate = () => {
    manualUpdateCheckPendingRef.current = true;
    setManualUpdateCheckPending(true);
    checkUpdate.mutate({ silent: false });
  };

  const hasPreparedUpdate = Boolean(preparedUpdate);
  const canDownloadUpdate = Boolean(
    !preparedUpdate && lastUpdateCheck?.hasUpdate && lastUpdateCheck.canPrepare
  );
  const shouldShowUpdateLogsEntry = Boolean(
    canOpenLocalDir && (preparedUpdate || lastUpdateCheck)
  );
  const updateActionLabel = hasPreparedUpdate
    ? "替换更新"
    : canDownloadUpdate
      ? "下载更新"
      : "检查更新";
  const updateActionDescription = !canSelfUpdate
    ? "Web / Docker 版不提供桌面应用更新检查"
    : hasPreparedUpdate
      ? "更新包已下载完成，点击后确认替换当前版本"
      : canDownloadUpdate
        ? "已发现新版本，点击后开始下载更新包"
        : "立即检查 GitHub Releases 是否有新版本可用";
  const updateActionBusy = Boolean(
    manualUpdateCheckPending || prepareUpdate.isPending || applyPreparedUpdate.isPending
  );
  const updateActionBusyLabel = manualUpdateCheckPending
    ? "正在检查..."
    : prepareUpdate.isPending
      ? "正在下载..."
      : applyPreparedUpdate.isPending
        ? "正在替换..."
        : updateActionLabel;

  const handleUpdateAction = () => {
    if (preparedUpdate) {
      setUpdateDialogCheck((current) => current ?? lastUpdateCheck);
      setUpdateDialogOpen(true);
      return;
    }

    if (lastUpdateCheck?.hasUpdate && lastUpdateCheck.canPrepare) {
      setUpdateDialogCheck(lastUpdateCheck);
      prepareUpdate.mutate();
      return;
    }

    handleManualCheckUpdate();
  };

  const handleOpenUpdateLogsDir = () => {
    void appClient.openUpdateLogsDir(preparedUpdate?.assetPath).catch((error) => {
      toast.error(`打开日志目录失败: ${getAppErrorMessage(error)}`);
    });
  };

  const filteredEnvCatalog = useMemo(() => {
    const catalog = snapshot?.envOverrideCatalog || [];
    if (!envSearch) return catalog;
    const keyword = envSearch.toLowerCase();
    return catalog.filter(
      (item) =>
        item.key.toLowerCase().includes(keyword) ||
        item.label.toLowerCase().includes(keyword)
    );
  }, [envSearch, snapshot?.envOverrideCatalog]);

  const selectedEnvItem = useMemo(
    () => snapshot?.envOverrideCatalog.find((item) => item.key === selectedEnvKey),
    [selectedEnvKey, snapshot?.envOverrideCatalog]
  );

  const upstreamProxyInput = upstreamProxyDraft ?? (snapshot?.upstreamProxyUrl || "");
  const gatewayOriginatorInput =
    gatewayOriginatorDraft ?? (snapshot?.gatewayOriginator || "codex_cli_rs");
  const gatewayUserAgentVersionInput =
    gatewayUserAgentVersionDraft ?? (snapshot?.gatewayUserAgentVersion || "0.101.0");
  const transportInputValues = {
    sseKeepaliveIntervalMs:
      transportDraft.sseKeepaliveIntervalMs ??
      stringifyNumber(snapshot?.sseKeepaliveIntervalMs),
    upstreamStreamTimeoutMs:
      transportDraft.upstreamStreamTimeoutMs ??
      stringifyNumber(snapshot?.upstreamStreamTimeoutMs),
  };
  const selectedEnvValue = selectedEnvKey
    ? envDrafts[selectedEnvKey] ??
      snapshot?.envOverrides[selectedEnvKey] ??
      selectedEnvItem?.defaultValue ??
      ""
    : "";

  const lastIntentThemeRef = useRef<string | null>(null);
  const lastIntentAppearancePresetRef = useRef<string | null>(null);

  const handleThemeChange = (nextTheme: string) => {
    if (!snapshot || nextTheme === snapshot.theme) return;
    const previousSnapshot = snapshot;
    const previousTheme = snapshot.theme || "tech";

    // 1. Immediately update local UI and intent lock
    lastIntentThemeRef.current = nextTheme;
    lastSyncedSnapshotThemeRef.current = nextTheme;
    
    setActiveTab("appearance");
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(SETTINGS_ACTIVE_TAB_KEY, "appearance");
    }
    
    setTheme(nextTheme);

    // 2. Optimistic local update
    queryClient.setQueryData(["app-settings-snapshot"], {
      ...snapshot,
      theme: nextTheme,
    });
    setStoreSettings({ ...snapshot, theme: nextTheme });

    // 3. Immediate persist to backend (No debounce)
    updateSettings.mutate(
      { theme: nextTheme, _silent: true },
      {
        onSuccess: (updatedSnapshot) => {
          // Double check if this is still our intent
          if (lastIntentThemeRef.current === nextTheme) {
            queryClient.setQueryData(["app-settings-snapshot"], updatedSnapshot);
            setStoreSettings(updatedSnapshot);
          }
        },
        onError: () => {
          // Only revert if no newer intent has been made
          if (lastIntentThemeRef.current === nextTheme) {
            queryClient.setQueryData(["app-settings-snapshot"], previousSnapshot);
            setStoreSettings(previousSnapshot);
            setTheme(previousTheme);
          }
        },
      }
    );
  };

  const handleAppearancePresetChange = (nextPreset: string) => {
    if (!snapshot) return;

    const normalizedPreset = normalizeAppearancePreset(nextPreset);
    const previousSnapshot = snapshot;
    const previousPreset = normalizeAppearancePreset(snapshot.appearancePreset);
    if (normalizedPreset === previousPreset) return;

    lastIntentAppearancePresetRef.current = normalizedPreset;
    lastSyncedAppearancePresetRef.current = normalizedPreset;
    applyAppearancePreset(normalizedPreset);

    queryClient.setQueryData(["app-settings-snapshot"], {
      ...snapshot,
      appearancePreset: normalizedPreset,
    });
    setStoreSettings({ ...snapshot, appearancePreset: normalizedPreset });

    updateSettings.mutate(
      { appearancePreset: normalizedPreset, _silent: true },
      {
        onSuccess: (updatedSnapshot) => {
          if (lastIntentAppearancePresetRef.current === normalizedPreset) {
            queryClient.setQueryData(["app-settings-snapshot"], updatedSnapshot);
            setStoreSettings(updatedSnapshot);
          }
        },
        onError: () => {
          if (lastIntentAppearancePresetRef.current === normalizedPreset) {
            queryClient.setQueryData(["app-settings-snapshot"], previousSnapshot);
            setStoreSettings(previousSnapshot);
            applyAppearancePreset(previousPreset);
          }
        },
      }
    );
  };

  const updateBackgroundTasks = (patch: Partial<BackgroundTaskSettings>) => {
    if (!snapshot) return;
    updateSettings.mutate({
      backgroundTasks: {
        ...snapshot.backgroundTasks,
        ...patch,
      },
    });
  };

  const saveTransportField = (
    key: "sseKeepaliveIntervalMs" | "upstreamStreamTimeoutMs",
    minimum: number
  ) => {
    const nextValue = parseIntegerInput(transportInputValues[key], minimum);
    if (nextValue == null) {
      toast.error("请输入合法的数值");
      setTransportDraft((current) => {
        const nextDraft = { ...current };
        delete nextDraft[key];
        return nextDraft;
      });
      return;
    }
    void updateSettings
      .mutateAsync({ [key]: nextValue } as Partial<AppSettings>)
      .then(() => {
        setTransportDraft((current) => {
          const nextDraft = { ...current };
          delete nextDraft[key];
          return nextDraft;
        });
      })
      .catch(() => undefined);
  };

  const saveBackgroundTaskField = (key: keyof BackgroundTaskSettings, minimum = 1) => {
    if (!snapshot) return;
    const draftKey = String(key);
    const sourceValue =
      backgroundTaskDraft[draftKey] ?? stringifyNumber(snapshot.backgroundTasks[key] as number);
    const nextValue = parseIntegerInput(sourceValue, minimum);
    if (nextValue == null) {
      toast.error("请输入合法的数值");
      setBackgroundTaskDraft((current) => {
        const nextDraft = { ...current };
        delete nextDraft[draftKey];
        return nextDraft;
      });
      return;
    }
    void updateSettings
      .mutateAsync({
        backgroundTasks: {
          ...snapshot.backgroundTasks,
          [key]: nextValue,
        },
      })
      .then(() => {
        setBackgroundTaskDraft((current) => {
          const nextDraft = { ...current };
          delete nextDraft[draftKey];
          return nextDraft;
        });
      })
      .catch(() => undefined);
  };

  const handleSaveEnv = () => {
    if (!selectedEnvKey || !snapshot) return;
    void updateSettings
      .mutateAsync({
        envOverrides: {
          ...snapshot.envOverrides,
          [selectedEnvKey]: selectedEnvValue,
        },
      })
      .then(() => {
        setEnvDrafts((current) => {
          const nextDraft = { ...current };
          delete nextDraft[selectedEnvKey];
          return nextDraft;
        });
      })
      .catch(() => undefined);
  };

  const handleResetEnv = () => {
    if (!selectedEnvKey || !snapshot) return;
    const nextOverrides = { ...snapshot.envOverrides };
    delete nextOverrides[selectedEnvKey];
    void updateSettings
      .mutateAsync({ envOverrides: nextOverrides })
      .then(() => {
        setEnvDrafts((current) => {
          const nextDraft = { ...current };
          delete nextDraft[selectedEnvKey];
          return nextDraft;
        });
      })
      .catch(() => undefined);
  };

  if ((canAccessManagementRpc && !isSnapshotQueryEnabled) || !snapshot) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">加载配置中...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">系统设置</h2>
        <p className="mt-1 text-sm text-muted-foreground">管理应用行为、网关策略及后台任务</p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (value && SETTINGS_TABS.includes(value as SettingsTab)) {
            setActiveTab(value as SettingsTab);
          }
        }}
        className="w-full"
      >
        <TabsList className="glass-card mb-6 flex h-11 w-full justify-start overflow-x-auto rounded-xl border-none p-1 no-scrollbar lg:w-fit">
          <TabsTrigger value="general" className="gap-2 px-5 shrink-0">
            <SettingsIcon className="h-4 w-4" /> 通用
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2 px-5 shrink-0">
            <Palette className="h-4 w-4" /> 外观
          </TabsTrigger>
          <TabsTrigger value="gateway" className="gap-2 px-5 shrink-0">
            <Globe className="h-4 w-4" /> 网关
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2 px-5 shrink-0">
            <Cpu className="h-4 w-4" /> 任务
          </TabsTrigger>
          <TabsTrigger value="env" className="gap-2 px-5 shrink-0">
            <Variable className="h-4 w-4" /> 环境
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card className="glass-card border-none shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AppWindow className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">基础设置</CardTitle>
              </div>
              <CardDescription>控制应用启动和窗口行为</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>自动检查更新</Label>
                  <p className="text-xs text-muted-foreground">启动时自动检测新版本</p>
                </div>
                <Switch
                  checked={snapshot.updateAutoCheck}
                  onCheckedChange={(value) => updateSettings.mutate({ updateAutoCheck: value })}
                />
              </div>
              <div className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-background/45 p-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <Label>{updateActionLabel}</Label>
                  <p className="text-xs text-muted-foreground">{updateActionDescription}</p>
                  {lastUpdateCheck ? (
                    <p className="text-xs text-muted-foreground">
                      {preparedUpdate
                        ? `已下载 ${preparedUpdate.latestVersion || preparedUpdate.releaseTag || "新版本"}，等待替换更新`
                        : lastUpdateCheck.hasUpdate
                          ? `发现新版本 ${lastUpdateCheck.latestVersion || lastUpdateCheck.releaseTag || "可用"}`
                          : lastUpdateCheck.reason ||
                            `当前版本 ${lastUpdateCheck.currentVersion || "未知"} 已是最新`}
                    </p>
                  ) : null}
                  {shouldShowUpdateLogsEntry ? (
                    <div className="pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto px-0 text-xs text-muted-foreground hover:text-foreground"
                        onClick={handleOpenUpdateLogsDir}
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        打开日志目录
                      </Button>
                    </div>
                  ) : null}
                </div>
                <Button
                  variant="outline"
                  className="gap-2 self-start md:self-auto"
                  disabled={
                    !canSelfUpdate ||
                    updateActionBusy
                  }
                  onClick={handleUpdateAction}
                >
                  {manualUpdateCheckPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : prepareUpdate.isPending ? (
                    <Download className="h-4 w-4 animate-pulse" />
                  ) : applyPreparedUpdate.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : hasPreparedUpdate ? (
                    <Check className="h-4 w-4" />
                  ) : canDownloadUpdate ? (
                    <Download className="h-4 w-4" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {updateActionBusyLabel}
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>关闭时最小化到托盘</Label>
                  <p className="text-xs text-muted-foreground">点击关闭按钮不会直接退出程序</p>
                </div>
                <Switch
                  checked={snapshot.closeToTrayOnClose}
                  disabled={!canCloseToTray || !snapshot.closeToTraySupported}
                  onCheckedChange={(value) =>
                    updateSettings.mutate({ closeToTrayOnClose: value })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>视觉性能模式</Label>
                  <p className="text-xs text-muted-foreground">关闭毛玻璃等特效以提升低配电脑性能</p>
                </div>
                <Switch
                  checked={snapshot.lowTransparency}
                  onCheckedChange={(value) => updateSettings.mutate({ lowTransparency: value })}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-none shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">服务监听</CardTitle>
              </div>
              <CardDescription>统一控制 Service 与 Web 的监听模式，决定仅本机访问还是开放给局域网</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-2">
                <Label>监听地址</Label>
                <Select
                  value={snapshot.serviceListenMode || "loopback"}
                  onValueChange={(value) => {
                    const nextValue = String(value || "").trim() || "loopback";
                    if (nextValue === snapshot.serviceListenMode) {
                      return;
                    }
                    updateSettings.mutate({ serviceListenMode: nextValue });
                  }}
                >
                  <SelectTrigger className="w-full md:w-[320px]">
                    <SelectValue placeholder="选择监听地址模式">
                      {(value) =>
                        SERVICE_LISTEN_MODE_LABELS[String(value || "").trim()] ||
                        String(value || "").trim() ||
                        "仅本机 (localhost)"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(snapshot.serviceListenModeOptions?.length
                      ? snapshot.serviceListenModeOptions
                      : ["loopback", "all_interfaces"]
                    ).map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {SERVICE_LISTEN_MODE_LABELS[mode] || mode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-2xl border border-border/50 bg-background/45 p-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">当前访问地址</span>
                  <code className="text-xs text-primary">{snapshot.serviceAddr}</code>
                </div>
                <div className="mt-2 flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">实际监听地址</span>
                  <code className="text-xs text-primary">
                    {inferServiceBindPreview(
                      snapshot.serviceAddr,
                      snapshot.serviceListenMode || "loopback",
                    )}
                  </code>
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground">
                切换到 <code>0.0.0.0</code> 后，局域网设备可通过当前机器 IP 访问；
                设置保存后需要重启相关进程才会生效，Web 监听地址会默认跟随这里的模式。
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <Card className="glass-card border-none shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">样式版本</CardTitle>
              </div>
              <CardDescription>在渐变版本和默认版本之间切换</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {APPEARANCE_PRESETS.map((item) => {
                  const currentPreset = normalizeAppearancePreset(snapshot.appearancePreset);
                  const isActive = currentPreset === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleAppearancePresetChange(item.id)}
                      className={cn(
                        "group relative rounded-2xl border p-4 text-left transition-all duration-300 hover:-translate-y-0.5",
                        isActive
                          ? "border-primary bg-primary/10 shadow-lg ring-1 ring-primary"
                          : "border-border/60 bg-background/50 hover:bg-accent/30"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1.5">
                          <div className="text-sm font-semibold">{item.name}</div>
                          <p className="text-xs leading-5 text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                        {isActive ? (
                          <div className="rounded-full bg-primary p-1 text-primary-foreground shadow-sm">
                            <Check className="h-3 w-3" />
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-3 flex items-end gap-2.5">
                        <div
                          className={cn(
                            "h-14 flex-1 rounded-xl border",
                            item.id === "modern"
                              ? "border-primary/20 bg-[linear-gradient(160deg,rgba(255,255,255,0.88),rgba(37,99,235,0.1)),linear-gradient(180deg,rgba(191,219,254,0.6),rgba(255,255,255,0.85))]"
                              : "border-slate-300/70 bg-[radial-gradient(at_0%_0%,#bfdbfe_0px,transparent_50%),radial-gradient(at_100%_0%,#cffafe_0px,transparent_50%),radial-gradient(at_50%_100%,#ffffff_0px,transparent_50%),rgba(255,255,255,0.86)]"
                          )}
                        />
                        <div className="flex w-16 flex-col gap-1.5">
                          <div
                            className={cn(
                              "h-4 rounded-lg border",
                              item.id === "modern"
                                ? "border-primary/15 bg-white/80 shadow-sm"
                                : "border-slate-300/70 bg-white/70"
                            )}
                          />
                          <div
                            className={cn(
                              "h-4 rounded-lg border",
                              item.id === "modern"
                                ? "border-primary/15 bg-white/70 shadow-sm"
                                : "border-slate-300/70 bg-white/60"
                            )}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-none shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">界面主题</CardTitle>
              </div>
              <CardDescription>选择您喜爱的配色方案，适配不同工作心情</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12">
                {THEMES.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleThemeChange(item.id)}
                    className={cn(
                      "group relative flex flex-col items-center gap-2.5 rounded-2xl border p-4 transition-all duration-300 hover:scale-105",
                      theme === item.id
                        ? "border-primary bg-primary/10 shadow-lg ring-1 ring-primary"
                        : "border-transparent bg-muted/20 hover:bg-accent/40"
                    )}
                  >
                    <div
                      className="h-10 w-10 rounded-full border-2 border-white/20 shadow-md"
                      style={{ backgroundColor: item.color }}
                    />
                    <span
                      className={cn(
                        "whitespace-nowrap text-[10px] font-semibold transition-colors",
                        theme === item.id
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground"
                      )}
                    >
                      {item.name}
                    </span>
                    {theme === item.id ? (
                      <div className="absolute right-2 top-2 rounded-full bg-primary p-0.5 text-primary-foreground shadow-sm">
                        <Check className="h-2.5 w-2.5" />
                      </div>
                    ) : null}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gateway" className="space-y-4">
          <Card className="glass-card border-none shadow-md">
            <CardHeader>
              <CardTitle className="text-base">网关策略</CardTitle>
              <CardDescription>配置账号选路和请求头处理方式</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-2">
                <Label>账号选路策略</Label>
                <Select
                  value={snapshot.routeStrategy || "ordered"}
                  onValueChange={(value) =>
                    updateSettings.mutate({ routeStrategy: value || "ordered" })
                  }
                >
                  <SelectTrigger className="w-full md:w-[300px]">
                    <SelectValue placeholder="选择策略">
                      {(value) => {
                        const nextValue = String(value || "").trim();
                        if (!nextValue) return "选择策略";
                        return ROUTE_STRATEGY_LABELS[nextValue] || nextValue;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ordered">顺序优先 (Ordered)</SelectItem>
                    <SelectItem value="balanced">均衡轮询 (Balanced)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  顺序优先：按账号候选顺序优先尝试，默认只会在头部小窗口内按健康度做轻微换头；
                  均衡轮询：按“平台密钥 + 模型”维度严格轮询可用账号，默认不做健康度换头。
                </p>
              </div>

              <div className="grid gap-2">
                <Label>Free 账号使用模型</Label>
                <Select
                  value={snapshot.freeAccountMaxModel || "auto"}
                  onValueChange={(value) =>
                    updateSettings.mutate({ freeAccountMaxModel: value || "auto" })
                  }
                >
                  <SelectTrigger className="w-full md:w-[300px]">
                    <SelectValue placeholder="选择 free 账号使用模型">
                      {(value) => formatFreeAccountModelLabel(String(value || ""))}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(snapshot.freeAccountMaxModelOptions?.length
                      ? snapshot.freeAccountMaxModelOptions
                      : DEFAULT_FREE_ACCOUNT_MAX_MODEL_OPTIONS
                    ).map((model) => (
                      <SelectItem key={model} value={model}>
                        {formatFreeAccountModelLabel(model)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  设为“跟随请求”时，不会额外改写 free / 7天单窗口账号的模型；
                  只有你选了具体模型后，命中这些账号时才会统一改写为该模型。
                </p>
              </div>

              <div className="flex items-center justify-between border-t pt-6">
                <div className="space-y-0.5">
                  <Label>请求体压缩</Label>
                  <p className="text-xs text-muted-foreground">
                    对齐官方 Codex：流式 <code>/responses</code> 请求发往 ChatGPT Codex backend 时，默认使用
                    <code>zstd</code> 压缩请求体。
                  </p>
                </div>
                <Switch
                  checked={snapshot.requestCompressionEnabled}
                  onCheckedChange={(value) =>
                    updateSettings.mutate({ requestCompressionEnabled: value })
                  }
                />
              </div>

              <div className="grid gap-2 border-t pt-6">
                <Label>Originator</Label>
                <Input
                  className="h-10 max-w-md font-mono"
                  value={gatewayOriginatorInput}
                  onChange={(event) => setGatewayOriginatorDraft(event.target.value)}
                  onBlur={() => {
                    if (gatewayOriginatorDraft == null) return;
                    if (gatewayOriginatorInput === (snapshot.gatewayOriginator || "codex_cli_rs")) {
                      setGatewayOriginatorDraft(null);
                      return;
                    }
                    void updateSettings
                      .mutateAsync({ gatewayOriginator: gatewayOriginatorInput })
                      .then(() => setGatewayOriginatorDraft(null))
                      .catch(() => undefined);
                  }}
                />
                <p className="text-[10px] text-muted-foreground">
                  对齐官方 Codex 的上游 Originator。默认值为 <code>codex_cli_rs</code>，会同步影响登录和网关上游请求头。
                </p>
              </div>

              <div className="grid gap-2">
                <Label>User-Agent 版本</Label>
                <Input
                  className="h-10 max-w-md font-mono"
                  value={gatewayUserAgentVersionInput}
                  onChange={(event) => setGatewayUserAgentVersionDraft(event.target.value)}
                  onBlur={() => {
                    if (gatewayUserAgentVersionDraft == null) return;
                    if (gatewayUserAgentVersionInput === (snapshot.gatewayUserAgentVersion || "0.101.0")) {
                      setGatewayUserAgentVersionDraft(null);
                      return;
                    }
                    void updateSettings
                      .mutateAsync({ gatewayUserAgentVersion: gatewayUserAgentVersionInput })
                      .then(() => setGatewayUserAgentVersionDraft(null))
                      .catch(() => undefined);
                  }}
                />
                <p className="text-[10px] text-muted-foreground">
                  控制真实出站 <code>User-Agent</code> 里的版本号，默认值为 <code>0.101.0</code>。
                  官方 Codex 升级后，可以在这里手动同步。
                </p>
              </div>

              <div className="grid gap-2">
                <Label>Residency Requirement</Label>
                <Select
                  value={
                    (snapshot.gatewayResidencyRequirement ?? "") || EMPTY_RESIDENCY_OPTION
                  }
                  onValueChange={(value) =>
                    updateSettings.mutate({
                      gatewayResidencyRequirement:
                        value === EMPTY_RESIDENCY_OPTION ? "" : (value ?? ""),
                    })
                  }
                >
                  <SelectTrigger className="w-full md:w-[300px]">
                    <SelectValue placeholder="选择地域约束">
                      {(value) => {
                        const nextValue =
                          String(value || "") === EMPTY_RESIDENCY_OPTION
                            ? ""
                            : String(value || "");
                        return RESIDENCY_REQUIREMENT_LABELS[nextValue] || nextValue;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(snapshot.gatewayResidencyRequirementOptions?.length
                      ? snapshot.gatewayResidencyRequirementOptions
                      : ["", "us"]
                    ).map((value) => (
                      <SelectItem
                        key={value || EMPTY_RESIDENCY_OPTION}
                        value={value || EMPTY_RESIDENCY_OPTION}
                      >
                        {RESIDENCY_REQUIREMENT_LABELS[value] || value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  对齐官方 Codex 的 <code>x-openai-internal-codex-residency</code> 头。
                  当前只支持留空或 <code>us</code>。
                </p>
              </div>

              <div className="grid gap-2 pt-2">
                <Label>上游代理 (Proxy)</Label>
                <Input
                  placeholder="http://127.0.0.1:7890"
                  className="h-10 max-w-md font-mono"
                  value={upstreamProxyInput}
                  onChange={(event) => setUpstreamProxyDraft(event.target.value)}
                  onBlur={() => {
                    if (upstreamProxyDraft == null) return;
                    if (upstreamProxyInput === (snapshot.upstreamProxyUrl || "")) {
                      setUpstreamProxyDraft(null);
                      return;
                    }
                    void updateSettings
                      .mutateAsync({ upstreamProxyUrl: upstreamProxyInput })
                      .then(() => setUpstreamProxyDraft(null))
                      .catch(() => undefined);
                  }}
                />
                <p className="text-[10px] text-muted-foreground">支持 http/https/socks5，留空表示直连。</p>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t pt-6">
                <div className="grid gap-2">
                  <Label>SSE 保活间隔 (ms)</Label>
                  <Input
                    type="number"
                    value={transportInputValues.sseKeepaliveIntervalMs}
                    onChange={(event) =>
                      setTransportDraft((current) => ({
                        ...current,
                        sseKeepaliveIntervalMs: event.target.value,
                      }))
                    }
                    onBlur={() => saveTransportField("sseKeepaliveIntervalMs", 1)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>上游流式超时 (ms)</Label>
                  <Input
                    type="number"
                    value={transportInputValues.upstreamStreamTimeoutMs}
                    onChange={(event) =>
                      setTransportDraft((current) => ({
                        ...current,
                        upstreamStreamTimeoutMs: event.target.value,
                      }))
                    }
                    onBlur={() => saveTransportField("upstreamStreamTimeoutMs", 0)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <Card className="glass-card border-none shadow-md">
            <CardHeader>
              <CardTitle className="text-base">后台任务线程</CardTitle>
              <CardDescription>管理自动轮询和保活任务；用量轮询会跳过手动禁用账号</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {BACKGROUND_TASK_ITEMS.map((task) => (
                <div
                  key={task.enabledKey}
                  className="flex items-center justify-between gap-4 rounded-lg bg-accent/20 p-3"
                >
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={snapshot.backgroundTasks[task.enabledKey as keyof BackgroundTaskSettings] as boolean}
                      onCheckedChange={(value) =>
                        updateBackgroundTasks({
                          [task.enabledKey]: value,
                        } as Partial<BackgroundTaskSettings>)
                      }
                    />
                    <Label>{task.label}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">间隔(秒)</span>
                    <Input
                      className="h-8 w-20"
                      min={task.minimum}
                      type="number"
                      value={
                        backgroundTaskDraft[task.intervalKey] ||
                        stringifyNumber(
                          snapshot.backgroundTasks[
                            task.intervalKey as keyof BackgroundTaskSettings
                          ] as number
                        )
                      }
                      onChange={(event) =>
                        setBackgroundTaskDraft((current) => ({
                          ...current,
                          [task.intervalKey]: event.target.value,
                        }))
                      }
                      onBlur={() =>
                        saveBackgroundTaskField(
                          task.intervalKey as keyof BackgroundTaskSettings,
                          task.minimum
                        )
                      }
                    />
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 rounded-lg bg-accent/20 p-3">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={
                      snapshot.backgroundTasks.excludeLowQuotaFromBalancedRouting
                    }
                    onCheckedChange={(value) =>
                      updateBackgroundTasks({
                        excludeLowQuotaFromBalancedRouting: value,
                      } as Partial<BackgroundTaskSettings>)
                    }
                  />
                  <div className="space-y-0.5">
                    <Label>低配额账号退出均衡轮询</Label>
                    <p className="text-xs text-muted-foreground">
                      低配额账号不参与均衡轮询，但仍可作为兜底账号
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-none shadow-md">
            <CardHeader>
              <CardTitle className="text-base">Worker 并发参数</CardTitle>
              <CardDescription>调整执行单元并发规模；用量刷新并发会直接影响手动刷新和后台轮询</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[
                { label: "用量刷新并发", key: "usageRefreshWorkers" },
                { label: "HTTP 因子", key: "httpWorkerFactor" },
                { label: "HTTP 最小并发", key: "httpWorkerMin" },
                { label: "流式因子", key: "httpStreamWorkerFactor" },
                { label: "流式最小并发", key: "httpStreamWorkerMin" },
              ].map((worker) => (
                <div key={worker.key} className="grid gap-1.5">
                  <Label className="text-xs">{worker.label}</Label>
                  <Input
                    type="number"
                    className="h-9"
                    value={
                      backgroundTaskDraft[worker.key] ||
                      stringifyNumber(
                        snapshot.backgroundTasks[
                          worker.key as keyof BackgroundTaskSettings
                        ] as number
                      )
                    }
                    onChange={(event) =>
                      setBackgroundTaskDraft((current) => ({
                        ...current,
                        [worker.key]: event.target.value,
                      }))
                    }
                    onBlur={() =>
                      saveBackgroundTaskField(worker.key as keyof BackgroundTaskSettings, 1)
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="env" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-[300px_1fr]">
            <Card className="glass-card flex h-[500px] flex-col border-none shadow-md">
              <CardHeader className="pb-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索变量..."
                    className="h-9 pl-9"
                    value={envSearch}
                    onChange={(event) => setEnvSearch(event.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-2">
                <div className="space-y-1">
                  {filteredEnvCatalog.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => setSelectedEnvKey(item.key)}
                      className={cn(
                        "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                        selectedEnvKey === item.key
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-accent"
                      )}
                    >
                      <div className="truncate font-medium">{item.label}</div>
                      <code className="block truncate text-[10px] opacity-70">{item.key}</code>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card min-h-[500px] border-none shadow-md">
              {selectedEnvKey ? (
                <>
                  <CardHeader>
                    <div className="flex flex-col gap-1">
                      <CardTitle className="text-lg">{selectedEnvItem?.label}</CardTitle>
                      <code className="w-fit rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        {selectedEnvKey}
                      </code>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="rounded-lg border bg-accent/30 p-4 text-sm leading-relaxed text-muted-foreground">
                      <Info className="mr-2 inline-block h-4 w-4 text-primary" />
                      {ENV_DESCRIPTION_MAP[selectedEnvKey] ||
                        `${selectedEnvItem?.label} 对应环境变量，修改后会应用到相关模块。`}
                    </div>

                    <div className="space-y-2">
                      <Label>当前值</Label>
                      <Input
                        value={selectedEnvValue}
                        onChange={(event) => {
                          if (!selectedEnvKey) return;
                          setEnvDrafts((current) => ({
                            ...current,
                            [selectedEnvKey]: event.target.value,
                          }));
                        }}
                        className="h-11 font-mono"
                        placeholder="输入变量值"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        默认值:{" "}
                        <span className="font-mono italic">
                          {selectedEnvItem?.defaultValue || "空"}
                        </span>
                      </p>
                    </div>

                    <div className="flex gap-3 border-t pt-4">
                      <Button onClick={handleSaveEnv} className="gap-2">
                        <Save className="h-4 w-4" /> 保存修改
                      </Button>
                      <Button variant="outline" onClick={handleResetEnv} className="gap-2">
                        <RotateCcw className="h-4 w-4" /> 恢复默认
                      </Button>
                    </div>
                  </CardContent>
                </>
              ) : (
                <CardContent className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
                  <div className="rounded-full bg-accent/30 p-4">
                    <Variable className="h-12 w-12 opacity-20" />
                  </div>
                  <p>请从左侧列表选择一个环境变量进行配置</p>
                </CardContent>
              )}
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog
        open={updateDialogOpen}
        onOpenChange={(open) => {
          if (prepareUpdate.isPending || applyPreparedUpdate.isPending) {
            return;
          }
          setUpdateDialogOpen(open);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="glass-card border-none p-6 sm:max-w-[480px]"
        >
          <DialogHeader>
            <DialogTitle>{preparedUpdate ? "替换更新" : "发现新版本"}</DialogTitle>
            <DialogDescription>
              {preparedUpdate
                ? preparedUpdate.isPortable
                  ? "更新包已下载完成。确认后将重启应用并替换当前程序。"
                  : "更新包已下载完成。确认后会开始替换流程。"
                : `当前版本 ${updateDialogCheck?.currentVersion || "未知"}，发现新版本 ${
                    updateDialogCheck?.latestVersion ||
                    updateDialogCheck?.releaseTag ||
                    "可用"
                  }。`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="rounded-2xl border border-border/50 bg-background/45 p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">当前版本</span>
                <span className="font-medium">
                  {updateDialogCheck?.currentVersion || "未知"}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="text-muted-foreground">目标版本</span>
                <span className="font-medium">
                  {preparedUpdate?.latestVersion ||
                    updateDialogCheck?.latestVersion ||
                    updateDialogCheck?.releaseTag ||
                    "未知"}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="text-muted-foreground">更新模式</span>
                <span className="font-medium">
                  {(preparedUpdate?.isPortable ?? updateDialogCheck?.isPortable)
                    ? "便携包更新"
                    : "安装包更新"}
                </span>
              </div>
              {preparedUpdate?.assetName ? (
                <div className="mt-2 flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">更新文件</span>
                  <span className="max-w-[240px] truncate font-mono text-xs">
                    {preparedUpdate.assetName}
                  </span>
                </div>
              ) : null}
            </div>

            {preparedUpdate ? null : updateDialogCheck?.reason ? (
              <div className="rounded-2xl border border-border/50 bg-muted/40 p-4 text-xs leading-5 text-muted-foreground">
                {updateDialogCheck.reason}
              </div>
            ) : (
              <div className="rounded-2xl border border-border/50 bg-muted/40 p-4 text-xs leading-5 text-muted-foreground">
                建议先下载更新包，下载完成后再执行安装或重启更新。
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              disabled={prepareUpdate.isPending || applyPreparedUpdate.isPending}
              onClick={() => setUpdateDialogOpen(false)}
            >
              稍后
            </Button>
            {preparedUpdate ? (
              <Button
                className="gap-2"
                disabled={applyPreparedUpdate.isPending}
                onClick={() =>
                  applyPreparedUpdate.mutate({ isPortable: preparedUpdate.isPortable })
                }
              >
                <Download className="h-4 w-4" />
                {applyPreparedUpdate.isPending
                  ? preparedUpdate.isPortable
                    ? "正在替换更新..."
                    : "正在启动替换..."
                  : "替换更新"}
              </Button>
            ) : updateDialogCheck?.canPrepare ? (
              <Button
                className="gap-2"
                disabled={prepareUpdate.isPending}
                onClick={() => prepareUpdate.mutate()}
              >
                <Download className="h-4 w-4" />
                {prepareUpdate.isPending ? "正在下载更新..." : "下载更新"}
              </Button>
            ) : (
              <Button className="gap-2" onClick={handleOpenReleasePage}>
                <ExternalLink className="h-4 w-4" />
                打开发布页
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
