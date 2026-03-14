"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { accountClient } from "@/lib/api/account-client";
import { toast } from "sonner";

export function useApiKeys() {
  const queryClient = useQueryClient();

  const apiKeysQuery = useQuery({
    queryKey: ["apikeys"],
    queryFn: () => accountClient.listApiKeys(),
  });

  const createMutation = useMutation({
    mutationFn: (params: any) => accountClient.createApiKey(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apikeys"] });
      toast.success("密钥已创建");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => accountClient.deleteApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apikeys"] });
      toast.success("密钥已删除");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, params }: { id: string; params: any }) => 
      accountClient.updateApiKey(id, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apikeys"] });
      toast.success("密钥配置已更新");
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => 
      enabled ? accountClient.enableApiKey(id) : accountClient.disableApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apikeys"] });
      toast.success("状态已更新");
    },
    onError: (err: any) => {
      toast.error(`更新状态失败: ${err.message}`);
    }
  });

  return {
    apiKeys: apiKeysQuery.data || [],
    isLoading: apiKeysQuery.isLoading,
    createApiKey: createMutation.mutate,
    deleteApiKey: deleteMutation.mutate,
    updateApiKey: updateMutation.mutate,
    toggleApiKeyStatus: toggleStatusMutation.mutate,
    isToggling: toggleStatusMutation.isPending,
  };
}
