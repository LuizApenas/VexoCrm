// VexoCrm/frontend/src/pages/SetPassword.tsx
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthLayout } from "@/components/AuthLayout";
import { FormField } from "@/components/FormField";
import { ErrorMessage } from "@/components/ErrorMessage";
import { PageTitle } from "@/components/PageTitle";
import { PasswordStrengthIndicator } from "@/components/PasswordStrengthIndicator";
import { validatePassword } from "@/lib/passwordValidation";
import { setPasswordSchema } from "@/lib/validationSchemas";
import { ZodError } from "zod";

export default function SetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, updateInitialPassword, loading } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const passwordValidation = validatePassword(newPassword);
  const fallbackPath =
    typeof location.state === "object" &&
    location.state !== null &&
    "from" in location.state &&
    typeof location.state.from === "object" &&
    location.state.from !== null &&
    "pathname" in location.state.from
      ? String(location.state.from.pathname || "")
      : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const validData = setPasswordSchema.parse({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      setSubmitting(true);
      await updateInitialPassword(validData.currentPassword, validData.newPassword);
      navigate(fallbackPath || "/crm/dashboard", { replace: true });
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        setError(err.errors[0]?.message || "Dados inválidos.");
        return;
      }

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
    <AuthLayout onSubmit={handleSubmit} maxWidth="md" formGap="gap-5">
      <PageTitle
        title="Definir nova senha"
        lines={[
          `Primeiro acesso detectado para ${user?.email || "sua conta"}.`,
          "Para continuar, troque a senha temporária agora.",
        ]}
      />

      <FormField label="Senha atual" id="current-password">
        <Input
          id="current-password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          disabled={submitting || loading}
          required
        />
      </FormField>

      <FormField label="Nova senha" id="new-password">
        <div className="space-y-3">
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            disabled={submitting || loading}
            required
          />
          {newPassword && <PasswordStrengthIndicator validation={passwordValidation} />}
        </div>
      </FormField>

      <FormField label="Confirmar nova senha" id="confirm-password">
        <Input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          disabled={submitting || loading}
          required
        />
      </FormField>

      <ErrorMessage message={error} />

      <Button type="submit" className="w-full" disabled={submitting || loading}>
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Atualizando...
          </>
        ) : (
          "Atualizar senha"
        )}
      </Button>
    </AuthLayout>
  );
}
