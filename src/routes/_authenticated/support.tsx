import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-extras/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LifeBuoy, Trash2, Tag, X, AlertTriangle, ShieldOff, Send } from "lucide-react";
import { toast } from "sonner";
import { initials } from "@/lib/format";
import { usePermissions } from "@/hooks/use-permissions";
import { useSupportConversations, useAllReplies, useSendReply, useSupportRealtime } from "@/lib/support";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({ meta: [{ title: "Suporte — Elo Marketing OS" }] }),
  component: SupportPage,
});

const LABEL_PALETTE = [
  { key: "red", dot: "bg-red-500", chip: "bg-red-500/15 text-red-300 border-red-500/30" },
  { key: "amber", dot: "bg-amber-500", chip: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  { key: "green", dot: "bg-emerald-500", chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  { key: "blue", dot: "bg-blue-500", chip: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  { key: "purple", dot: "bg-purple-500", chip: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  { key: "pink", dot: "bg-pink-500", chip: "bg-pink-500/15 text-pink-300 border-pink-500/30" },
  { key: "cyan", dot: "bg-cyan-500", chip: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" },
  { key: "slate", dot: "bg-slate-500", chip: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
];
const paletteByKey = (k?: string) => LABEL_PALETTE.find((p) => p.key === k) ?? LABEL_PALETTE[3];

function SupportPage() {
  const { isAdmin, } = usePermissions();
  const qc = useQueryClient();
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [newLabel, setNewLabel] = useState({ name: "", color: "blue" });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  useSupportRealtime("admin");

  const { data: convData } = useSupportConversations();
  const conversations = convData?.rows ?? [];
  const missing = convData?.missing ?? false;
  const { data: allReplies } = useAllReplies();

  const { data: labelsData } = useQuery({
    queryKey: ["support-labels"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("support_labels").select("*").order("created_at");
      if (error) return [];
      return data ?? [];
    },
  });
  const labels = labelsData ?? [];

  const { data: profiles } = useQuery({
    queryKey: ["team-min"],
    enabled: isAdmin,
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email, avatar_url").order("full_name")).data ?? [],
  });
  const profileById = (id?: string | null) => profiles?.find((p: any) => p.id === id);

  const repliesFor = (messageId: string) => (allReplies ?? []).filter((r: any) => r.message_id === messageId);
  const lastActivity = (m: any) => {
    const rs = repliesFor(m.id);
    return rs.length > 0 ? rs[rs.length - 1].created_at : m.created_at;
  };
  const sortedConversations = [...conversations].sort((a, b) => new Date(lastActivity(b)).getTime() - new Date(lastActivity(a)).getTime());
  const active = conversations.find((m: any) => m.id === activeId) ?? sortedConversations[0] ?? null;

  const toggleLabel = useMutation({
    mutationFn: async ({ id, labelId, has }: { id: string; labelId: string; has: boolean }) => {
      const msg = conversations.find((m: any) => m.id === id);
      const next = has ? (msg.label_ids ?? []).filter((x: string) => x !== labelId) : [...(msg.label_ids ?? []), labelId];
      const { error } = await (supabase as any).from("support_messages").update({ label_ids: next }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["support-conversations"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("support_messages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["support-conversations"] });
      if (activeId === id) setActiveId(null);
      toast.success("Conversa excluída.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createLabel = useMutation({
    mutationFn: async () => {
      if (!newLabel.name.trim()) throw new Error("Dê um nome à etiqueta");
      const { error } = await (supabase as any).from("support_labels").insert({ name: newLabel.name.trim(), color: newLabel.color });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["support-labels"] }); setNewLabel({ name: "", color: "blue" }); toast.success("Etiqueta criada!"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteLabel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("support_labels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["support-labels"] }); qc.invalidateQueries({ queryKey: ["support-conversations"] }); toast.success("Etiqueta excluída."); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) {
    return (
      <div>
        <PageHeader eyebrow="Agência" title="Suporte" description="Área restrita." />
        <EmptyState icon={ShieldOff} title="Área restrita a administradores" description="Só administradores podem ver as conversas de suporte enviadas pela equipe." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Agência"
        title="Suporte"
        description="Converse em tempo real com a equipe pela bolinha de suporte."
        actions={<Button variant="outline" onClick={() => setLabelsOpen(true)}><Tag className="mr-2 h-4 w-4" />Etiquetas</Button>}
      />

      {missing && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Aplique as migrações <strong>20260817130000_support.sql</strong> e <strong>20260818120000_support_chat.sql</strong> no Supabase para ativar o Suporte.
        </div>
      )}

      {conversations.length === 0 && !missing ? (
        <EmptyState icon={LifeBuoy} title="Nenhuma conversa ainda" description="Quando alguém falar com o suporte pela bolinha do sistema, a conversa aparece aqui." />
      ) : !missing && (
        <div className="flex h-[calc(100vh-14rem)] min-h-[420px] overflow-hidden rounded-xl border border-border bg-card">
          <div className="w-72 shrink-0 overflow-y-auto border-r border-border/60">
            {sortedConversations.map((m: any) => {
              const author = profileById(m.user_id);
              const rs = repliesFor(m.id);
              const preview = rs.length > 0 ? rs[rs.length - 1].body : m.message;
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveId(m.id)}
                  className={"flex w-full items-start gap-2.5 border-b border-border/40 px-3 py-3 text-left transition hover:bg-accent/60 " + (active?.id === m.id ? "bg-accent" : "")}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={author?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-primary/15 text-primary">{initials(author?.full_name ?? author?.email)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{m.subject}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {new Date(lastActivity(m)).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                      </span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{author?.full_name ?? author?.email ?? "Usuário"}</div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground/80">{preview}</p>
                    {(m.label_ids ?? []).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(m.label_ids as string[]).map((id) => {
                          const l = labels.find((x: any) => x.id === id);
                          if (!l) return null;
                          return <span key={id} className={"h-1.5 w-1.5 rounded-full " + paletteByKey(l.color).dot} />;
                        })}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {active ? (
            <ConversationPane
              conversation={active}
              author={profileById(active.user_id)}
              replies={repliesFor(active.id)}
              labels={labels}
              onToggleLabel={(labelId, has) => toggleLabel.mutate({ id: active.id, labelId, has })}
              onDelete={() => setDeleteTarget(active)}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Selecione uma conversa</div>
          )}
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Excluir conversa?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            A conversa "{deleteTarget?.subject}" e todas as respostas são apagadas permanentemente.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => { remove.mutate(deleteTarget.id); setDeleteTarget(null); }}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={labelsOpen} onOpenChange={setLabelsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Etiquetas de suporte</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {labels.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma etiqueta ainda.</p>}
              {labels.map((l: any) => {
                const p = paletteByKey(l.color);
                return (
                  <span key={l.id} className={"flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs " + p.chip}>
                    <span className={"h-2 w-2 rounded-full " + p.dot} />{l.name}
                    <button onClick={() => deleteLabel.mutate(l.id)} className="ml-0.5 opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
                  </span>
                );
              })}
            </div>
            <div className="space-y-2 rounded-lg border border-border/60 p-3">
              <Label>Nova etiqueta</Label>
              <div className="flex gap-2">
                <Input value={newLabel.name} onChange={(e) => setNewLabel({ ...newLabel, name: e.target.value })} placeholder="Ex: Bug, Dúvida, Urgente…" onKeyDown={(e) => { if (e.key === "Enter") createLabel.mutate(); }} />
                <Button onClick={() => createLabel.mutate()} disabled={!newLabel.name.trim() || createLabel.isPending}>Criar</Button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {LABEL_PALETTE.map((p) => (
                  <button key={p.key} onClick={() => setNewLabel({ ...newLabel, color: p.key })} title={p.key}
                    className={"h-6 w-6 rounded-full " + p.dot + " transition " + (newLabel.color === p.key ? "ring-2 ring-offset-2 ring-offset-background ring-white/70" : "opacity-70 hover:opacity-100")} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setLabelsOpen(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConversationPane({ conversation, author, replies, labels, onToggleLabel, onDelete }: {
  conversation: any; author: any; replies: any[]; labels: any[];
  onToggleLabel: (labelId: string, has: boolean) => void; onDelete: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const send = useSendReply(conversation.id, {
    notify: conversation.user_id ? [conversation.user_id] : [],
    notifyTitle: "O suporte respondeu sua mensagem",
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [conversation.id, replies.length]);

  const sendMessage = () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    send.mutate(body);
  };

  const timeline = [
    { id: conversation.id, sender_id: conversation.user_id, body: conversation.message, created_at: conversation.created_at },
    ...replies,
  ];

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={author?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary/15 text-primary">{initials(author?.full_name ?? author?.email)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{conversation.subject}</div>
            <div className="truncate text-xs text-muted-foreground">{author?.full_name ?? author?.email ?? "Usuário"}</div>
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={onDelete} title="Excluir conversa">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-border/40 px-4 py-2">
        {labels.map((l: any) => {
          const p = paletteByKey(l.color);
          const has = (conversation.label_ids ?? []).includes(l.id);
          return (
            <button
              key={l.id}
              onClick={() => onToggleLabel(l.id, has)}
              className={"flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition " + (has ? p.chip : "border-border/60 text-muted-foreground hover:text-foreground")}
            >
              <span className={"h-2 w-2 rounded-full " + p.dot} />{l.name}
            </button>
          );
        })}
        {labels.length === 0 && <span className="text-[11px] text-muted-foreground">Nenhuma etiqueta — crie em "Etiquetas".</span>}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-surface-2/40 p-4">
        {timeline.map((m: any) => {
          const fromRequester = m.sender_id === conversation.user_id;
          return (
            <div key={m.id} className={"flex items-end gap-2 " + (!fromRequester ? "flex-row-reverse" : "")}>
              <div className={"max-w-[70%] rounded-2xl px-3.5 py-2 text-sm " + (!fromRequester ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border border-border/50 bg-surface")}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <div className={"mt-0.5 text-[10px] " + (!fromRequester ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {new Date(m.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-end gap-2 border-t border-border/60 p-3">
        <Textarea
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Responder…"
          className="min-h-9 flex-1 resize-none"
        />
        <Button size="icon" className="shrink-0" onClick={sendMessage} disabled={!text.trim() || send.isPending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
