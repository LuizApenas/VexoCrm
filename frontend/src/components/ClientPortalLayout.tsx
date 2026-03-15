import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useLeadClients } from "@/hooks/useLeadClients";
import { AlertTriangle, ArrowLeft, Building2 } from "lucide-react";
import { Link, Navigate, Outlet, useOutletContext, useParams } from "react-router-dom";

interface ClientPortalContextValue {
  clientId: string;
  clientName: string;
}

export function useClientPortalContext() {
  return useOutletContext<ClientPortalContextValue>();
}

export function ClientPortalLayout() {
  const { clientId } = useParams();
  const { isClientUser, clientId: scopedClientId, canAccessClient } = useAuth();
  const { data: clients = [], isLoading, error } = useLeadClients();

  if (!clientId) {
    return <Navigate to="/home" replace />;
  }

  if (isClientUser && scopedClientId && !canAccessClient(clientId)) {
    return <Navigate to={`/clientes/${scopedClientId}/dashboard`} replace />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-b-transparent" />
          Carregando portal do cliente...
        </div>
      </div>
    );
  }

  const client = clients.find((item) => item.id === clientId);
  const notFound = !client;
  const errorMessage = error ? (error as Error).message : null;

  if (errorMessage || notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <Card className="w-full max-w-lg border-border/80 bg-card/90">
          <CardHeader className="space-y-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              {notFound ? <Building2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            </div>
            <div className="space-y-1">
              <CardTitle className="text-xl">
                {notFound ? "Cliente nao encontrado" : "Nao foi possivel abrir o portal"}
              </CardTitle>
              <CardDescription>
                {notFound
                  ? "Confira o identificador informado na URL ou selecione um portal valido na landing page."
                  : errorMessage}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full justify-between">
              <Link to="/home">
                Voltar para a landing page
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Outlet context={{ clientId, clientName: client.name }} />
    </div>
  );
}
