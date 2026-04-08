// VexoCrm/frontend/src/pages/Login.tsx
import { getCurrentIdTokenResult } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { FormField } from "@/components/FormField";
import { ErrorMessage } from "@/components/ErrorMessage";
import { LogoBlock } from "@/components/LogoBlock";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Building2, ShieldCheck } from "lucide-react";
import { loginSchema } from "@/lib/validationSchemas";
import { useRateLimit } from "@/hooks/useRateLimit";
import { ZodError } from "zod";

type LoginMode = "client" | "admin";

const loginModeCopy: Record<
  LoginMode,
  {
    title: string;
    description: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
  }
> = {
  client: {
    title: "Acesso do cliente",
    description: "Empresas atendidas pela Vexo entram aqui para consultar seus dados no CRM.",
    emailPlaceholder: "cliente@empresa.com",
    passwordPlaceholder: "Digite sua senha",
  },
  admin: {
    title: "Acesso administrativo",
    description: "Gestores e equipe interna da plataforma entram por este acesso.",
    emailPlaceholder: "gestor@vexo.com",
    passwordPlaceholder: "Digite sua senha",
  },
};

function normalizeAccessRole(value: unknown): "client" | "pending" | "internal" {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (normalized === "client" || normalized === "cliente" || normalized === "customer") {
    return "client";
  }

  if (normalized === "pending" || normalized === "pendente" || normalized === "pending_client") {
    return "pending";
  }

  return "internal";
}

export default function Login() {
  const location = useLocation();
  const { isAuthenticated, mustChangePassword, loading, login, logout, defaultRoute } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const rateLimit = useRateLimit({
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    cooldownMs: 60 * 1000, // 1 minute cooldown
  });
  const requestedPath =
    typeof location.state === "object" &&
    location.state !== null &&
    "from" in location.state &&
    typeof location.state.from === "object" &&
    location.state.from !== null &&
    "pathname" in location.state.from
      ? String(location.state.from.pathname || "")
      : "";
  const [loginMode, setLoginMode] = useState<LoginMode>(
    requestedPath.startsWith("/clientes/") ? "client" : "admin"
  );
  const redirectTo = mustChangePassword ? "/set-password" : requestedPath || defaultRoute;

  if (loading) return <LoadingScreen />;

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check rate limit
    if (rateLimit.isLimited) {
      setError(rateLimit.cooldownMessage);
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      // Validate input
      const validData = loginSchema.parse({
        email: email.trim(),
        password,
      });

      await login(validData.email, validData.password);
      const tokenResult = await getCurrentIdTokenResult(true);
      const accessRole = normalizeAccessRole(tokenResult?.claims?.role);
      const validForSelectedMode =
        loginMode === "client"
          ? accessRole === "client" || accessRole === "pending"
          : accessRole === "internal";

      if (!validForSelectedMode) {
        rateLimit.recordAttempt(false);
        await logout();
        setError(
          loginMode === "client"
            ? "Este acesso e exclusivo para clientes. Use o login administrativo."
            : "Este acesso e exclusivo para admin e gestores. Use o login de cliente."
        );
      } else {
        rateLimit.recordAttempt(true);
      }
    } catch (err: unknown) {
      rateLimit.recordAttempt(false);

      if (err instanceof ZodError) {
        setError(err.errors[0]?.message || "Dados inválidos.");
        return;
      }

      const errorMessages: Record<string, string> = {
        "auth/user-not-found": "Usuario nao encontrado.",
        "auth/wrong-password": "Senha incorreta.",
        "auth/invalid-email": "E-mail invalido.",
        "auth/user-disabled": "Usuario desativado.",
        "auth/too-many-requests": "Muitas tentativas. Tente novamente mais tarde.",
        "auth/invalid-credential": "Credenciais invalidas.",
      };
      const firebaseCode =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code?: string }).code || "")
          : "";
      setError(errorMessages[firebaseCode] || "E-mail ou senha invalidos.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout onSubmit={handleSubmit} maxWidth="sm" formAlign="center">
      <LogoBlock icon="V" name="Infinie" subtitle="Solucoes Renovaveis" />

      <div className="w-full space-y-3">
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/80 bg-background/60 p-1">
          <button
            type="button"
            onClick={() => setLoginMode("client")}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
              loginMode === "client"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Building2 className="h-4 w-4" />
            Clientes
          </button>
          <button
            type="button"
            onClick={() => setLoginMode("admin")}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
              loginMode === "admin"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            Admin / Gestores
          </button>
        </div>

        <div className="w-full rounded-xl border border-border/80 bg-background/40 px-4 py-3 text-left">
          <p className="text-sm font-medium text-foreground">{loginModeCopy[loginMode].title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {loginModeCopy[loginMode].description}
          </p>
        </div>
      </div>

      <div className="w-full space-y-4">
        <FormField label="E-mail" id="email">
          <Input
            id="email"
            type="email"
            placeholder={loginModeCopy[loginMode].emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Senha" id="password">
          <Input
            id="password"
            type="password"
            placeholder={loginModeCopy[loginMode].passwordPlaceholder}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </FormField>
      </div>

      <ErrorMessage message={error} className="text-center" />

      {!rateLimit.isLimited && rateLimit.attemptsLeft > 0 && rateLimit.attemptsLeft < 3 && (
        <div className="text-center text-xs text-amber-600 bg-amber-50 rounded p-2 border border-amber-200">
          Aviso: {rateLimit.attemptsLeft} tentativa(s) restante(s)
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={submitting || rateLimit.isLimited}
      >
        {submitting ? "Entrando..." : "Entrar"}
      </Button>

      {loginMode === "client" && (
        <p className="text-center text-sm text-muted-foreground">
          Ainda nao tem acesso?{" "}
          <Link
            to="/cadastro-cliente"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Criar conta de cliente
          </Link>
        </p>
      )}
    </AuthLayout>
  );
}
