type SectionDividerProps = {
  label?: string;
};

export function SectionDivider({ label }: SectionDividerProps) {
  return (
    <div className="flex items-center gap-4 py-4 sm:gap-6 sm:py-6">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-border/30" />
      {label ? (
        <span className="shrink-0 rounded-full border border-border/70 bg-card/60 px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          {label}
        </span>
      ) : (
        <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary/70 shadow-[0_0_0_6px_rgba(249,115,22,0.08)]" />
      )}
      <div className="h-px flex-1 bg-gradient-to-r from-border/30 via-border to-transparent" />
    </div>
  );
}
