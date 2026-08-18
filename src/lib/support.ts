// =====================================================================
// Suporte em chat — support_messages é a conversa (1 por usuário, mensagem
// raiz), support_replies são as respostas (usuário e admins) dentro dela.
// =====================================================================
import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { notifyUsers } from "@/lib/notifications";
import { useCurrentUser } from "@/hooks/use-auth";

const isMissingTable = (msg?: string) => !!msg && /does not exist|schema cache/i.test(msg);

export function useMyConversation() {
  const { user } = useCurrentUser();
  return useQuery({
    queryKey: ["my-support-conversation", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("support_messages").select("*").eq("user_id", user!.id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) {
        if (isMissingTable(error.message)) return { row: null, missing: true };
        throw error;
      }
      return { row: data ?? null, missing: false };
    },
  });
}

export function useConversationReplies(messageId?: string | null) {
  return useQuery({
    queryKey: ["support-replies", messageId],
    enabled: !!messageId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("support_replies").select("*").eq("message_id", messageId!)
        .order("created_at", { ascending: true });
      if (error) return [];
      return data ?? [];
    },
  });
}

export function useStartConversation() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ subject, message }: { subject: string; message: string }) => {
      if (!user) throw new Error("Faça login para falar com o suporte");
      const { error } = await (supabase as any).from("support_messages").insert({
        user_id: user.id, subject: subject.trim(), message: message.trim(),
      });
      if (error) {
        if (isMissingTable(error.message)) {
          throw new Error("Suporte ainda não está configurado neste ambiente — aplique as migrações de suporte.");
        }
        throw error;
      }
      try {
        const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
        await notifyUsers((admins ?? []).map((a: any) => a.user_id), {
          kind: "info", title: "Nova mensagem de suporte", body: subject.trim(), link: "/support", excludeUserId: user.id,
        });
      } catch { /* best-effort */ }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-support-conversation"] }),
  });
}

export function useSendReply(messageId: string | undefined, opts: { notifyAdmins?: boolean; notify?: string[]; notifyTitle: string }) {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      if (!user || !messageId) throw new Error("Conversa inválida");
      const { error } = await (supabase as any).from("support_replies").insert({
        message_id: messageId, sender_id: user.id, body: body.trim(),
      });
      if (error) throw error;
      try {
        const targets = opts.notifyAdmins
          ? ((await supabase.from("user_roles").select("user_id").eq("role", "admin")).data ?? []).map((a: any) => a.user_id)
          : (opts.notify ?? []);
        await notifyUsers(targets, { kind: "info", title: opts.notifyTitle, body: body.trim(), link: "/support", excludeUserId: user.id });
      } catch { /* best-effort */ }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-replies", messageId] });
      qc.invalidateQueries({ queryKey: ["my-support-conversation"] });
      qc.invalidateQueries({ queryKey: ["support-conversations"] });
    },
  });
}

// Admin: lista de todas as conversas (uma por usuário).
export function useSupportConversations() {
  return useQuery({
    queryKey: ["support-conversations"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("support_messages").select("*").order("created_at", { ascending: false });
      if (error) {
        if (isMissingTable(error.message)) return { rows: [] as any[], missing: true };
        throw error;
      }
      return { rows: (data ?? []) as any[], missing: false };
    },
  });
}

export function useAllReplies() {
  return useQuery({
    queryKey: ["support-replies-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("support_replies").select("*").order("created_at", { ascending: true });
      if (error) return [] as any[];
      return (data ?? []) as any[];
    },
  });
}

// Recarrega quando qualquer mensagem/resposta de suporte muda — usado tanto
// pela bolinha (o próprio usuário) quanto pela página de admin.
export function useSupportRealtime(scope: "mine" | "admin", userId?: string) {
  const qc = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (scope === "mine" && !userId) return;
    const refresh = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["my-support-conversation"] });
        qc.invalidateQueries({ queryKey: ["support-replies"] });
        qc.invalidateQueries({ queryKey: ["support-conversations"] });
        qc.invalidateQueries({ queryKey: ["support-replies-all"] });
      }, 250);
    };
    const channel = supabase
      .channel(scope === "admin" ? "support-admin-inbox" : `support-mine-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_replies" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages" }, refresh)
      .subscribe();
    return () => { clearTimeout(timer.current); supabase.removeChannel(channel); };
  }, [scope, userId, qc]);
}
