import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-extras/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LifeBuoy, Trash2, Tag, X, AlertTriangle, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { initials } from "@/lib/format";
import { usePermissions } from "@/hooks/use-permissions";

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
  const { isAdmin } = usePermissions();
  const qc = useQueryClient();
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [newLabel, setNewLabel] = useState({ name: "", color: "blue" });

  const { data: msgData } = useQuery({
    queryKey: ["support-messages"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("support_messages").select("*").order("created_at", { ascending: false });
      if (error) {
        if (/does not exist|schema cache/i.test(error.message)) return { rows: [] as any[], missing: true };
        throw error;
      }
      return { rows: (data ?? []) as any[], missing: false };
    },
  });
  const messages = msgData?.rows ?? [];
  const missing = msgData?.missing ?? false;

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
  const labelById = (id: string) => labels.find((l: any) => l.id === id);

  const { data: profiles } = useQuery({
    queryKey: ["team-min"],
    enabled: isAdmin,
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email, avatar_url").order("full_name")).data ?? [],
  });
  const profileById = (id?: string | null) => profiles?.find((p: any) => p.id === id);

  const toggleLabel = useMutation({
    mutationFn: async ({ id, labelId, has }: { id: string; labelId: string; has: boolean }) => {
      const msg = messages.find((m: any) => m.id === id);
      const next = has ? (msg.label_ids ?? []).filter((x: string) => x !== labelId) : [...(msg.label_ids ?? []), labelId];
      const { error } = await (supabase as any).from("support_messages").update({ label_ids: next }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["support-messages"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("support_messages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["support-messages"] }); toast.success("Mensagem excluída."); },
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["support-labels"] }); qc.invalidateQueries({ queryKey: ["support-messages"] }); toast.success("Etiqueta excluída."); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) {
    return (
      <div>
        <PageHeader eyebrow="Agência" title="Suporte" description="Área restrita." />
        <EmptyState icon={ShieldOff} title="Área restrita a administradores" description="Só administradores podem ver as mensagens de suporte enviadas pela equipe." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Agência"
        title="Suporte"
        description="Mensagens enviadas pela equipe através da bolinha de suporte."
        actions={<Button variant="outline" onClick={() => setLabelsOpen(true)}><Tag className="mr-2 h-4 w-4" />Etiquetas</Button>}
      />

      {missing && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Aplique a migração <strong>20260817130000_support.sql</strong> no Supabase para ativar o Suporte.
        </div>
      )}

      {messages.length === 0 && !missing ? (
        <EmptyState icon={LifeBuoy} title="Nenhuma mensagem ainda" description="Quando alguém falar com o suporte pela bolinha do sistema, a mensagem aparece aqui." />
      ) : (
        <div className="space-y-3">
          {messages.map((m: any) => {
            const author = profileById(m.user_id);
            return (
              <div key={m.id} className="surface-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={author?.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-primary/15 text-primary">{initials(author?.full_name ?? author?.email)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{m.subject}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {author?.full_name ?? author?.email ?? "Usuário"} · {new Date(m.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => remove.mutate(m.id)} title="Excluir">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{m.message}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {labels.map((l: any) => {
                    const p = paletteByKey(l.color);
                    const has = (m.label_ids ?? []).includes(l.id);
                    return (
                      <button
                        key={l.id}
                        onClick={() => toggleLabel.mutate({ id: m.id, labelId: l.id, has })}
                        className={"flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition " + (has ? p.chip : "border-border/60 text-muted-foreground hover:text-foreground")}
                      >
                        <span className={"h-2 w-2 rounded-full " + p.dot} />{l.name}
                      </button>
                    );
                  })}
                  {labels.length === 0 && <span className="text-[11px] text-muted-foreground">Nenhuma etiqueta — crie em "Etiquetas".</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
