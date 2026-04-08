import { z } from "zod";

const emailSchema = z
  .string()
  .min(1, "E-mail é obrigatório")
  .email("E-mail inválido");

const strongPasswordSchema = z
  .string()
  .min(8, "Senha deve ter no mínimo 8 caracteres")
  .regex(/[A-Z]/, "Senha deve conter letras maiúsculas")
  .regex(/[a-z]/, "Senha deve conter letras minúsculas")
  .regex(/\d/, "Senha deve conter números")
  .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, "Senha deve conter caracteres especiais");

const weakPasswordSchema = z
  .string()
  .min(6, "Senha deve ter no mínimo 6 caracteres");

/**
 * Login form validation
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Senha é obrigatória"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Set Password form validation (uses weaker password rules for forced password change)
 */
export const setPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Senha atual é obrigatória"),
    newPassword: weakPasswordSchema,
    confirmPassword: z.string().min(1, "Confirmação de senha é obrigatória"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });

export type SetPasswordFormData = z.infer<typeof setPasswordSchema>;

/**
 * Client Signup form validation
 */
export const clientSignupSchema = z
  .object({
    name: z
      .string()
      .min(1, "Nome é obrigatório")
      .min(3, "Nome deve ter no mínimo 3 caracteres"),
    email: emailSchema,
    companyName: z
      .string()
      .min(1, "Nome da empresa é obrigatório")
      .min(3, "Nome da empresa deve ter no mínimo 3 caracteres"),
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Confirmação de senha é obrigatória"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });

export type ClientSignupFormData = z.infer<typeof clientSignupSchema>;

/**
 * User creation form validation
 */
export const createUserSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, "Senha é obrigatória")
    .min(8, "Senha deve ter no mínimo 8 caracteres"),
  role: z.enum(["internal", "client"], {
    errorMap: () => ({ message: "Role inválido" }),
  }),
  clientIds: z.array(z.string()).optional(),
  internalPages: z.array(z.string()).optional(),
});

export type CreateUserFormData = z.infer<typeof createUserSchema>;
