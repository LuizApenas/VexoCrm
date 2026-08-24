import React, { type ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface TenantScopeBoundaryProps {
  tenantId: string | undefined | null;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * TenantScopeBoundary
 *
 * Barreira de isolamento de estado por tenant.
 *
 * Utiliza o ciclo de vida do React com key escopada para:
 * 1. Desmontar imediatamente toda a árvore do tenant anterior na troca de empresa
 *    (destruindo drafts, dirty flags, timers e seleções presas em useState/useRef).
 * 2. Montar uma árvore nova limpa e zerada para o novo tenant.
 * 3. Renderizar feedback de carregamento em vez de exibir dados de outro tenant enquanto carrega.
 */
export function TenantScopeBoundary({
  tenantId,
  children,
  fallback,
}: TenantScopeBoundaryProps) {
  if (!tenantId) {
    return (
      fallback || (
        <div className="flex h-36 w-full items-center justify-center p-6 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2 text-indigo-500" />
          <span className="text-sm font-medium">Carregando dados da empresa...</span>
        </div>
      )
    );
  }

  return (
    <div key={`tenant-scope-boundary-${tenantId}`} className="w-full">
      {children}
    </div>
  );
}
