import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./use-auth";

export const ALL_PAGES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "clients", label: "Clientes" },
  { key: "crm", label: "CRM" },
  { key: "projects", label: "Projetos" },
  { key: "tasks", label: "Tarefas" },
  { key: "calendar", label: "Calendário" },
  { key: "meetings", label: "Reuniões" },
  { key: "marketing", label: "Marketing" },
  { key: "social", label: "Social Media" },
  { key: "goals", label: "Metas" },
  { key: "reports", label: "Relatórios" },
  { key: "team", label: "Equipe" },
  { key: "finance", label: "Financeiro" },
  { key: "contracts", label: "Contratos" },
  { key: "files", label: "Arquivos" },
  { key: "notifications", label: "Notificações" },
  { key: "profile", label: "Perfil" },
  { key: "settings", label: "Configurações" },
] as const;

export function usePermissions() {
  const { user } = useCurrentUser();

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin").maybeSingle();
      return !!data;
    },
  });

  const { data: allowed } = useQuery({
    queryKey: ["my-allowed-pages", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles").select("job_role_id").eq("id", user!.id).maybeSingle();
      if (!profile?.job_role_id) return null;
      const { data: role } = await supabase
        .from("job_roles").select("allowed_pages").eq("id", profile.job_role_id).maybeSingle();
      return (role?.allowed_pages as string[]) ?? null;
    },
  });

  const can = (pageKey: string) => {
    if (isAdmin) return true;
    if (!allowed) return true; // no cargo assigned → see everything by default
    return allowed.includes(pageKey);
  };

  return { isAdmin: !!isAdmin, allowedPages: allowed, can };
}
