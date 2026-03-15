import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Building2, LayoutDashboard, LogOut, TableProperties } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

interface ClientPortalNavProps {
  clientId: string;
  clientName: string;
  active: "dashboard" | "leads";
}

export function ClientPortalNav({ clientId, clientName, active }: ClientPortalNavProps) {
  const { isInternalUser, logout, canAccessView } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary/5 px-3 py-1 text-primary">
        <Building2 className="h-3.5 w-3.5" />
        {clientName}
      </Badge>
      {canAccessView("dashboard") && (
        <Button asChild size="sm" variant={active === "dashboard" ? "default" : "outline"}>
          <Link to={`/clientes/${clientId}/dashboard`}>
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
        </Button>
      )}
      {canAccessView("leads") && (
        <Button asChild size="sm" variant={active === "leads" ? "default" : "outline"}>
          <Link to={`/clientes/${clientId}/leads`}>
            <TableProperties className="h-4 w-4" />
            Leads
          </Link>
        </Button>
      )}
      {isInternalUser && (
        <Button asChild size="sm" variant="ghost">
          <Link to="/crm/dashboard">Abrir CRM</Link>
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={handleLogout} disabled={isLoggingOut}>
        <LogOut className="h-4 w-4" />
        {isLoggingOut ? "Saindo..." : "Sair"}
      </Button>
    </div>
  );
}
