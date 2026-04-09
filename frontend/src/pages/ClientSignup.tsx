import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Building2, CheckCircle2 } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { ErrorMessage } from "@/components/ErrorMessage";
import { FormField } from "@/components/FormField";
import { LogoBlock } from "@/components/LogoBlock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_BASE_URL } from "@/lib/api";
import { clientSignupSchema } from "@/lib/validationSchemas";
import { PasswordStrengthIndicator } from "@/components/PasswordStrengthIndicator";
import { validatePassword } from "@/lib/passwordValidation";
import { useRateLimit } from "@/hooks/useRateLimit";
import { ZodError } from "zod";

export default function ClientSignup() {
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const passwordValidation = validatePassword(password);
  const rateLimit = useRateLimit({
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    cooldownMs: 30 * 60 * 1000, // 30 minutes cooldown
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    // Check rate limit
    if (rateLimit.isLimited) {
      setError(rateLimit.cooldownMessage);
      return;
    }

    try {
      const validData = clientSignupSchema.parse({
        name,
        email,
        companyName,
        password,
        confirmPassword,
      });

      setSubmitting(true);
      const res = await fetch(`${API_BASE_URL}/api/client-signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: validData.name.trim(),
          companyName: validData.companyName.trim(),
          email: validData.email.trim(),
          password: validData.password,
        }),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        rateLimit.recordAttempt(false);
        const apiMessage = payload?.error?.message || payload?.error?.details;
        throw new Error(apiMessage || "Nao foi possivel criar a conta.");
      }

      rateLimit.recordAttempt(true);
      setSuccessMessage(
        payload?.message || "Conta criada. Aguarde a associacao do seu acesso pela equipe Vexo."
      );
      setName("");
      setCompanyName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        setError(err.errors[0]?.message || "Dados inválidos.");
        return;
      }
      setError(err instanceof Error ? err.message : "Nao foi possivel criar a conta.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout onSubmit={handleSubmit} maxWidth="md" formAlign="stretch" formGap="gap-5">
      <div className="flex items-start justify-between gap-3">
        <LogoBlock icon="V" name="Criar Conta" subtitle="Cadastro de cliente para acesso ao CRM" />
        <Button asChild variant="ghost" size="sm">
          <Link to="/login">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
      </div>

      <div className="rounded-xl border border-border/80 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
        Preencha os dados da sua empresa. A conta e criada na hora e a equipe da Vexo libera os
        acessos de clientes e views depois.
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Seu nome" id="name">
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </FormField>
        <FormField label="Empresa" id="companyName">
          <Input
            id="companyName"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
          />
        </FormField>
      </div>

      <FormField label="E-mail" id="email">
        <Input
          id="email"
          type="email"
          placeholder="cliente@empresa.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </FormField>

      <FormField label="Senha" id="password">
        <div className="space-y-3">
          <Input
            id="password"
            type="password"
            placeholder="Minimo de 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {password && <PasswordStrengthIndicator validation={passwordValidation} />}
        </div>
      </FormField>

      <FormField label="Confirmar senha" id="confirmPassword">
        <Input
          id="confirmPassword"
          type="password"
          placeholder="Repita sua senha"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </FormField>

      {successMessage ? (
        <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Cadastro recebido</p>
              <p className="mt-1 leading-6">{successMessage}</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <ErrorMessage message={error} variant="banner" />
          {rateLimit.isLimited && (
            <div className="text-center text-xs text-red-300/80 bg-red-500/10 rounded p-2 border border-red-500/20">
              {rateLimit.cooldownMessage}
            </div>
          )}
        </>
      )}

      <Button type="submit" size="lg" disabled={submitting || rateLimit.isLimited}>
        <Building2 className="h-4 w-4" />
        {submitting ? "Criando conta..." : "Criar conta de cliente"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Ja tem cadastro?{" "}
        <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Entrar no sistema
        </Link>
      </p>
    </AuthLayout>
  );
}
