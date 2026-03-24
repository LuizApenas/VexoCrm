import React from "react";
import { PasswordStrength, PasswordValidationResult, getPasswordStrengthColor, getPasswordStrengthLabel } from "@/lib/passwordValidation";
import { Check, X } from "lucide-react";

interface PasswordStrengthIndicatorProps {
  validation: PasswordValidationResult;
}

export function PasswordStrengthIndicator({ validation }: PasswordStrengthIndicatorProps) {
  const { strength, score, requirements } = validation;
  const barWidth = `${(score / 5) * 100}%`;
  const bgColor = getPasswordStrengthColor(strength);
  const label = getPasswordStrengthLabel(strength);

  return (
    <div className="space-y-3">
      {/* Strength Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">Forca da senha</label>
          <span className="text-xs font-medium text-gray-600">{label}</span>
        </div>
        <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full transition-all ${bgColor}`} style={{ width: barWidth }} />
        </div>
      </div>

      {/* Requirements */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-600">Requisitos:</p>
        <ul className="space-y-1">
          <RequirementItem
            label="Minimo de 8 caracteres"
            met={requirements.minLength}
          />
          <RequirementItem
            label="Letras maiusculas"
            met={requirements.hasUppercase}
          />
          <RequirementItem
            label="Letras minusculas"
            met={requirements.hasLowercase}
          />
          <RequirementItem
            label="Numeros"
            met={requirements.hasNumber}
          />
          <RequirementItem
            label="Caracteres especiais (!@#$%^&*)"
            met={requirements.hasSpecialChar}
          />
        </ul>
      </div>
    </div>
  );
}

function RequirementItem({ label, met }: { label: string; met: boolean }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      {met ? (
        <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
      ) : (
        <X className="w-4 h-4 text-gray-300 flex-shrink-0" />
      )}
      <span className={met ? "text-gray-700" : "text-gray-500"}>{label}</span>
    </li>
  );
}
