import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-extras/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Bell, BellRing, BellOff, CheckCheck, Trash2 } from "lucide-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useCurrentUser } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notificações — Elo Marketing OS" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const push = usePushNotifications();
  const [confirmClear, setConfirmClear] = useState(false);
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

  const clearAll = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await supabase.from("notifications").delete().eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      setConfirmClear(false);
      toast.success("Notificações limpas!");
    },
    onError: (e: Error) => toast.error(e.message),
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
            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirmClear(true)} disabled={!data || data.length === 0}>
              <Trash2 className="mr-2 h-4 w-4" />Limpar notificações
            </Button>
          </>
        }
      />

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar todas as notificações?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai excluir permanentemente todas as suas notificações, lidas ou não. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => clearAll.mutate()}>Limpar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
