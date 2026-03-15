import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  getCurrentIdTokenResult,
  User,
  changePassword as changeFirebasePassword,
  getIdToken as getFirebaseIdToken,
  loginWithEmail,
  logout as firebaseLogout,
  onAuthChange,
  registerWithEmail,
} from "@/lib/firebase";

export type AccessRole = "internal" | "client" | "pending";
export type AccessView = "dashboard" | "leads";
const DEFAULT_CLIENT_VIEWS: AccessView[] = ["dashboard", "leads"];

export interface AuthAccessProfile {
  uid: string;
  email: string | null;
  role: AccessRole;
  clientId: string | null;
  clientIds: string[];
  allowedViews: AccessView[];
  companyName: string | null;
}

interface AuthContextType {
  user: User | null;
  firebaseUser: User | null;
  accessProfile: AuthAccessProfile | null;
  accessRole: AccessRole;
  clientId: string | null;
  clientIds: string[];
  allowedViews: AccessView[];
  loading: boolean;
  isAuthenticated: boolean;
  isInternalUser: boolean;
  isClientUser: boolean;
  isPendingUser: boolean;
  mustChangePassword: boolean;
  defaultRoute: string;
  login: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  updateInitialPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
  canAccessClient: (targetClientId: string) => boolean;
  canAccessView: (view: AccessView) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const PASSWORD_RESET_KEY_PREFIX = "password_reset_done_";

const passwordResetKey = (uid: string) => `${PASSWORD_RESET_KEY_PREFIX}${uid}`;

const hasCompletedInitialPasswordReset = (uid: string) =>
  typeof window !== "undefined" && localStorage.getItem(passwordResetKey(uid)) === "1";

const markInitialPasswordResetAsDone = (uid: string) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(passwordResetKey(uid), "1");
};

const isFirstLogin = (user: User) => {
  const createdAt = user.metadata.creationTime ? new Date(user.metadata.creationTime).getTime() : NaN;
  const lastSignInAt = user.metadata.lastSignInTime
    ? new Date(user.metadata.lastSignInTime).getTime()
    : NaN;

  if (Number.isNaN(createdAt) || Number.isNaN(lastSignInAt)) {
    return false;
  }

  return Math.abs(lastSignInAt - createdAt) < 5000;
};

function normalizeAccessRole(value: unknown): AccessRole {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (normalized === "client" || normalized === "cliente" || normalized === "customer") {
    return "client";
  }

  if (normalized === "pending" || normalized === "pendente" || normalized === "pending_client") {
    return "pending";
  }

  return "internal";
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean)
      )
    );
  }

  if (typeof value === "string" && value.trim()) {
    return Array.from(new Set(value.split(",").map((item) => item.trim()).filter(Boolean)));
  }

  return [];
}

function normalizeAllowedViews(value: unknown, role: AccessRole): AccessView[] {
  const views = normalizeStringArray(value).filter(
    (item): item is AccessView => item === "dashboard" || item === "leads"
  );

  if (role === "client" && views.length === 0) {
    return [...DEFAULT_CLIENT_VIEWS];
  }

  return views;
}

function buildAccessProfile(user: User, claims: Record<string, unknown> = {}): AuthAccessProfile {
  const role = normalizeAccessRole(
    claims.role ??
      claims.userRole ??
      claims.user_type ??
      claims.userType ??
      claims.tipo_usuario
  );
  const rawClientId = claims.clientId ?? claims.client_id ?? claims.companyId ?? claims.empresaId ?? null;
  const directClientId = typeof rawClientId === "string" && rawClientId.trim() ? rawClientId.trim() : null;
  const clientIds = Array.from(new Set([directClientId, ...normalizeStringArray(claims.clientIds)].filter(Boolean)));
  const clientId = role === "client" ? directClientId || clientIds[0] || null : null;
  const allowedViews = role === "client" ? normalizeAllowedViews(claims.allowedViews, role) : [];
  const companyName = typeof claims.companyName === "string" && claims.companyName.trim()
    ? claims.companyName.trim()
    : null;

  return {
    uid: user.uid,
    email: user.email,
    role,
    clientId,
    clientIds: role === "client" ? clientIds : [],
    allowedViews,
    companyName,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [accessProfile, setAccessProfile] = useState<AuthAccessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthChange(async (user) => {
      if (!active) return;

      setFirebaseUser(user);

      if (!user) {
        setAccessProfile(null);
        setMustChangePassword(false);
        setLoading(false);
        return;
      }

      try {
        const tokenResult = await getCurrentIdTokenResult();
        if (!active) return;

        setAccessProfile(buildAccessProfile(user, tokenResult?.claims));
      } catch (error) {
        console.error("Failed to read Firebase custom claims:", error);
        if (!active) return;
        setAccessProfile(buildAccessProfile(user));
      }

      const shouldChange = isFirstLogin(user) && !hasCompletedInitialPasswordReset(user.uid);
      setMustChangePassword(shouldChange);
      setLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true);
      await loginWithEmail(email, password);
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (email: string, password: string, displayName?: string) => {
    try {
      setLoading(true);
      await registerWithEmail(email, password, displayName);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setLoading(true);
      await firebaseLogout();
      setMustChangePassword(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateInitialPassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!firebaseUser) {
        throw new Error("Usuário não autenticado.");
      }

      try {
        setLoading(true);
        await changeFirebasePassword(currentPassword, newPassword);
        markInitialPasswordResetAsDone(firebaseUser.uid);
        setMustChangePassword(false);
      } finally {
        setLoading(false);
      }
    },
    [firebaseUser]
  );

  const getIdToken = useCallback(async (forceRefresh = false): Promise<string | null> => {
    return getFirebaseIdToken(forceRefresh);
  }, []);

  const isAuthenticated = !!firebaseUser;
  const accessRole = accessProfile?.role || "internal";
  const clientId = accessProfile?.clientId || null;
  const clientIds = accessProfile?.clientIds || [];
  const allowedViews = accessProfile?.allowedViews || [];
  const isInternalUser = accessRole === "internal";
  const isClientUser = accessRole === "client";
  const isPendingUser = accessRole === "pending";
  const defaultView = allowedViews.includes("dashboard") ? "dashboard" : allowedViews[0] || "dashboard";
  const canAccessClient = useCallback(
    (targetClientId: string) => isInternalUser || clientIds.includes(targetClientId),
    [clientIds, isInternalUser]
  );
  const canAccessView = useCallback(
    (view: AccessView) => isInternalUser || allowedViews.includes(view),
    [allowedViews, isInternalUser]
  );
  const defaultRoute = isPendingUser
    ? "/aguardando-aprovacao"
    : isClientUser
      ? clientId
        ? `/clientes/${clientId}/${defaultView}`
        : "/aguardando-aprovacao"
      : "/crm/dashboard";

  return (
    <AuthContext.Provider
      value={{
        user: firebaseUser,
        firebaseUser,
        accessProfile,
        accessRole,
        clientId,
        clientIds,
        allowedViews,
        loading,
        isAuthenticated,
        isInternalUser,
        isClientUser,
        isPendingUser,
        mustChangePassword,
        defaultRoute,
        login,
        signIn: login,
        register,
        signUp: register,
        updateInitialPassword,
        logout,
        signOut: logout,
        getIdToken,
        canAccessClient,
        canAccessView,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
