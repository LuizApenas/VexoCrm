import { describe, expect, it } from "vitest";
import { PasswordStrength, validatePassword } from "@/lib/passwordValidation";
import { clientSignupSchema, loginSchema, setPasswordSchema } from "@/lib/validationSchemas";

describe("Password Validation", () => {
  describe("validatePassword", () => {
    it("should mark empty password as weak", () => {
      const result = validatePassword("");
      expect(result.strength).toBe(PasswordStrength.WEAK);
      expect(result.isValid).toBe(false);
    });

    it("should reject password with only lowercase", () => {
      const result = validatePassword("abcdefgh");
      expect(result.requirements.hasUppercase).toBe(false);
      expect(result.isValid).toBe(false);
    });

    it("should mark as strong even without numbers if 4+ requirements met", () => {
      const result = validatePassword("Abcdefgh!");
      expect(result.requirements.hasNumber).toBe(false);
      expect(result.strength).toBe(PasswordStrength.STRONG);
    });

    it("should mark as strong even without special char if 4+ requirements met", () => {
      const result = validatePassword("Abcdefgh1");
      expect(result.requirements.hasSpecialChar).toBe(false);
      expect(result.strength).toBe(PasswordStrength.STRONG);
    });

    it("should accept strong password", () => {
      const result = validatePassword("MyPassword123!");
      expect(result.strength).toBe(PasswordStrength.STRONG);
      expect(result.isValid).toBe(true);
      expect(result.requirements.minLength).toBe(true);
      expect(result.requirements.hasUppercase).toBe(true);
      expect(result.requirements.hasLowercase).toBe(true);
      expect(result.requirements.hasNumber).toBe(true);
      expect(result.requirements.hasSpecialChar).toBe(true);
    });

    it("should mark medium strength password", () => {
      const result = validatePassword("Mypasswd");
      expect(result.strength).toBe(PasswordStrength.MEDIUM);
      expect(result.requirements.hasNumber).toBe(false);
      expect(result.requirements.hasSpecialChar).toBe(false);
    });
  });
});

describe("Validation Schemas", () => {
  describe("loginSchema", () => {
    it("should reject invalid email", () => {
      expect(() => {
        loginSchema.parse({
          email: "not-an-email",
          password: "password123",
        });
      }).toThrow();
    });

    it("should reject empty password", () => {
      expect(() => {
        loginSchema.parse({
          email: "user@example.com",
          password: "",
        });
      }).toThrow();
    });

    it("should accept valid login data", () => {
      const result = loginSchema.parse({
        email: "user@example.com",
        password: "password123",
      });
      expect(result.email).toBe("user@example.com");
      expect(result.password).toBe("password123");
    });
  });

  describe("setPasswordSchema", () => {
    it("should reject mismatched passwords", () => {
      expect(() => {
        setPasswordSchema.parse({
          currentPassword: "Current123",
          newPassword: "NewPass123!",
          confirmPassword: "Different123",
        });
      }).toThrow(/nao conferem/i);
    });

    it("should accept matching passwords", () => {
      const result = setPasswordSchema.parse({
        currentPassword: "Current123",
        newPassword: "NewPass123!",
        confirmPassword: "NewPass123!",
      });
      expect(result.newPassword).toBe("NewPass123!");
    });
  });

  describe("clientSignupSchema", () => {
    it("should reject weak password", () => {
      expect(() => {
        clientSignupSchema.parse({
          name: "John Doe",
          email: "john@example.com",
          companyName: "Acme Corp",
          password: "weak",
          confirmPassword: "weak",
        });
      }).toThrow();
    });

    it("should reject invalid email", () => {
      expect(() => {
        clientSignupSchema.parse({
          name: "John Doe",
          email: "invalid-email",
          companyName: "Acme Corp",
          password: "StrongPass123!",
          confirmPassword: "StrongPass123!",
        });
      }).toThrow();
    });

    it("should reject short name", () => {
      expect(() => {
        clientSignupSchema.parse({
          name: "Jo",
          email: "john@example.com",
          companyName: "Acme Corp",
          password: "StrongPass123!",
          confirmPassword: "StrongPass123!",
        });
      }).toThrow();
    });

    it("should accept valid signup data", () => {
      const result = clientSignupSchema.parse({
        name: "John Doe",
        email: "john@example.com",
        companyName: "Acme Corp",
        password: "StrongPass123!",
        confirmPassword: "StrongPass123!",
      });
      expect(result.email).toBe("john@example.com");
      expect(result.name).toBe("John Doe");
    });
  });
});
