import { ClientPortalNav } from "@/components/ClientPortalNav";
import { useClientPortalContext } from "@/components/ClientPortalLayout";
import LeadImports from "./LeadImports";

export default function ClientPortalPlanilhas() {
  const { clientId, clientName } = useClientPortalContext();

  return (
    <LeadImports
      fixedClientId={clientId}
      fixedClientName={clientName}
      title="Planilhas do Cliente"
      subtitle={`${clientName} · importacoes, bases disponiveis e historico operacional`}
      headerRight={<ClientPortalNav clientId={clientId} clientName={clientName} active="planilhas" />}
    />
  );
}
