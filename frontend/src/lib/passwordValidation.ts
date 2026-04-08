/**
 * Password strength validation utilities
 */

export enum PasswordStrength {
  WEAK = "weak",
  MEDIUM = "medium",
  STRONG = "strong",
}

export interface PasswordValidationResult {
  strength: PasswordStrength;
  score: number;
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecialChar: boolean;
  };
  isValid: boolean;
}

const MIN_PASSWORD_LENGTH = 8;
const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;

export function validatePassword(password: string): PasswordValidationResult {
  const requirements = {
    minLength: password.length >= MIN_PASSWORD_LENGTH,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecialChar: SPECIAL_CHAR_REGEX.test(password),
  };

  let score = 0;
  if (requirements.minLength) score++;
  if (requirements.hasUppercase) score++;
  if (requirements.hasLowercase) score++;
  if (requirements.hasNumber) score++;
  if (requirements.hasSpecialChar) score++;

  let strength = PasswordStrength.WEAK;
  if (score >= 4) strength = PasswordStrength.STRONG;
  else if (score >= 3) strength = PasswordStrength.MEDIUM;

  return {
    strength,
    score,
    requirements,
    isValid: strength === PasswordStrength.STRONG,
  };
}

export function getPasswordStrengthLabel(strength: PasswordStrength): string {
  const labels: Record<PasswordStrength, string> = {
    [PasswordStrength.WEAK]: "Fraca",
    [PasswordStrength.MEDIUM]: "Media",
    [PasswordStrength.STRONG]: "Forte",
  };
  return labels[strength];
}

export function getPasswordStrengthColor(strength: PasswordStrength): string {
  const colors: Record<PasswordStrength, string> = {
    [PasswordStrength.WEAK]: "bg-red-500",
    [PasswordStrength.MEDIUM]: "bg-yellow-500",
    [PasswordStrength.STRONG]: "bg-green-500",
  };
  return colors[strength];
}
