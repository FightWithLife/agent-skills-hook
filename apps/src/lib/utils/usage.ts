"use client";

import { Account, AccountUsage, AvailabilityLevel, RequestLog } from "@/types";

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const COMPACT_NUMBER_UNITS = [
  { value: 1e18, suffix: "E" },
  { value: 1e15, suffix: "P" },
  { value: 1e12, suffix: "T" },
  { value: 1e9, suffix: "B" },
  { value: 1e6, suffix: "M" },
  { value: 1e3, suffix: "K" },
];
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const WINDOW_ROUNDING_BIAS_MINUTES = 3;

type UsageWindowDisplayMode = "primary-only" | "secondary-only" | "dual" | "unknown";

export function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function formatTsFromSeconds(
  timestamp: number | null | undefined,
  emptyLabel = "未知"
): string {
  if (!timestamp) return emptyLabel;
  const date = new Date(timestamp * 1000);
  if (Number.isNaN(date.getTime())) return emptyLabel;
  return dateTimeFormatter.format(date);
}

function trimTrailingZeros(text: string): string {
  return text.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

export function formatCompactNumber(
  value: number | null | undefined,
  fallback = "-",
  maxFractionDigits = 1
): string {
  const parsed = toNullableNumber(value);
  if (parsed == null) return fallback;

  const normalized = Math.max(0, parsed);
  if (normalized < 1000) {
    return `${Math.round(normalized)}`;
  }

  for (const unit of COMPACT_NUMBER_UNITS) {
    if (normalized < unit.value) continue;
    const scaled = normalized / unit.value;
    return `${trimTrailingZeros(scaled.toFixed(maxFractionDigits))}${unit.suffix}`;
  }

  return `${Math.round(normalized)}`;
}

function normalizedAccountStatus(account?: { status?: string } | null): string {
  return String(account?.status || "").trim().toLowerCase();
}

function isDisabledAccount(account?: { status?: string } | null): boolean {
  return normalizedAccountStatus(account) === "disabled";
}

function isRecoveryRequiredAccount(account?: { status?: string } | null): boolean {
  return normalizedAccountStatus(account) === "inactive";
}

function isUnavailableAccount(account?: { status?: string } | null): boolean {
  return normalizedAccountStatus(account) === "unavailable";
}

export function remainingPercent(value: number | null | undefined): number | null {
  const parsed = toNullableNumber(value);
  if (parsed == null) return null;
  return Math.max(0, Math.min(100, Math.round(100 - parsed)));
}

function hasSecondarySignal(usage?: Partial<AccountUsage> | null): boolean {
  return (
    toNullableNumber(usage?.secondaryUsedPercent) != null ||
    toNullableNumber(usage?.secondaryWindowMinutes) != null
  );
}

function isLongWindow(windowMinutes: number | null | undefined): boolean {
  const parsed = toNullableNumber(windowMinutes);
  return parsed != null && parsed > MINUTES_PER_DAY + WINDOW_ROUNDING_BIAS_MINUTES;
}

function parseCreditsJson(raw: string | null | undefined): unknown | null {
  const text = String(raw || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractPlanTypeRecursive(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractPlanTypeRecursive(item);
      if (nested) return nested;
    }
    return null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;
  for (const key of [
    "plan_type",
    "planType",
    "subscription_tier",
    "subscriptionTier",
    "tier",
    "account_type",
    "accountType",
    "type",
  ]) {
    const text = typeof source[key] === "string" ? source[key].trim().toLowerCase() : "";
    if (text) return text;
  }

  for (const nested of Object.values(source)) {
    const result = extractPlanTypeRecursive(nested);
    if (result) return result;
  }

  return null;
}

function isFreePlanUsage(raw: string | null | undefined): boolean {
  const credits = parseCreditsJson(raw);
  const planType = extractPlanTypeRecursive(credits);
  return Boolean(planType && planType.includes("free"));
}

export function getUsageWindowDisplayMode(
  usage?: Partial<AccountUsage> | null
): UsageWindowDisplayMode {
  const hasPrimarySignal =
    toNullableNumber(usage?.usedPercent) != null || toNullableNumber(usage?.windowMinutes) != null;
  const secondarySignal = hasSecondarySignal(usage);

  if (!hasPrimarySignal && !secondarySignal) {
    return "unknown";
  }
  if (
    hasPrimarySignal &&
    !secondarySignal &&
    (isLongWindow(usage?.windowMinutes) || isFreePlanUsage(usage?.creditsJson))
  ) {
    return "secondary-only";
  }
  if (hasPrimarySignal && !secondarySignal) {
    return "primary-only";
  }
  return "dual";
}

export function getUsageDisplayBuckets(usage?: Partial<AccountUsage> | null): {
  mode: UsageWindowDisplayMode;
  primaryRemainPercent: number | null;
  primaryResetsAt: number | null;
  secondaryRemainPercent: number | null;
  secondaryResetsAt: number | null;
} {
  const mode = getUsageWindowDisplayMode(usage);
  if (mode === "secondary-only") {
    return {
      mode,
      primaryRemainPercent: null,
      primaryResetsAt: null,
      secondaryRemainPercent: remainingPercent(usage?.usedPercent),
      secondaryResetsAt: toNullableNumber(usage?.resetsAt),
    };
  }

  return {
    mode,
    primaryRemainPercent: remainingPercent(usage?.usedPercent),
    primaryResetsAt: toNullableNumber(usage?.resetsAt),
    secondaryRemainPercent: remainingPercent(usage?.secondaryUsedPercent),
    secondaryResetsAt: toNullableNumber(usage?.secondaryResetsAt),
  };
}

export function calcAvailability(
  usage?: Partial<AccountUsage> | null,
  account?: { status?: string } | null
): { text: string; level: AvailabilityLevel } {
  if (isDisabledAccount(account)) {
    return { text: "已禁用", level: "bad" };
  }
  if (isRecoveryRequiredAccount(account)) {
    return { text: "不可用", level: "bad" };
  }
  if (isUnavailableAccount(account)) {
    return { text: "不可用", level: "bad" };
  }
  if (!usage) {
    return { text: "未知", level: "unknown" };
  }

  const normalizedStatus = String(usage.availabilityStatus || "")
    .trim()
    .toLowerCase();
  const displayMode = getUsageWindowDisplayMode(usage);
  if (normalizedStatus === "available") {
    return { text: "可用", level: "ok" };
  }
  if (normalizedStatus === "primary_window_available_only") {
    return {
      text: displayMode === "secondary-only" ? "仅7天额度" : "7天窗口未提供",
      level: "ok",
    };
  }
  if (normalizedStatus === "unavailable") {
    return { text: "不可用", level: "bad" };
  }
  if (normalizedStatus === "unknown") {
    return { text: "未知", level: "unknown" };
  }

  const primaryMissing =
    toNullableNumber(usage.usedPercent) == null ||
    toNullableNumber(usage.windowMinutes) == null;
  const secondaryPresent =
    toNullableNumber(usage.secondaryUsedPercent) != null ||
    toNullableNumber(usage.secondaryWindowMinutes) != null;
  const secondaryMissing =
    toNullableNumber(usage.secondaryUsedPercent) == null ||
    toNullableNumber(usage.secondaryWindowMinutes) == null;

  if (primaryMissing) return { text: "用量缺失", level: "bad" };
  if ((usage.usedPercent ?? 0) >= 100) {
    return { text: "不可用", level: "bad" };
  }
  if (!secondaryPresent) {
    return {
      text: displayMode === "secondary-only" ? "仅7天额度" : "7天窗口未提供",
      level: "ok",
    };
  }
  if (secondaryMissing) {
    return { text: "用量缺失", level: "bad" };
  }
  if ((usage.secondaryUsedPercent ?? 0) >= 100) {
    return { text: "不可用", level: "bad" };
  }
  return { text: "可用", level: "ok" };
}

export function isPrimaryWindowOnlyUsage(
  usage?: Partial<AccountUsage> | null
): boolean {
  return getUsageWindowDisplayMode(usage) === "primary-only";
}

export function isSecondaryWindowOnlyUsage(
  usage?: Partial<AccountUsage> | null
): boolean {
  return getUsageWindowDisplayMode(usage) === "secondary-only";
}

export function isLowQuotaUsage(usage?: Partial<AccountUsage> | null): boolean {
  const buckets = getUsageDisplayBuckets(usage);
  const primaryRemain = buckets.primaryRemainPercent;
  const secondaryRemain = buckets.secondaryRemainPercent;
  return (
    (primaryRemain != null && primaryRemain <= 20) ||
    (secondaryRemain != null && secondaryRemain <= 20)
  );
}

export function canParticipateInRouting(level: AvailabilityLevel): boolean {
  return level !== "warn" && level !== "bad";
}

export function pickCurrentAccount(
  accounts: Account[],
  requestLogs: RequestLog[],
  manualPreferredAccountId?: string
): Account | null {
  if (!accounts.length) return null;

  const preferredId = String(manualPreferredAccountId || "").trim();
  if (preferredId) {
    const preferred = accounts.find((item) => item.id === preferredId);
    if (preferred && canParticipateInRouting(preferred.availabilityLevel)) {
      return preferred;
    }
  }

  let latestHit: RequestLog | null = null;
  for (const item of requestLogs) {
    if (!item.accountId) continue;
    if (!latestHit || (item.createdAt ?? 0) > (latestHit.createdAt ?? 0)) {
      latestHit = item;
    }
  }
  if (latestHit) {
    const fromLogs = accounts.find((item) => item.id === latestHit.accountId);
    if (fromLogs && canParticipateInRouting(fromLogs.availabilityLevel)) {
      return fromLogs;
    }
  }

  return (
    accounts.find((item) => canParticipateInRouting(item.availabilityLevel)) ||
    (preferredId ? accounts.find((item) => item.id === preferredId) : null) ||
    accounts[0] ||
    null
  );
}

export function pickBestRecommendations(accounts: Account[]): {
  primaryPick: Account | null;
  secondaryPick: Account | null;
} {
  let primaryPick: Account | null = null;
  let secondaryPick: Account | null = null;

  for (const account of accounts) {
    if (!canParticipateInRouting(account.availabilityLevel)) {
      continue;
    }
    if (
      account.primaryRemainPercent != null &&
      (!primaryPick ||
        (primaryPick.primaryRemainPercent ?? -1) < account.primaryRemainPercent)
    ) {
      primaryPick = account;
    }
    if (
      account.secondaryRemainPercent != null &&
      (!secondaryPick ||
        (secondaryPick.secondaryRemainPercent ?? -1) < account.secondaryRemainPercent)
    ) {
      secondaryPick = account;
    }
  }

  return { primaryPick, secondaryPick };
}
