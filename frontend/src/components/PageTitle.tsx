// VexoCrm/frontend/src/components/PageTitle.tsx
// Heading + one or more description lines for form pages (SetPassword).
// Replaces raw div+h1+p pattern.

interface PageTitleProps {
  /** Main heading */
  title: string;
  /** Description lines */
  lines?: string[];
}

export function PageTitle({ title, lines = [] }: PageTitleProps) {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      {lines.map((line, i) => (
        <p key={i} className="text-sm text-muted-foreground">
          {line}
        </p>
      ))}
    </div>
  );
}
