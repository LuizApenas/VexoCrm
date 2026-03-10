// VexoCrm/frontend/src/components/LogoBlock.tsx
// Logo icon + app name + subtitle block for auth pages (Login).
// Replaces raw div+span+h1+p pattern.

interface LogoBlockProps {
  /** Icon character or emoji */
  icon: string;
  /** App/brand name */
  name: string;
  /** Subtitle below the name */
  subtitle?: string;
}

export function LogoBlock({ icon, name, subtitle }: LogoBlockProps) {
  return (
    <>
      <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
        <span className="text-primary-foreground font-bold text-xl">{icon}</span>
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">{name}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
    </>
  );
}
