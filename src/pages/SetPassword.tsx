import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SetPassword() {
  const navigate = useNavigate();
  const { user, updateInitialPassword, loading } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Preencha todos os campos.");
      return;
    }

    if (newPassword.length < 6) {
      setError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("A confirmação da senha não confere.");
      return;
    }

    try {
      setSubmitting(true);
      await updateInitialPassword(currentPassword, newPassword);
      navigate("/", { replace: true });
    } catch (err: unknown) {
      const errorCode =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code?: string }).code || "")
          : "";

      const errorByCode: Record<string, string> = {
        "auth/wrong-password": "Senha atual incorreta.",
        "auth/weak-password": "A nova senha é muito fraca.",
        "auth/too-many-requests": "Muitas tentativas. Tente novamente em alguns minutos.",
      };

      setError(errorByCode[errorCode] || "Não foi possível atualizar sua senha.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen w-full bg-background px-4">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-5 p-8 rounded-xl border bg-card shadow-lg max-w-md w-full"
      >
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Definir nova senha</h1>
          <p className="text-sm text-muted-foreground">
            Primeiro acesso detectado para {user?.email || "sua conta"}.
          </p>
          <p className="text-sm text-muted-foreground">
            Para continuar, troque a senha temporária agora.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="current-password">Senha atual</Label>
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            disabled={submitting || loading}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-password">Nova senha</Label>
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            disabled={submitting || loading}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirmar nova senha</Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            disabled={submitting || loading}
            required
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full" disabled={submitting || loading}>
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Atualizando...
            </span>
          ) : (
            "Atualizar senha"
          )}
        </Button>
      </form>
    </div>
  );
}
