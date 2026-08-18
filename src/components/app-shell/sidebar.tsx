import { Link, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  Users, Kanban, LayoutGrid, Home as HomeIcon,
  UserCog, Wallet, Megaphone, BarChart3,
  FolderOpen, X, FileText, CalendarHeart, LifeBuoy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { useLang } from "@/hooks/use-language";

const GROUP_KEY: Record<string, string> = {
  "Visão geral": "nav.overview", "Operação": "nav.operation", "Crescimento": "nav.growth", "Agência": "nav.agency",
};

const nav = [
  { group: "Visão geral", items: [
    { to: "/home", icon: HomeIcon, label: "Home", key: "news" },
  ]},
  { group: "Operação", items: [
    { to: "/clients", icon: Users, label: "Clientes", key: "clients" },
    { to: "/crm", icon: Kanban, label: "CRM", key: "crm" },
    { to: "/tasks", icon: LayoutGrid, label: "Tarefas", key: "tasks" },
  ]},
  { group: "Crescimento", items: [
    { to: "/marketing", icon: Megaphone, label: "Meta Ads", key: "marketing" },
    { to: "/social", icon: CalendarHeart, label: "Planejamento Elo", key: "social" },
    { to: "/reports", icon: BarChart3, label: "Relatórios", key: "reports" },
  ]},
  { group: "Agência", items: [
    { to: "/team", icon: UserCog, label: "Equipe", key: "team" },
    { to: "/finance", icon: Wallet, label: "Financeiro", key: "finance" },
    { to: "/contracts", icon: FileText, label: "Contratos", key: "contracts" },
    { to: "/files", icon: FolderOpen, label: "Arquivos", key: "files" },
  ]},
] as const;

export function Sidebar({ mobileOpen, onMobileClose }: {
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { can, isAdmin } = usePermissions();
  const { t } = useLang();
  const filteredNav = nav
    .map((sec) => ({ ...sec, items: sec.items.filter((i) => can(i.key)) }))
    .filter((sec) => sec.items.length > 0);

  const content = () => (
    <div className="flex h-full flex-col">
      <Link to="/home" className="flex h-24 items-center justify-center border-b border-border/60 px-4">
        <img
          src="/logo-mark.png"
          alt="Elo Marketing"
          className="h-16 w-auto invert dark:invert-0"
        />
      </Link>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-5">
        {filteredNav.map((section) => (
          <div key={section.group} className="rounded-xl border border-sidebar-border/60 bg-sidebar-accent/[0.04] p-2">
            <div className="px-2 pb-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {t(GROUP_KEY[section.group] ?? section.group)}
            </div>
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = pathname === item.to || pathname.startsWith(item.to + "/");
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onMobileClose}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-sm font-medium transition-all",
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
                    <span className="truncate">{t(item.label)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {isAdmin && (
          <div className="rounded-xl border border-sidebar-border/60 bg-sidebar-accent/[0.04] p-2">
            <div className="px-2 pb-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {t(GROUP_KEY["Agência"])}
            </div>
            <div className="space-y-1">
              {(() => {
                const active = pathname === "/support" || pathname.startsWith("/support/");
                return (
                  <Link
                    to="/support"
                    onClick={onMobileClose}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-sm font-medium transition-all",
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
                      <LifeBuoy className="h-3.5 w-3.5" />
                    </span>
                    <span className="truncate">Suporte</span>
                  </Link>
                );
              })()}
            </div>
          </div>
        )}
      </nav>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-4 left-4 z-40 hidden w-64 overflow-hidden rounded-2xl border border-border/60 bg-sidebar shadow-lg shadow-black/10 backdrop-blur-xl lg:block">
        {content()}
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
              {content()}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
