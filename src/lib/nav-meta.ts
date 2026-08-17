import {
  Home, Users, Kanban, LayoutGrid, Megaphone,
  CalendarHeart, BarChart3, UserCog, Wallet, FileText, FolderOpen,
  Sparkles, Settings, User, Pin, LifeBuoy, type LucideIcon,
} from "lucide-react";

// Metadados das páginas — usados por Atalhos, Fixar página e pela Home.
export const PAGE_META: { path: string; label: string; icon: string; key: string }[] = [
  { path: "/home", label: "Home", icon: "Home", key: "news" },
  { path: "/clients", label: "Clientes", icon: "Users", key: "clients" },
  { path: "/crm", label: "CRM", icon: "Kanban", key: "crm" },
  { path: "/tasks", label: "Tarefas", icon: "LayoutGrid", key: "tasks" },
  { path: "/marketing", label: "Meta Ads", icon: "Megaphone", key: "marketing" },
  { path: "/social", label: "Planejamento Elo", icon: "CalendarHeart", key: "social" },
  { path: "/reports", label: "Relatórios", icon: "BarChart3", key: "reports" },
  { path: "/team", label: "Equipe", icon: "UserCog", key: "team" },
  { path: "/finance", label: "Financeiro", icon: "Wallet", key: "finance" },
  { path: "/contracts", label: "Contratos", icon: "FileText", key: "contracts" },
  { path: "/files", label: "Arquivos", icon: "FolderOpen", key: "files" },
  { path: "/profile", label: "Meu perfil", icon: "User", key: "profile" },
  { path: "/settings", label: "Configurações", icon: "Settings", key: "settings" },
];

export const ICON_BY_NAME: Record<string, LucideIcon> = {
  Home, Users, Kanban, LayoutGrid, Megaphone,
  CalendarHeart, BarChart3, UserCog, Wallet, FileText, FolderOpen,
  Sparkles, Settings, User, Pin, LifeBuoy,
};
export const iconByName = (name?: string): LucideIcon => ICON_BY_NAME[name ?? "Pin"] ?? Pin;

/** Metadados da página correspondente a um pathname (casa por prefixo). */
export function pageMetaFor(pathname: string) {
  return PAGE_META.find((p) => pathname === p.path || pathname.startsWith(p.path + "/"));
}
