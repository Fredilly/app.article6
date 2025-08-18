import React from "react";

export default function PageTemplate({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? (
            <p className="text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </header>
      <div>{children}</div>
    </section>
  );
}
