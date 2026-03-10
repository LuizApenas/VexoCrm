// VexoCrm/frontend/src/components/LoadingScreen.tsx
// Full-screen centered loading spinner.
// Replaces the raw div+Loader2 pattern used while auth state is resolving (Login).

import { Loader2 } from "lucide-react";

export function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen w-full bg-background">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}
