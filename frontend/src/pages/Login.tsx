// VexoCrm/frontend/src/pages/Login.tsx
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { FormField } from "@/components/FormField";
import { ErrorMessage } from "@/components/ErrorMessage";
import { LogoBlock } from "@/components/LogoBlock";
import { LoadingScreen } from "@/components/LoadingScreen";

export default function Login() {
  const location = useLocation();
  const { isAuthenticated, mustChangePassword, loading, login, defaultRoute } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const requestedPath =
    typeof location.state === "object" &&
    location.state !== null &&
    "from" in location.state &&
    typeof location.state.from === "object" &&
    location.state.from !== null &&
    "pathname" in location.state.from
      ? String(location.state.from.pathname || "")
      : "";
  const redirectTo = mustChangePassword ? "/set-password" : requestedPath || defaultRoute;

  if (loading) return <LoadingScreen />;

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err: unknown) {
      const errorMessages: Record<string, string> = {
        "auth/user-not-found": "Usuário não encontrado.",
        "auth/wrong-password": "Senha incorreta.",
        "auth/invalid-email": "E-mail inválido.",
        "auth/user-disabled": "Usuário desativado.",
        "auth/too-many-requests": "Muitas tentativas. Tente novamente mais tarde.",
        "auth/invalid-credential": "Credenciais inválidas.",
      };
      const firebaseCode =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code?: string }).code || "")
          : "";
      setError(errorMessages[firebaseCode] || "E-mail ou senha inválidos.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout onSubmit={handleSubmit} maxWidth="sm" formAlign="center">
      <LogoBlock icon="⚡" name="Infinie" subtitle="Soluções Renováveis" />

      <div className="w-full space-y-4">
        <FormField label="E-mail" id="email">
          <Input
            id="email"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Senha" id="password">
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </FormField>
      </div>

      <ErrorMessage message={error} className="text-center" />

      <Button type="submit" className="w-full" size="lg" disabled={submitting}>
        {submitting ? "Entrando..." : "Entrar"}
      </Button>
    </AuthLayout>
  );
}
