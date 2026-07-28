import { Link, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard, Users, Kanban, LayoutGrid, CalendarClock, Sparkles,
  UserCog, Wallet, Megaphone, BarChart3, Target,
  FolderOpen, X, FileText, CalendarHeart, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";

const nav = [
  { group: "Visão geral", items: [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", key: "dashboard" },
    { to: "/news", icon: Sparkles, label: "Novidades", key: "news" },
  ]},
  { group: "Operação", items: [
    { to: "/clients", icon: Users, label: "Clientes", key: "clients" },
    { to: "/crm", icon: Kanban, label: "CRM", key: "crm" },
    { to: "/tasks", icon: LayoutGrid, label: "Tarefas", key: "tasks" },
    { to: "/events", icon: CalendarClock, label: "Eventos", key: "events" },
  ]},
  { group: "Crescimento", items: [
    { to: "/marketing", icon: Megaphone, label: "Meta Ads", key: "marketing" },
    { to: "/social", icon: CalendarHeart, label: "Planejamento Elo", key: "social" },
    { to: "/goals", icon: Target, label: "Metas", key: "goals" },
    { to: "/reports", icon: BarChart3, label: "Relatórios", key: "reports" },
  ]},
  { group: "Agência", items: [
    { to: "/team", icon: UserCog, label: "Equipe", key: "team" },
    { to: "/finance", icon: Wallet, label: "Financeiro", key: "finance" },
    { to: "/contracts", icon: FileText, label: "Contratos", key: "contracts" },
    { to: "/files", icon: FolderOpen, label: "Arquivos", key: "files" },
  ]},
] as const;

export function Sidebar({ mobileOpen, onMobileClose, collapsed = false, onToggleCollapsed }: {
  mobileOpen: boolean;
  onMobileClose: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { can } = usePermissions();
  const filteredNav = nav
    .map((sec) => ({ ...sec, items: sec.items.filter((i) => can(i.key)) }))
    .filter((sec) => sec.items.length > 0);

  const content = (mini: boolean) => (
    <div className="flex h-full flex-col">
      <Link
        to="/dashboard"
        className={cn("flex h-16 items-center border-b border-sidebar-border leading-tight", mini ? "justify-center px-2" : "px-5")}
      >
        {mini ? (
          <span className="font-display text-lg font-bold tracking-tight text-primary">OS</span>
        ) : (
          <div className="flex flex-col justify-center">
            <div className="font-display text-base font-bold tracking-tight">
              Elo Marketing<span className="text-primary"> OS</span>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Agência de Marketing</div>
          </div>
        )}
      </Link>

      <nav className={cn("flex-1 overflow-y-auto py-5", mini ? "space-y-1 px-2" : "space-y-4 px-3")}>
        {filteredNav.map((section) => (
          <div key={section.group} className={cn(!mini && "rounded-xl border border-sidebar-border/60 bg-sidebar-accent/[0.04] p-2")}>
            {!mini && (
              <div className="px-2 pb-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {section.group}
              </div>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = pathname === item.to || pathname.startsWith(item.to + "/");
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onMobileClose}
                    title={mini ? item.label : undefined}
                    className={cn(
                      "group flex items-center rounded-lg border text-sm font-medium transition-all",
                      mini ? "justify-center p-2" : "gap-2.5 px-2.5 py-2",
                      active
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-transparent text-sidebar-foreground/80 hover:border-sidebar-border hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors",
                        active
                          ? "border-primary/30 bg-primary/15 text-primary"
                          : "border-sidebar-border/60 bg-sidebar/60 text-muted-foreground group-hover:border-sidebar-border group-hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <item.icon className="h-3.5 w-3.5" />
                    </span>
                    {!mini && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {onToggleCollapsed && (
        <button
          onClick={onToggleCollapsed}
          title={mini ? "Expandir menu" : "Recolher menu"}
          className={cn(
            "hidden items-center gap-2 border-t border-sidebar-border px-4 py-3 text-xs text-muted-foreground transition hover:text-foreground lg:flex",
            mini && "justify-center px-2",
          )}
        >
          {mini ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" />Recolher</>}
        </button>
      )}
    </div>
  );

  return (
    <>
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-300 lg:block", collapsed ? "w-[68px]" : "w-64")}>
        {content(collapsed)}
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={onMobileClose}
              className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
              transition={{ type: "spring", stiffness: 380, damping: 40 }}
              className="fixed inset-y-0 left-0 z-50 w-64 border-r border-sidebar-border bg-sidebar lg:hidden"
            >
              <button onClick={onMobileClose} className="absolute right-3 top-4 rounded p-1 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
              {content(false)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
