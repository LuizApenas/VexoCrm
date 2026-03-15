import { ClientPortalNav } from "@/components/ClientPortalNav";
import { useClientPortalContext } from "@/components/ClientPortalLayout";
import Dashboard from "./Dashboard";

export default function ClientPortalDashboard() {
  const { clientId, clientName } = useClientPortalContext();

  return (
    <Dashboard
      fixedClientId={clientId}
      fixedClientName={clientName}
      title="Portal do Cliente"
      subtitle={`${clientName} · indicadores executivos, funil e leitura diária da operação`}
      headerRight={<ClientPortalNav clientId={clientId} clientName={clientName} active="dashboard" />}
    />
  );
}
