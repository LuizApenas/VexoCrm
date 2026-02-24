import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export default function Login() {
  const { isAuthenticated, mustChangePassword, loading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={mustChangePassword ? "/set-password" : "/"} replace />;
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
    <div className="flex items-center justify-center min-h-screen w-full bg-background">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col items-center gap-6 p-8 rounded-xl border bg-card shadow-lg max-w-sm w-full"
      >
        <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-xl">⚡</span>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Infinie</h1>
          <p className="text-sm text-muted-foreground mt-1">Soluções Renováveis</p>
        </div>

        <div className="w-full space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        <Button type="submit" className="w-full" size="lg" disabled={submitting}>
          {submitting ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
