import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-extras/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, BellRing, BellOff, CheckCheck } from "lucide-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notificações — Elo Marketing OS" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const push = usePushNotifications();
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await supabase.from("notifications").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const markAll = useMutation({
    mutationFn: async () => {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const openNotification = (n: any) => {
    if (!n.read_at) markRead.mutate(n.id);
    if (n.link) navigate({ to: n.link });
  };

  return (
    <div>
      <PageHeader
        eyebrow="Conta"
        title="Notificações"
        description="Avisos, lembretes e atualizações do sistema."
        actions={
          <>
            {push.supported && (
              push.subscribed ? (
                <Button variant="outline" onClick={() => push.unsubscribe().catch((e: Error) => toast.error(e.message))} disabled={push.loading}>
                  <BellOff className="mr-2 h-4 w-4" />Desativar notificações do navegador
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => push.subscribe().then(() => toast.success("Notificações ativadas neste navegador!")).catch((e: Error) => toast.error(e.message))}
                  disabled={push.loading || push.permission === "denied"}
                >
                  <BellRing className="mr-2 h-4 w-4" />
                  {push.permission === "denied" ? "Notificações bloqueadas pelo navegador" : "Ativar notificações do navegador"}
                </Button>
              )
            )}
            <Button variant="outline" onClick={() => markAll.mutate()}><CheckCheck className="mr-2 h-4 w-4" />Marcar todas como lidas</Button>
          </>
        }
      />
      {!data || data.length === 0 ? (
        <EmptyState icon={Bell} title="Nenhuma notificação" description="Você está em dia. Avisos chegarão por aqui." />
      ) : (
        <div className="space-y-2">
          {data.map((n: any) => (
            <div key={n.id} onClick={() => openNotification(n)}
              className={"surface-card flex items-start gap-3 p-4 " + (n.link ? "cursor-pointer hover:border-primary/40 " : "") + (!n.read_at ? "border-l-2 border-l-primary" : "")}>
              <Bell className="mt-0.5 h-4 w-4 text-primary" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-medium">{n.title}</div>
                  {!n.read_at && <Badge className="text-[10px]">novo</Badge>}
                </div>
                {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                <div className="mt-1 text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString("pt-BR")}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
