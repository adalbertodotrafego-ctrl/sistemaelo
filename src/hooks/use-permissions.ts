import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./use-auth";

export const ALL_PAGES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "clients", label: "Clientes" },
  { key: "crm", label: "CRM" },
  { key: "tasks", label: "Tarefas" },
  { key: "events", label: "Eventos" },
  { key: "meetings", label: "Reuniões" },
  { key: "marketing", label: "Meta Ads" },
  { key: "social", label: "Planejamento Elo" },
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

// Nunca podem ser desligadas globalmente — sem elas ninguém (nem admin)
// conseguiria navegar de volta para religar o resto.
const ALWAYS_ON_PAGES = new Set(["dashboard", "notifications", "profile", "settings"]);
export const TOGGLEABLE_PAGES = ALL_PAGES.filter((p) => !ALWAYS_ON_PAGES.has(p.key));

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

  // Seções desligadas pelo admin em Configurações — vale para todo mundo,
  // independente de cargo ou de ser admin.
  const { data: disabledPages } = useQuery({
    queryKey: ["agency-disabled-pages"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("agency_settings").select("disabled_pages").limit(1).maybeSingle();
      return (data?.disabled_pages as string[]) ?? [];
    },
  });

  const can = (pageKey: string) => {
    if (!ALWAYS_ON_PAGES.has(pageKey) && disabledPages?.includes(pageKey)) return false;
    if (isAdmin) return true;
    if (!allowed) return true; // no cargo assigned → see everything by default
    return allowed.includes(pageKey);
  };

  return { isAdmin: !!isAdmin, allowedPages: allowed, disabledPages: disabledPages ?? [], can };
}
