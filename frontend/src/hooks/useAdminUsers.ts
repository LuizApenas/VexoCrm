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

export type AdminUserRole = AccessRole;

export interface AdminUserAccess {
  role: AdminUserRole;
  accessPreset: AccessPreset;
  scopeMode: AccessScope;
  approvalLevel: ApprovalLevel;
  clientId: string | null;
  clientIds: string[];
  allowedViews: AccessView[];
  internalPages: InternalPage[];
  permissions: AccessPermission[];
  companyName: string | null;
  isAdmin: boolean;
}

export interface AdminUserRecord {
  uid: string;
  email: string | null;
  displayName: string | null;
  disabled: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
  access: AdminUserAccess;
}

export function useAdminUsers() {
  const { isAuthenticated, canAccessInternalPage, getIdToken } = useAuth();

  return useQuery({
    queryKey: ["admin-users"],
    enabled: isAuthenticated && canAccessInternalPage("usuarios"),
    queryFn: async (): Promise<AdminUserRecord[]> => {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Usuario nao autenticado.");
      }

      const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Admin users fetch failed: ${res.status} ${errText}`);
      }

      const payload = await res.json();
      return Array.isArray(payload.items) ? payload.items : [];
    },
    staleTime: 30 * 1000,
  });
}
