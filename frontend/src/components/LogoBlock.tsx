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
      <div className="shiny-cta w-14 h-14 rounded-2xl bg-[#1A5CFF]/15 flex items-center justify-center shadow-[0_0_30px_rgba(26,92,255,0.25)]">
        <span className="text-[#1A5CFF] font-bold text-xl">{icon}</span>
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">{name}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
    </>
  );
}
