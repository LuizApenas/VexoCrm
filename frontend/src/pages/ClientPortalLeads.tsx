import { ClientPortalNav } from "@/components/ClientPortalNav";
import { useClientPortalContext } from "@/components/ClientPortalLayout";
import Leads from "./Leads";

export default function ClientPortalLeads() {
  const { clientId, clientName } = useClientPortalContext();

  return (
    <Leads
      fixedClientId={clientId}
      fixedClientName={clientName}
      title="Base de Leads"
      subtitle={`${clientName} · grade detalhada sincronizada pelo n8n e pronta para consulta`}
      headerRight={<ClientPortalNav clientId={clientId} clientName={clientName} active="leads" />}
    />
  );
}
