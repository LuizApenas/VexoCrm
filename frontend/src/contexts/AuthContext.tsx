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

export type AccessRole = "internal" | "client";

export interface AuthAccessProfile {
  uid: string;
  email: string | null;
  role: AccessRole;
  clientId: string | null;
}

interface AuthContextType {
  user: User | null;
  firebaseUser: User | null;
  accessProfile: AuthAccessProfile | null;
  accessRole: AccessRole;
  clientId: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  isInternalUser: boolean;
  isClientUser: boolean;
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

  return "internal";
}

function buildAccessProfile(user: User, claims: Record<string, unknown> = {}): AuthAccessProfile {
  const role = normalizeAccessRole(
    claims.role ??
      claims.userRole ??
      claims.user_type ??
      claims.userType ??
      claims.tipo_usuario
  );
  const rawClientId =
    claims.clientId ?? claims.client_id ?? claims.companyId ?? claims.empresaId ?? null;
  const clientId = typeof rawClientId === "string" && rawClientId.trim() ? rawClientId.trim() : null;

  return {
    uid: user.uid,
    email: user.email,
    role,
    clientId: role === "client" ? clientId : null,
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
  const isInternalUser = accessRole === "internal";
  const isClientUser = accessRole === "client";
  const defaultRoute = isClientUser
    ? clientId
      ? `/clientes/${clientId}/dashboard`
      : "/home"
    : "/crm/dashboard";

  return (
    <AuthContext.Provider
      value={{
        user: firebaseUser,
        firebaseUser,
        accessProfile,
        accessRole,
        clientId,
        loading,
        isAuthenticated,
        isInternalUser,
        isClientUser,
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
