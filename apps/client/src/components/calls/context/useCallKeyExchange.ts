import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { KeyCompleteResult } from "../types";

interface UseCallKeyExchangeParams {
  refreshState: () => Promise<void>;
}

export function useCallKeyExchange({ refreshState }: UseCallKeyExchangeParams) {
  const completeKeyExchangeAsCaller = useCallback(
    async (
      calleeEphemeralPublic: number[],
      calleeKemCiphertext: number[],
      calleeSignature: number[],
      calleeIdentityPublic: number[]
    ) => {
      const result = await invoke<KeyCompleteResult>("complete_call_key_exchange_as_caller", {
        calleeEphemeralPublic,
        calleeKemCiphertext,
        calleeSignature,
        calleeIdentityPublic,
      });
      await refreshState();
      return result;
    },
    [refreshState]
  );

  const completeKeyExchangeAsCallee = useCallback(
    async (callerKemCiphertext: number[]) => {
      await invoke("complete_call_key_exchange_as_callee", { callerKemCiphertext });
      await refreshState();
    },
    [refreshState]
  );

  return {
    completeKeyExchangeAsCaller,
    completeKeyExchangeAsCallee,
  };
}
