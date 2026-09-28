import type { ReactNode } from "react";

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-xl shadow-foreground/5 sm:p-8">
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-5 flex size-16 items-center justify-center">
          <span className="absolute inset-0 rounded-full border-2 border-dashed border-primary/25" />
          <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-2 font-display text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30">
            RM
          </span>
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="mt-7">{children}</div>

      <div className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">{footer}</div>
    </div>
  );
}
