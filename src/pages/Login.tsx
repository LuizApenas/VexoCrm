import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

export default function Login() {
  const { user, loading, signIn, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (isSignUp) {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      setError(
        isSignUp
          ? "Erro ao criar conta. Verifique os dados e tente novamente."
          : "E-mail ou senha inválidos."
      );
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
          {submitting ? (isSignUp ? "Criando conta..." : "Entrando...") : (isSignUp ? "Criar conta" : "Entrar")}
        </Button>

        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
        >
          {isSignUp ? "Já tem conta? Entrar" : "Não tem conta? Criar uma"}
        </button>
      </form>
    </div>
  );
}
