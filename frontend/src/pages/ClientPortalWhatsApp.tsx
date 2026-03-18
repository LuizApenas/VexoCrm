import { ClientPortalNav } from "@/components/ClientPortalNav";
import { useClientPortalContext } from "@/components/ClientPortalLayout";
import WhatsAppInbox from "./WhatsAppInbox";

export default function ClientPortalWhatsApp() {
  const { clientId, clientName } = useClientPortalContext();

  return (
    <WhatsAppInbox
      title="WhatsApp do Cliente"
      subtitle={`${clientName} - conversas e atendimento liberados para esta unidade`}
      headerRight={<ClientPortalNav clientId={clientId} clientName={clientName} active="whatsapp" />}
      allowSessionControls
    />
  );
}
