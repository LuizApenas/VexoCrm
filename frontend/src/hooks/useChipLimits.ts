// Limites de chip por plano, vindos de configuração (system_settings.chip_limits).
//
// O dono foi explícito: "o número que eu falo normalmente é um exemplo, quanto
// mais personalizável melhor". Então 2 não é constante de código — é dado. O
// código só tem fallback, para a tela não ficar sem resposta antes de a
// configuração chegar.
//
// Menu e tela consomem este mesmo hook: se cada um usasse a sua fonte, voltariam
// a discordar como no print do Sonhare.

import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { CHIP_LIMIT_DEFAULTS, normalizeChipLimits, type ChipLimits } from "@/lib/chipLimit";

export function useChipLimits(): ChipLimits {
  const { isAuthenticated, getIdToken } = useAuth();

  const { data } = useQuery({
    queryKey: ["chip-limits"],
    enabled: isAuthenticated,
    // Configuração muda raramente; não vale bater no backend a cada navegação.
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Partial<ChipLimits> | null> => {
      const token = await getIdToken();
      if (!token) return null;
      const res = await fetch(`${API_BASE_URL}/api/system/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const payload = await res.json().catch(() => null);
      return payload?.chipLimits ?? null;
    },
    // Falha de leitura não pode virar bloqueio: cai no default.
    retry: 1,
  });

  return normalizeChipLimits(data ?? CHIP_LIMIT_DEFAULTS);
}
