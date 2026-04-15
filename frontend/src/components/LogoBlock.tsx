// VexoCrm/frontend/src/components/LogoBlock.tsx
// Logo icon + app name + subtitle block for auth pages (Login).

interface LogoBlockProps {
  /** Icon character or emoji */
  icon: string;
  /** App/brand name */
  name?: string;
  /** Subtitle below the name */
  subtitle?: string;
}

export function LogoBlock({ icon, name, subtitle }: LogoBlockProps) {
  return (
    <>
      <div className="shiny-cta w-14 h-14 rounded-xl bg-electric-indigo/15 flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.20)]">
        <span className="text-electric-indigo font-bold text-xl">{icon}</span>
      </div>
      {(name || subtitle) && (
        <div className="text-center">
          {name && <h1 className="text-2xl font-bold text-[#F8FAFC]">{name}</h1>}
          {subtitle && <p className="mt-1 text-sm text-[#E2E8F0]/60">{subtitle}</p>}
        </div>
      )}
    </>
  );
}
