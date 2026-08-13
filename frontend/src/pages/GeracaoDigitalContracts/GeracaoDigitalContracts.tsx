import React from "react";
import { PageShell, PageShellContext } from "@/components/PageShell";
import { GeracaoDigitalTabs } from "@/components/GeracaoDigitalTabs";
import { ContractsList } from "./ContractsList";

interface GeracaoDigitalContractsProps {
  isVexoCommercial?: boolean;
}

export default function GeracaoDigitalContracts({ isVexoCommercial = false }: GeracaoDigitalContractsProps) {
  if (isVexoCommercial) {
    return (
      <PageShellContext.Provider value={true}>
        <div className="space-y-4">
          <ContractsList isVexoCommercial={true} />
        </div>
      </PageShellContext.Provider>
    );
  }

  return (
    <PageShell
      title="Contratos GD"
      description="Gerenciamento de contratos gerados a partir das propostas."
    >
      <GeracaoDigitalTabs />
      
      <div className="mt-6">
        <ContractsList />
      </div>
    </PageShell>
  );
}
