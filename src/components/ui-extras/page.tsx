import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function PageHeader({
  title, description, actions, eyebrow,
}: { title: string; description?: string; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-primary/80">{eyebrow}</div>
        )}
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label, value, icon: Icon, accent, hint,
}: {
  label: string;
  value: ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "primary" | "success" | "warning" | "destructive";
  hint?: string;
}) {
  const accentMap = {
    primary: "from-primary/30 to-primary/0 text-primary",
    success: "from-emerald-500/30 to-emerald-500/0 text-emerald-400",
    warning: "from-amber-500/30 to-amber-500/0 text-amber-400",
    destructive: "from-red-500/30 to-red-500/0 text-red-400",
  } as const;
  const a = accentMap[accent ?? "primary"];
  return (
    <div className="surface-card group relative overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:shadow-elegant">
      <div className={cn("pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br blur-2xl opacity-70", a)} />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-2 font-display text-2xl font-semibold sm:text-3xl">{value}</div>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
        <div className={cn("rounded-lg border border-border/60 bg-surface-2 p-2", a.split(" ").pop())}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon, title, description, action,
}: { icon: React.ComponentType<{ className?: string }>; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="surface-card relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden px-6 py-20 text-center sm:py-24">
      {/* Camadas de brilho decorativas — preenchem o espaço vazio sem competir com o conteúdo */}
      <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-gradient-to-br from-primary/25 to-primary/0 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-16 h-72 w-72 rounded-full bg-gradient-to-tl from-emerald-500/15 to-emerald-500/0 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "20px 20px" }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative"
      >
        <motion.div
          animate={{ scale: [1, 1.06, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-3xl bg-primary/20 blur-xl"
        />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/20 to-primary/5 text-primary shadow-elegant">
          <Icon className="h-7 w-7" />
        </div>
      </motion.div>

      <h3 className="relative mt-5 font-display text-xl font-semibold">{title}</h3>
      {description && <p className="relative mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="relative mt-6">{action}</div>}
    </div>
  );
}

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="surface-card relative overflow-hidden p-10">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
      <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
        Fase 2 · Em construção
      </div>
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
