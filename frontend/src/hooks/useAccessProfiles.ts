import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL } from "@/lib/api";
import {
  type AccessPermission,
  type AccessPreset,
  type AccessRole,
  type AccessScope,
  type AccessView,
  type ApprovalLevel,
  type InternalPage,
} from "@/lib/access";

export interface AccessProfileRecord {
  key: AccessPreset;
  label: string;
  description: string | null;
  role: AccessRole;
  scopeMode: AccessScope;
  approvalLevel: ApprovalLevel;
  permissions: AccessPermission[];
  internalPages: InternalPage[];
  allowedViews: AccessView[];
  isSystem: boolean;
  isLocked: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export function useAccessProfiles() {
  const { isAuthenticated, canAccessInternalPage, getIdToken } = useAuth();

  return useQuery({
    queryKey: ["access-profiles"],
    enabled: isAuthenticated && canAccessInternalPage("usuarios"),
    queryFn: async (): Promise<AccessProfileRecord[]> => {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Usuario nao autenticado.");
      }

      const res = await fetch(`${API_BASE_URL}/api/admin/access-profiles`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Access profiles fetch failed: ${res.status} ${errText}`);
      }

      const payload = await res.json();
      return Array.isArray(payload.items) ? payload.items : [];
    },
    staleTime: 30 * 1000,
  });
}
