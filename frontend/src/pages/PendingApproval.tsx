import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Clock3, LogOut } from "lucide-react";

export default function PendingApproval() {
  const { logout, accessProfile } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-lg border-border/80 bg-card/90">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Clock3 className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl">Aguardando liberacao</CardTitle>
            <CardDescription className="text-sm leading-6">
              Sua conta foi criada com sucesso, mas ainda precisa ser associada a um ou mais clientes
              e views pela equipe administrativa.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border/80 bg-background/50 p-4 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Conta:</span>{" "}
              {accessProfile?.email || "sem e-mail"}
            </p>
            {accessProfile?.companyName && (
              <p className="mt-2">
                <span className="font-medium text-foreground">Empresa:</span> {accessProfile.companyName}
              </p>
            )}
          </div>

          <p className="text-sm leading-6 text-muted-foreground">
            Quando o acesso for liberado, o login vai direcionar voce automaticamente para a area do
            cliente.
          </p>

          <Button onClick={logout} variant="outline" className="w-full">
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
