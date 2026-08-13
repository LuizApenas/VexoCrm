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
  whatsappMessage?: string;
  children?: React.ReactNode;
}

export function UpsellCard({
  title,
  subtitle = "Exclusivo do Plano Avançado",
  description,
  benefits = [],
  moduleName = "Recurso Avançado",
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

  const defaultMsg = `Olá! Gostaria de fazer o upgrade para o Plano Avançado para desbloquear o recurso: ${moduleName}.`;
  const msgToSend = whatsappMessage || defaultMsg;
  const cleanPhone = whatsappNumber.replace(/\D/g, "");
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msgToSend)}`;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-amber-500/30 shadow-lg">
      {/* Background Preview Blur (se houver conteúdo demonstrativo embaixo) */}
      {children && (
        <div className="filter blur-md opacity-30 pointer-events-none select-none p-6 -mb-32">
          {children}
        </div>
      )}

      {/* Card de Destaque */}
      <Card className="relative z-10 border-0 bg-gradient-to-br from-amber-500/10 via-card/90 to-purple-500/10 dark:from-amber-950/40 dark:via-zinc-900/90 dark:to-purple-950/40 backdrop-blur-md">
        <CardContent className="p-8 text-center max-w-2xl mx-auto space-y-6">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Lock className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-xs px-2.5 py-0.5 font-bold">
                🔒 {subtitle}
              </Badge>
              <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 text-xs px-2.5 py-0.5 font-bold">
                🟣 Plano Avançado (R$ 897/mês)
              </Badge>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>

          {benefits.length > 0 && (
            <div className="bg-card/60 dark:bg-zinc-900/60 border border-border dark:border-zinc-800/80 rounded-xl p-4 text-left space-y-2 max-w-md mx-auto">
              <span className="text-[11px] font-bold text-foreground uppercase tracking-wider block mb-2">
                O que você ganha com o upgrade:
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
              className="w-full sm:w-auto bg-gradient-to-r from-amber-600 to-purple-600 hover:from-amber-700 hover:to-purple-700 text-white font-bold gap-2 shadow-md hover:shadow-lg transition-all text-sm h-11 px-6"
              onClick={() => window.open(whatsappUrl, "_blank", "noopener,noreferrer")}
            >
              <MessageCircle className="w-4 h-4" />
              Fazer Upgrade para o Plano Avançado
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
