import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MentionTextarea } from "@/components/ui-extras/mention-textarea";
import { FormattedText } from "@/components/ui-extras/formatted-text";
import { AttachmentChip } from "@/components/ui-extras/attachment-chip";
import { initials } from "@/lib/format";
import { notifyUsers } from "@/lib/notifications";
import { uploadTaskFile, type Attachment } from "@/lib/storage";
import { useCurrentUser } from "@/hooks/use-auth";
import { MessageCircle, ArrowLeft, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";

export function MessagesButton() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [partner, setPartner] = useState<any>(null);

  const { data: unreadRows } = useQuery({
    queryKey: ["dm-unread", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("direct_messages")
        .select("sender_id")
        .eq("recipient_id", user!.id)
        .is("read_at", null);
      return (data ?? []) as { sender_id: string }[];
    },
  });

  // New incoming messages bump the badge instantly, even with the dialog closed.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`dm-inbox-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages", filter: `recipient_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["dm-unread"] });
        qc.invalidateQueries({ queryKey: ["dm-conversation"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  const unreadTotal = unreadRows?.length ?? 0;
  const unreadBySender = new Map<string, number>();
  (unreadRows ?? []).forEach((r) => unreadBySender.set(r.sender_id, (unreadBySender.get(r.sender_id) ?? 0) + 1));

  return (
    <>
      <button
        onClick={() => { setPartner(null); setOpen(true); }}
        className="relative rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Mensagens"
      >
        <MessageCircle className="h-5 w-5" />
        {unreadTotal > 0 && (
          <Badge className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full px-1 text-[9px]">{unreadTotal}</Badge>
        )}
      </button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPartner(null); }}>
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
          {partner ? (
            <Conversation partner={partner} onBack={() => setPartner(null)} />
          ) : (
            <PeopleList unreadBySender={unreadBySender} onPick={setPartner} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function PeopleList({ unreadBySender, onPick }: { unreadBySender: Map<string, number>; onPick: (p: any) => void }) {
  const { user } = useCurrentUser();

  const { data: profiles } = useQuery({
    queryKey: ["team-min"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email, avatar_url").order("full_name")).data ?? [],
  });

  const people = (profiles ?? []).filter((p: any) => p.id !== user?.id);

  return (
    <>
      <DialogHeader><DialogTitle>Mensagens</DialogTitle></DialogHeader>
      <div className="-mx-2 max-h-[60vh] space-y-0.5 overflow-y-auto px-2">
        {people.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum outro membro na equipe ainda.</p>
        )}
        {people.map((p: any) => {
          const unread = unreadBySender.get(p.id) ?? 0;
          return (
            <button
              key={p.id}
              onClick={() => onPick(p)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition hover:bg-accent"
            >
              <Avatar className="h-9 w-9">
                <AvatarImage src={p.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary/15 text-primary">{initials(p.full_name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{p.full_name ?? p.email}</div>
                <div className="truncate text-xs text-muted-foreground">{p.email}</div>
              </div>
              {unread > 0 && <Badge className="h-5 min-w-5 rounded-full px-1.5 text-[10px]">{unread}</Badge>}
            </button>
          );
        })}
      </div>
    </>
  );
}

function Conversation({ partner, onBack }: { partner: any; onBack: () => void }) {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profiles } = useQuery({
    queryKey: ["team-min"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email, avatar_url").order("full_name")).data ?? [],
  });

  const { data: messages } = useQuery({
    queryKey: ["dm-conversation", user?.id, partner.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("direct_messages")
        .select("*")
        .or(`and(sender_id.eq.${user!.id},recipient_id.eq.${partner.id}),and(sender_id.eq.${partner.id},recipient_id.eq.${user!.id})`)
        .order("created_at", { ascending: true })
        .limit(500);
      return data ?? [];
    },
  });

  // Incoming messages from this partner get marked read while the thread is open.
  useEffect(() => {
    if (!user) return;
    const markRead = async () => {
      await (supabase as any)
        .from("direct_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("sender_id", partner.id)
        .eq("recipient_id", user.id)
        .is("read_at", null);
      qc.invalidateQueries({ queryKey: ["dm-unread"] });
    };
    markRead();

    const channel = supabase
      .channel(`dm-conv-${partner.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages", filter: `sender_id=eq.${partner.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["dm-conversation", user.id, partner.id] });
        markRead();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, partner.id, qc]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useMutation({
    mutationFn: async () => {
      const body = message.trim();
      if (!body && files.length === 0) return;
      setSending(true);
      const uploaded = files.length > 0
        ? await Promise.all(files.map((f) => uploadTaskFile(f, `dm/${user!.id}`)))
        : [];
      const { error } = await (supabase as any).from("direct_messages").insert({
        sender_id: user!.id,
        recipient_id: partner.id,
        body: body || null,
        attachments: uploaded,
      });
      if (error) throw error;

      const senderName = (profiles ?? []).find((p: any) => p.id === user!.id)?.full_name ?? "Alguém";
      await notifyUsers([partner.id], {
        kind: "info",
        title: `Nova mensagem de ${senderName}`,
        body: body || "Enviou um anexo",
        excludeUserId: user?.id,
      });
      const extraMentions = mentionedIds.filter((id) => id !== partner.id);
      if (extraMentions.length > 0) {
        await notifyUsers(extraMentions, {
          kind: "mention",
          title: `${senderName} mencionou você numa conversa`,
          body,
          excludeUserId: user?.id,
        });
      }
    },
    onSuccess: () => {
      setMessage(""); setMentionedIds([]); setFiles([]); setSending(false);
      qc.invalidateQueries({ queryKey: ["dm-conversation", user?.id, partner.id] });
    },
    onError: (e: Error) => { setSending(false); toast.error(e.message); },
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <button onClick={onBack} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <Avatar className="h-7 w-7">
            <AvatarImage src={partner.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary/15 text-[10px] text-primary">{initials(partner.full_name)}</AvatarFallback>
          </Avatar>
          <span className="truncate">{partner.full_name ?? partner.email}</span>
        </DialogTitle>
      </DialogHeader>

      <div ref={scrollRef} className="min-h-[280px] max-h-[420px] flex-1 space-y-3 overflow-y-auto rounded-md border border-border/50 bg-surface-2 p-3">
        {(!messages || messages.length === 0) ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma mensagem ainda. Diga oi!</p>
        ) : messages.map((m: any) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={"flex gap-2 " + (mine ? "flex-row-reverse" : "")}>
              <div className={"max-w-[80%] rounded-lg px-3 py-1.5 text-sm " + (mine ? "bg-primary text-primary-foreground" : "border border-border/50 bg-surface")}>
                {m.body && <FormattedText text={m.body} className="whitespace-pre-wrap break-words" />}
                {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {m.attachments.map((a: Attachment) => <AttachmentChip key={a.path} attachment={a} />)}
                  </div>
                )}
                <div className={"mt-0.5 text-[9px] " + (mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {new Date(m.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pl-2 pr-1 text-xs text-muted-foreground">
              <Paperclip className="h-3 w-3" />{f.name}
              <button type="button" onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { setFiles([...files, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }}
        />
        <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => fileInputRef.current?.click()} title="Anexar arquivo ou imagem">
          <Paperclip className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <MentionTextarea
            rows={1}
            value={message}
            onChange={setMessage}
            mentionedIds={mentionedIds}
            onMentionedIdsChange={setMentionedIds}
            profiles={profiles ?? []}
            placeholder="Escreva uma mensagem… @ menciona alguém"
            onEnter={() => send.mutate()}
          />
        </div>
        <Button className="shrink-0" onClick={() => send.mutate()} disabled={(!message.trim() && files.length === 0) || sending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
}
