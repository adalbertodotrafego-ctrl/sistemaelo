import { Link, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, Kanban, FolderKanban, ListChecks, CalendarDays,
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
    { to: "/tasks", icon: ListChecks, label: "Tarefas", key: "tasks" },
    { to: "/calendar", icon: CalendarDays, label: "Calendário", key: "calendar" },
    { to: "/meetings", icon: Video, label: "Reuniões", key: "meetings" },
  ]},
  { group: "Crescimento", items: [
    { to: "/marketing", icon: Megaphone, label: "Marketing", key: "marketing" },
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
          Sistema Elo<span className="text-primary"> Marketing</span>
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Agência de Marketing</div>
      </Link>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {filteredNav.map((section) => (
          <div key={section.group}>
            <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {section.group}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.to || pathname.startsWith(item.to + "/");
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onMobileClose}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="sidebar-active"
                        className="absolute inset-y-1 left-0 w-1 rounded-r-full bg-primary glow-primary"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
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
