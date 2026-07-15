import { Link, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard, Users, Kanban, FolderKanban,
  UserCog, Wallet, Megaphone, Video, FolderOpen, BarChart3, Target,
  Bell, Settings, User as UserIcon, X, FileText, Image,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";

const nav = [
  { group: "Visão geral", items: [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", key: "dashboard" },
  ]},
  { group: "Operação", items: [
    { to: "/clients", icon: Users, label: "Clientes", key: "clients" },
    { to: "/crm", icon: Kanban, label: "CRM", key: "crm" },
    { to: "/projects", icon: FolderKanban, label: "Projetos", key: "projects" },
    { to: "/meetings", icon: Video, label: "Reuniões", key: "meetings" },
  ]},
  { group: "Crescimento", items: [
    { to: "/marketing", icon: Megaphone, label: "Meta Ads", key: "marketing" },
    { to: "/social", icon: Image, label: "Social Media", key: "social" },
    { to: "/goals", icon: Target, label: "Metas", key: "goals" },
    { to: "/reports", icon: BarChart3, label: "Relatórios", key: "reports" },
  ]},
  { group: "Agência", items: [
    { to: "/team", icon: UserCog, label: "Equipe", key: "team" },
    { to: "/finance", icon: Wallet, label: "Financeiro", key: "finance" },
    { to: "/contracts", icon: FileText, label: "Contratos", key: "contracts" },
    { to: "/files", icon: FolderOpen, label: "Arquivos", key: "files" },
  ]},
  { group: "Conta", items: [
    { to: "/notifications", icon: Bell, label: "Notificações", key: "notifications" },
    { to: "/profile", icon: UserIcon, label: "Perfil", key: "profile" },
    { to: "/settings", icon: Settings, label: "Configurações", key: "settings" },
  ]},
] as const;

export function Sidebar({ mobileOpen, onMobileClose }: { mobileOpen: boolean; onMobileClose: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { can } = usePermissions();
  const filteredNav = nav
    .map((sec) => ({ ...sec, items: sec.items.filter((i) => can(i.key)) }))
    .filter((sec) => sec.items.length > 0);

  const content = (
    <div className="flex h-full flex-col">
      <Link to="/dashboard" className="flex h-16 flex-col justify-center border-b border-sidebar-border px-5 leading-tight">
        <div className="font-display text-base font-bold tracking-tight">
          Elo Marketing<span className="text-primary"> OS</span>
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Agência de Marketing</div>
      </Link>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-5">
        {filteredNav.map((section) => (
          <div key={section.group} className="rounded-xl border border-sidebar-border/60 bg-sidebar-accent/[0.04] p-2">
            <div className="px-2 pb-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {section.group}
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
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-sidebar-border bg-sidebar lg:block">
        {content}
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
              {content}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
