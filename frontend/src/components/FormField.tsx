// VexoCrm/frontend/src/components/FormField.tsx
// Wraps Label + form control (Input, etc.) with consistent spacing.
// Replaces repeated div+Label+Input pattern in Login and SetPassword.

import { Label } from "@/components/ui/label";
import type { ReactNode } from "react";

interface FormFieldProps {
  /** Label text */
  label: string;
  /** ID for the form control (used in htmlFor and should match the Input id) */
  id: string;
  /** Form control (Input, Select, etc.) */
  children: ReactNode;
}

export function FormField({ label, id, children }: FormFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
