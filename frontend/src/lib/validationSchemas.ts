import { z } from "zod";

const emailSchema = z.string().min(1, "E-mail e obrigatorio").email("E-mail invalido");

const strongPasswordSchema = z
  .string()
  .min(8, "Senha deve ter no minimo 8 caracteres")
  .regex(/[A-Z]/, "Senha deve conter letras maiusculas")
  .regex(/[a-z]/, "Senha deve conter letras minusculas")
  .regex(/\d/, "Senha deve conter numeros")
  .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, "Senha deve conter caracteres especiais");

const weakPasswordSchema = z.string().min(6, "Senha deve ter no minimo 6 caracteres");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Senha e obrigatoria"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const setPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Senha atual e obrigatoria"),
    newPassword: weakPasswordSchema,
    confirmPassword: z.string().min(1, "Confirmacao de senha e obrigatoria"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas nao conferem",
    path: ["confirmPassword"],
  });

export type SetPasswordFormData = z.infer<typeof setPasswordSchema>;

export const clientSignupSchema = z
  .object({
    name: z.string().min(1, "Nome e obrigatorio").min(3, "Nome deve ter no minimo 3 caracteres"),
    email: emailSchema,
    companyName: z
      .string()
      .min(1, "Nome da empresa e obrigatorio")
      .min(3, "Nome da empresa deve ter no minimo 3 caracteres"),
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Confirmacao de senha e obrigatoria"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas nao conferem",
    path: ["confirmPassword"],
  });

export type ClientSignupFormData = z.infer<typeof clientSignupSchema>;

export const createUserSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Senha e obrigatoria").min(8, "Senha deve ter no minimo 8 caracteres"),
  role: z.enum(["internal", "client", "pending"], {
    errorMap: () => ({ message: "Role invalido" }),
  }),
  accessPreset: z.string().min(1, "Preset de acesso invalido").optional(),
  scopeMode: z.enum(["all_clients", "assigned_clients", "no_client_access"]).optional(),
  approvalLevel: z.enum(["none", "operator", "supervisor", "manager", "director"]).optional(),
  clientIds: z.array(z.string()).optional(),
  allowedViews: z.array(z.string()).optional(),
  internalPages: z.array(z.string()).optional(),
  permissions: z.array(z.string()).optional(),
});

export type CreateUserFormData = z.infer<typeof createUserSchema>;
