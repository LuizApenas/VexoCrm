import React, { useState, useEffect } from "react";
import { Lock, Sparkles, CheckCircle2, ArrowRight, MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { API_BASE_URL } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export interface UpsellCardProps {
  title: string;
  subtitle?: string;
  description: string;
  benefits?: string[];
  moduleName?: string;
  whatsappMessageUpgrade?: string;
  whatsappMessageAvulso?: string;
  whatsappMessage?: string;
  children?: React.ReactNode;
}

export function UpsellCard({
  title,
  subtitle = "Recurso do Plano Avançado",
  description,
  benefits = [],
  moduleName = "Recurso Avançado",
  whatsappMessageUpgrade,
  whatsappMessageAvulso,
  whatsappMessage,
  children,
}: UpsellCardProps) {
  const { getIdToken } = useAuth();
  const [whatsappNumber, setWhatsappNumber] = useState("5511999999999");

  useEffect(() => {
    async function loadSettings() {
      try {
        const token = await getIdToken();
        if (!token) return;
        const res = await fetch(`${API_BASE_URL}/api/admin/settings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.upsellWhatsappNumber) {
            setWhatsappNumber(data.upsellWhatsappNumber);
          }
        }
      } catch (e) {
        // Fallback default
      }
    }
    loadSettings();
  }, [getIdToken]);

  const defaultUpgradeMsg = `Olá! Gostaria de fazer o upgrade para o Plano Avançado para desbloquear o recurso: ${moduleName}.`;
  const defaultAvulsoMsg = `Olá! Gostaria de contratar o módulo avulso: ${moduleName}.`;

  const msgUpgrade = whatsappMessageUpgrade || whatsappMessage || defaultUpgradeMsg;
  const msgAvulso = whatsappMessageAvulso || defaultAvulsoMsg;

  const cleanPhone = whatsappNumber.replace(/\D/g, "");
  const whatsappUrlUpgrade = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msgUpgrade)}`;
  const whatsappUrlAvulso = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msgAvulso)}`;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-purple-500/30 shadow-lg">
      {/* Background Preview Blur (se houver conteúdo demonstrativo embaixo) */}
      {children && (
        <div className="absolute inset-0 filter blur-sm opacity-15 pointer-events-none select-none overflow-hidden">
          {children}
        </div>
      )}

      {/* Card de Destaque */}
      <Card className="relative z-10 border-0 bg-gradient-to-br from-amber-500/10 via-card/90 to-purple-500/10 dark:from-amber-950/40 dark:via-zinc-900/90 dark:to-purple-950/40 backdrop-blur-md">
        <CardContent className="p-6 sm:p-8 text-center max-w-2xl mx-auto space-y-5">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Lock className="w-6 h-6" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-xs px-2.5 py-0.5 font-bold">
                🔒 {subtitle}
              </Badge>
              <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 text-xs px-2.5 py-0.5 font-bold">
                🟣 Plano Avançado
              </Badge>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-foreground">{title}</h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>

          {benefits.length > 0 && (
            <div className="bg-card/60 dark:bg-zinc-900/60 border border-border dark:border-zinc-800/80 rounded-xl p-4 text-left space-y-2 max-w-md mx-auto">
              <span className="text-[11px] font-bold text-foreground uppercase tracking-wider block mb-1">
                O que você ganha com este recurso:
              </span>
              {benefits.map((b, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              className="w-full sm:w-auto bg-gradient-to-r from-amber-600 to-purple-600 hover:from-amber-700 hover:to-purple-700 text-white font-bold gap-2 shadow-md hover:shadow-lg transition-all text-xs sm:text-sm h-11 px-5"
              onClick={() => window.open(whatsappUrlUpgrade, "_blank", "noopener,noreferrer")}
            >
              <Sparkles className="w-4 h-4" />
              🚀 Fazer Upgrade para o Plano Avançado
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto border-purple-500/40 text-purple-600 dark:text-purple-300 hover:bg-purple-500/10 font-bold gap-2 text-xs sm:text-sm h-11 px-5"
              onClick={() => window.open(whatsappUrlAvulso, "_blank", "noopener,noreferrer")}
            >
              <MessageCircle className="w-4 h-4" />
              🧩 Contratar Módulo Avulso
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
