import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  User,
  changePassword as changeFirebasePassword,
  getIdToken as getFirebaseIdToken,
  loginWithEmail,
  logout as firebaseLogout,
  onAuthChange,
  registerWithEmail,
} from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  firebaseUser: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      setFirebaseUser(user);
      if (user) {
        const shouldChange = isFirstLogin(user) && !hasCompletedInitialPasswordReset(user.uid);
        setMustChangePassword(shouldChange);
      } else {
        setMustChangePassword(false);
      }
      setLoading(false);
    }); 

    return unsubscribe;
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

  return (
    <AuthContext.Provider
      value={{
        user: firebaseUser,
        firebaseUser,
        loading,
        isAuthenticated,
        mustChangePassword,
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
