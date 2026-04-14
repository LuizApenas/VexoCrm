import { useContext } from "react";
import { CrmClientContext } from "@/contexts/crm-client-context";

export function useCrmClient() {
  const context = useContext(CrmClientContext);
  if (!context) {
    throw new Error("useCrmClient must be used within CrmClientProvider");
  }
  return context;
}

export function useOptionalCrmClient() {
  return useContext(CrmClientContext);
}
