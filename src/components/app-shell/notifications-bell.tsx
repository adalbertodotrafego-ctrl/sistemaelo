import { useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Bell, BellRing, BellOff, CheckCheck, Trash2 } from "lucide-react";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useCurrentUser } from "@/hooks/use-auth";
import { toast } from "sonner";

/** Sino do topo: abre uma caixinha com as notificações — sem página dedicada. */
export function NotificationsBell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const push = usePushNotifications();

  const { data: items } = useQuery({
    queryKey: ["notifications"],
    enabled: !!user,
    queryFn: async () => (await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(30)).data ?? [],
    refetchInterval: 30000,
  });
  const unread = (items ?? []).filter((n: any) => !n.read_at).length;

  const markAll = useMutation({
    mutationFn: async () => { await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const clearAll = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await supabase.from("notifications").delete().eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notifications"] }); toast.success("Notificações limpas!"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const markRead = useMutation({
    mutationFn: async (id: string) => { await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const open = (n: any) => {
    if (!n.read_at) markRead.mutate(n.id);
    if (n.link) navigate({ to: n.link });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative rounded-md p-2 text-muted-foreground outline-none hover:bg-accent hover:text-foreground">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <Badge className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full px-1 text-[9px]">{unread}</Badge>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">Notificações</span>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.preventDefault(); markAll.mutate(); }}
              title="Marcar todas como lidas"
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <CheckCheck className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => { e.preventDefault(); if ((items ?? []).length) clearAll.mutate(); }}
              title="Limpar todas"
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {push.supported && (
          <button
            onClick={(e) => {
              e.preventDefault();
              if (push.subscribed) push.unsubscribe().catch((err: Error) => toast.error(err.message));
              else push.subscribe().then(() => toast.success("Notificações ativadas neste navegador!")).catch((err: Error) => toast.error(err.message));
            }}
            disabled={push.loading || push.permission === "denied"}
            className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-xs text-muted-foreground hover:bg-accent disabled:opacity-60"
          >
            {push.subscribed ? <BellOff className="h-3.5 w-3.5" /> : <BellRing className="h-3.5 w-3.5" />}
            {push.permission === "denied"
              ? "Notificações bloqueadas pelo navegador"
              : push.subscribed ? "Desativar avisos no navegador" : "Ativar avisos no navegador"}
          </button>
        )}

        <div className="max-h-80 overflow-y-auto">
          {(items ?? []).length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              <Bell className="mx-auto mb-2 h-5 w-5 opacity-40" />
              Você está em dia.
            </div>
          ) : (
            (items ?? []).map((n: any) => (
              <button
                key={n.id}
                onClick={(e) => { e.preventDefault(); open(n); }}
                className={"flex w-full items-start gap-2 border-b border-border/50 px-3 py-2.5 text-left transition hover:bg-accent " + (!n.read_at ? "bg-primary/[0.04]" : "")}
              >
                <span className={"mt-1 h-1.5 w-1.5 shrink-0 rounded-full " + (n.read_at ? "bg-transparent" : "bg-primary")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{n.title}</span>
                  {n.body && <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">{n.body}</span>}
                  <span className="mt-0.5 block text-[10px] text-muted-foreground/70">{new Date(n.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
