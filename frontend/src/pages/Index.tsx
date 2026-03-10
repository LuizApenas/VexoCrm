// VexoCrm/frontend/src/pages/Index.tsx
import { ArrowRight, Bot, LayoutDashboard, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/PageShell";
import { PageBanner } from "@/components/PageBanner";

const shortcuts = [
  {
    title: "Dashboard",
    description: "Visualize indicadores, funil, temperatura dos leads e atividade recente.",
    to: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Leads",
    description: "Abra a tabela principal para consultar os leads sincronizados pelo n8n.",
    to: "/leads",
    icon: Users,
  },
  {
    title: "Agente",
    description: "Acompanhe notificações, erros do n8n e ações pendentes da operação.",
    to: "/agente",
    icon: Bot,
  },
];

export default function Index() {
  return (
    <PageShell title="Home" spacing="space-y-6">
      <PageBanner
        label="Menu principal"
        title="Escolha para onde deseja ir"
        description="Esta home concentra os acessos do CRM. Use os atalhos abaixo para abrir o dashboard, consultar leads ou acompanhar o agente operacional."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {shortcuts.map((shortcut) => (
          <Card key={shortcut.to} className="border-border/80 bg-card/80">
            <CardHeader className="space-y-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <shortcut.icon className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-xl">{shortcut.title}</CardTitle>
                <CardDescription>{shortcut.description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full justify-between">
                <Link to={shortcut.to}>
                  Acessar
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
