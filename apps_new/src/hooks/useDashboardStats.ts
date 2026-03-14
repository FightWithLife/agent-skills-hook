"use client";

import { useQuery } from "@tanstack/react-query";
import { serviceClient } from "@/lib/api/service-client";
import { pickBestRecommendations, pickCurrentAccount } from "@/lib/utils/usage";

export function useDashboardStats() {
  const snapshotQuery = useQuery({
    queryKey: ["startup-snapshot", 120],
    queryFn: () => serviceClient.getStartupSnapshot({ requestLogLimit: 120 }),
    retry: 1,
  });

  const data = snapshotQuery.data;
  const accounts = data?.accounts || [];
  const totalAccounts = accounts.length;
  const availableAccounts = accounts.filter((item) => item.isAvailable).length;
  const unavailableAccounts = totalAccounts - availableAccounts;
  const currentAccount = pickCurrentAccount(
    accounts,
    data?.requestLogs || [],
    data?.manualPreferredAccountId
  );
  const recommendations = pickBestRecommendations(accounts);

  return {
    stats: {
      total: totalAccounts,
      available: availableAccounts,
      unavailable: unavailableAccounts,
      todayTokens: data?.requestLogTodaySummary.todayTokens || 0,
      cachedTokens: data?.requestLogTodaySummary.cachedInputTokens || 0,
      reasoningTokens: data?.requestLogTodaySummary.reasoningOutputTokens || 0,
      todayCost: data?.requestLogTodaySummary.estimatedCost || 0,
      poolRemain: {
        primary: data?.usageAggregateSummary.primaryRemainPercent ?? null,
        secondary: data?.usageAggregateSummary.secondaryRemainPercent ?? null,
        primaryKnownCount: data?.usageAggregateSummary.primaryKnownCount ?? 0,
        primaryBucketCount: data?.usageAggregateSummary.primaryBucketCount ?? 0,
        secondaryKnownCount: data?.usageAggregateSummary.secondaryKnownCount ?? 0,
        secondaryBucketCount: data?.usageAggregateSummary.secondaryBucketCount ?? 0,
      },
    },
    currentAccount,
    recommendations,
    requestLogs: data?.requestLogs || [],
    isLoading: snapshotQuery.isLoading,
    isError: snapshotQuery.isError,
    error: snapshotQuery.error,
  };
}
