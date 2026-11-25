import type { ReactNode } from "react";

type PageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export function PageShell({ eyebrow, title, description, children }: PageShellProps) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 sm:px-6 sm:py-24">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
      <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">{title}</h1>
      <p className="mt-4 max-w-xl text-muted-foreground">{description}</p>
      <div className="mt-12">
        {children ?? (
          <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-border bg-surface text-sm text-muted-foreground">
            Ready to build.
          </div>
        )}
      </div>
    </main>
  );
}
