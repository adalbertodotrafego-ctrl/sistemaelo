import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/lib/storage";
import { PageHeader } from "@/components/ui-extras/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MentionTextarea } from "@/components/ui-extras/mention-textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus, MoreVertical, Pencil, Trash2, Instagram, ChevronLeft, ChevronRight,
  CalendarDays, LayoutGrid, CalendarRange, Upload, Loader2, X, Link2, AlertTriangle,
  Bell, ExternalLink, Wifi, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { initials } from "@/lib/format";
import { useCurrentUser } from "@/hooks/use-auth";
import { notifyUsers } from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated/social")({
  head: () => ({ meta: [{ title: "Planejamento Elo — Elo Marketing OS" }] }),
  component: PlanejamentoElo,
});

const ELO_INSTAGRAM = "https://www.instagram.com/elomarketing";

const CONTENT_TYPES = [
  { value: "post", label: "Post", color: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  { value: "reel", label: "Reel", color: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  { value: "story", label: "Story", color: "bg-pink-500/15 text-pink-300 border-pink-500/30" },
  { value: "carousel", label: "Carrossel", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  { value: "live", label: "Live", color: "bg-red-500/15 text-red-300 border-red-500/30" },
  { value: "video", label: "Vídeo", color: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
];
const typeMeta = (v: string) => CONTENT_TYPES.find((t) => t.value === v) ?? CONTENT_TYPES[0];

const PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "linkedin", label: "LinkedIn" },
];

const STATUSES = [
  { value: "idea", label: "Ideia" },
  { value: "in_production", label: "Em produção" },
  { value: "scheduled", label: "Agendado" },
  { value: "published", label: "Publicado" },
];
const statusLabel = (v: string) => STATUSES.find((s) => s.value === v)?.label ?? v;

// Tipos de conteúdo que ganham o campo "tipo de vídeo".
const VIDEO_LIKE = new Set(["reel", "video", "live"]);

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function startOfWeek(d: Date) {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7; // 0 = segunda
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const emptyForm = {
  title: "", description: "", link: "", content_type: "post", platform: "instagram",
  video_type: "", media_url: "", scheduled_at: "", status: "idea",
};

function PlanejamentoElo() {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [mentions, setMentions] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [view, setView] = useState<"week" | "month" | "board">("week");
  const [anchor, setAnchor] = useState(new Date());
  const [live, setLive] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);

  const { data: postsData } = useQuery({
    queryKey: ["elo_posts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("elo_posts").select("*").order("scheduled_at", { ascending: true, nullsFirst: false });
      if (error) {
        if (/does not exist|schema cache/i.test(error.message)) return { rows: [] as any[], missingTable: true };
        throw error;
      }
      return { rows: (data ?? []) as any[], missingTable: false };
    },
  });
  const posts = postsData?.rows ?? [];
  const missingTable = postsData?.missingTable ?? false;

  const { data: profiles } = useQuery({
    queryKey: ["team-min"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email, avatar_url").order("full_name")).data ?? [],
  });
  const profileById = (id?: string | null) => profiles?.find((p: any) => p.id === id);

  // Tempo real: planejar em equipe reflete na hora em todas as telas abertas.
  useEffect(() => {
    const channel = supabase
      .channel("elo-posts-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "elo_posts" }, () => {
        qc.invalidateQueries({ queryKey: ["elo_posts"] });
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  // ---- Alertas de movimentação do perfil ----
  const todayKey = ymd(new Date());
  const todaysPosts = useMemo(
    () => posts.filter((p: any) => p.scheduled_at && ymd(new Date(p.scheduled_at)) === todayKey),
    [posts, todayKey],
  );
  const publishedToday = todaysPosts.filter((p: any) => p.status === "published");
  const lastPublished = useMemo(() => {
    const dates = posts
      .filter((p: any) => p.status === "published" && p.scheduled_at)
      .map((p: any) => new Date(p.scheduled_at).getTime());
    return dates.length ? Math.max(...dates) : null;
  }, [posts]);
  const daysSinceLast = lastPublished ? Math.floor((Date.now() - lastPublished) / 86400000) : null;

  // Notificação uma vez por dia (dedupe por localStorage) quando o dia está vazio.
  useEffect(() => {
    if (!user || !postsData || missingTable) return;
    const key = `elo-plan-reminder-${todayKey}`;
    if (todaysPosts.length === 0 && !localStorage.getItem(key)) {
      localStorage.setItem(key, "1");
      notifyUsers([user.id], {
        kind: "warning",
        title: "Planejamento Elo",
        body: "Nada planejado para hoje — hora de movimentar o perfil da Elo! 📲",
        link: "/social",
      });
    }
  }, [user, postsData, missingTable, todaysPosts.length, todayKey]);

  // ---- Formulário ----
  const openCreate = (date?: Date) => {
    setEditingId(null);
    setForm({ ...emptyForm, scheduled_at: date ? `${ymd(date)}T09:00` : "" });
    setMentions([]);
    setOpen(true);
  };
  const openEdit = (p: any) => {
    setEditingId(p.id);
    setForm({
      title: p.title ?? "", description: p.description ?? "", link: p.link ?? "",
      content_type: p.content_type ?? "post", platform: p.platform ?? "instagram",
      video_type: p.video_type ?? "", media_url: p.media_url ?? "",
      scheduled_at: p.scheduled_at ? p.scheduled_at.slice(0, 16) : "", status: p.status ?? "idea",
    });
    setMentions(Array.isArray(p.mentions) ? p.mentions : []);
    setOpen(true);
  };

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const url = await uploadImage("logos", file, "elo-plan");
      setForm((f) => ({ ...f, media_url: url }));
      toast.success("Imagem carregada!");
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao enviar a imagem");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        title: form.title,
        description: form.description || null,
        link: form.link || null,
        content_type: form.content_type,
        platform: form.platform,
        video_type: VIDEO_LIKE.has(form.content_type) ? (form.video_type || null) : null,
        media_url: form.media_url || null,
        mentions,
        scheduled_at: form.scheduled_at || null,
        status: form.status,
      };
      if (editingId) {
        const { error } = await (supabase as any).from("elo_posts").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("elo_posts").insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
      if (mentions.length > 0) {
        await notifyUsers(mentions, {
          kind: "mention", title: "Você foi marcado no Planejamento Elo", body: form.title, link: "/social", excludeUserId: user?.id,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["elo_posts"] });
      setOpen(false); setEditingId(null); setForm(emptyForm); setMentions([]);
      toast.success(editingId ? "Conteúdo atualizado!" : "Conteúdo adicionado ao planejamento!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("elo_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["elo_posts"] });
      setDeleteTarget(null);
      toast.success("Conteúdo excluído!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const quickStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any).from("elo_posts").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["elo_posts"] }),
  });

  const postsByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const p of posts) {
      if (!p.scheduled_at) continue;
      const k = ymd(new Date(p.scheduled_at));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return map;
  }, [posts]);

  const shiftPeriod = (dir: number) => setAnchor((d) => (view === "month" ? new Date(d.getFullYear(), d.getMonth() + dir, 1) : addDays(d, dir * 7)));
  const periodLabel = view === "month"
    ? `${MONTHS[anchor.getMonth()]} de ${anchor.getFullYear()}`
    : (() => { const s = startOfWeek(anchor); const e = addDays(s, 6); return `${s.getDate()}/${pad(s.getMonth() + 1)} – ${e.getDate()}/${pad(e.getMonth() + 1)}`; })();

  return (
    <div>
      <PageHeader
        eyebrow="Elo Marketing"
        title="Planejamento Elo"
        description="Calendário de conteúdo do perfil da Elo — posts, reels, stories e lives, tudo planejado e no ar todo dia."
        actions={
          <>
            <Button variant="outline" asChild>
              <a href={ELO_INSTAGRAM} target="_blank" rel="noopener noreferrer">
                <Instagram className="mr-2 h-4 w-4" />Ver perfil da Elo
              </a>
            </Button>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(emptyForm); setMentions([]); } }}>
              <DialogTrigger asChild><Button onClick={() => openCreate()}><Plus className="mr-2 h-4 w-4" />Novo conteúdo</Button></DialogTrigger>
              <DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editingId ? "Editar conteúdo" : "Novo conteúdo"}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Reel — bastidores da equipe" /></div>

                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Tipo de conteúdo</Label>
                      <Select value={form.content_type} onValueChange={(v) => setForm({ ...form, content_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{CONTENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Plataforma</Label>
                      <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>

                  {VIDEO_LIKE.has(form.content_type) && (
                    <div><Label>Tipo de vídeo</Label>
                      <Input value={form.video_type} onChange={(e) => setForm({ ...form, video_type: e.target.value })} placeholder="Ex: Tutorial, Depoimento, Bastidores, Trend…" />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Agendar para</Label><Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} /></div>
                    <div><Label>Status</Label>
                      <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Descrição / legenda</Label>
                    <MentionTextarea
                      rows={3}
                      value={form.description}
                      onChange={(v) => setForm({ ...form, description: v })}
                      mentionedIds={mentions}
                      onMentionedIdsChange={setMentions}
                      profiles={profiles ?? []}
                      placeholder="Escreva a ideia, o roteiro, a legenda… use @ para marcar alguém da equipe."
                    />
                  </div>

                  <div><Label>Link (referência, briefing, drive…)</Label>
                    <div className="relative">
                      <Link2 className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-9" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://…" />
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-surface/40">
                      {form.media_url ? <img src={form.media_url} alt="Capa" className="h-full w-full object-cover" /> : <span className="px-1 text-center text-[10px] text-muted-foreground">Sem imagem</span>}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Imagem / capa</Label>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => imgRef.current?.click()} disabled={uploading}>
                          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                          {form.media_url ? "Trocar" : "Enviar"}
                        </Button>
                        {form.media_url && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, media_url: "" })}>
                            <X className="mr-1 h-3.5 w-3.5" />Remover
                          </Button>
                        )}
                      </div>
                    </div>
                    <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
                  </div>
                </div>
                <DialogFooter className="sm:justify-between">
                  {editingId ? (
                    <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget({ id: editingId, title: form.title })}>
                      <Trash2 className="mr-2 h-4 w-4" />Excluir
                    </Button>
                  ) : <span />}
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button onClick={() => save.mutate()} disabled={!form.title || save.isPending}>Salvar</Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {missingTable && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            A tabela do Planejamento Elo ainda não foi criada no banco. Aplique a migração
            <strong> 20260716120000_elo_posts.sql</strong> no Supabase para começar a salvar conteúdos. Enquanto isso, a página abre normalmente, mas nada é salvo.
          </div>
        </div>
      )}

      {/* Alertas de movimentação do perfil */}
      {!missingTable && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className={"surface-card flex items-center gap-3 p-4 " + (todaysPosts.length === 0 ? "border-amber-500/40" : "")}>
            <div className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border " + (todaysPosts.length === 0 ? "border-amber-500/40 bg-amber-500/10 text-amber-400" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400")}>
              {todaysPosts.length === 0 ? <AlertTriangle className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Hoje</div>
              <div className="truncate text-sm font-semibold">
                {todaysPosts.length === 0 ? "Nada planejado — movimente o perfil!" : `${todaysPosts.length} conteúdo(s) · ${publishedToday.length} publicado(s)`}
              </div>
            </div>
          </div>
          <div className={"surface-card flex items-center gap-3 p-4 " + (daysSinceLast != null && daysSinceLast >= 2 ? "border-amber-500/40" : "")}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-surface/60 text-primary">
              <Bell className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Última publicação</div>
              <div className="truncate text-sm font-semibold">
                {daysSinceLast == null ? "Nenhuma ainda" : daysSinceLast === 0 ? "Hoje 🎉" : daysSinceLast === 1 ? "Ontem" : `Há ${daysSinceLast} dias`}
              </div>
            </div>
          </div>
          <a href={ELO_INSTAGRAM} target="_blank" rel="noopener noreferrer" className="surface-card flex items-center gap-3 p-4 transition hover:border-primary/40">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-pink-500/40 bg-pink-500/10 text-pink-400">
              <Instagram className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Perfil da Elo</div>
              <div className="truncate text-sm font-semibold">@elomarketing</div>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        </div>
      )}

      {/* Controles de visualização */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-border/60 p-0.5">
          {([["week", "Semana", CalendarRange], ["month", "Mês", CalendarDays], ["board", "Quadro", LayoutGrid]] as const).map(([v, label, Icon]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={"flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition " + (view === v ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}
            >
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Wifi className={"h-3.5 w-3.5 " + (live ? "text-emerald-400" : "text-muted-foreground/50")} />
            {live ? "Ao vivo" : "Conectando…"}
          </div>
          {view !== "board" && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shiftPeriod(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="min-w-36 text-center text-sm font-medium capitalize">{periodLabel}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shiftPeriod(1)}><ChevronRight className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" className="ml-1 h-8" onClick={() => setAnchor(new Date())}>Hoje</Button>
            </div>
          )}
        </div>
      </div>

      {view === "week" && <WeekView anchor={anchor} postsByDay={postsByDay} onAdd={openCreate} onEdit={openEdit} profileById={profileById} />}
      {view === "month" && <MonthView anchor={anchor} postsByDay={postsByDay} onAdd={openCreate} onEdit={openEdit} />}
      {view === "board" && <BoardView posts={posts} onEdit={openEdit} onDelete={setDeleteTarget} onStatus={(id, status) => quickStatus.mutate({ id, status })} profileById={profileById} />}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conteúdo?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai excluir "{deleteTarget?.title}" permanentemente. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { remove.mutate(deleteTarget.id); setOpen(false); }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MentionAvatars({ ids, profileById }: { ids?: string[]; profileById: (id?: string | null) => any }) {
  if (!ids || ids.length === 0) return null;
  return (
    <div className="flex -space-x-1.5">
      {ids.slice(0, 4).map((id) => {
        const p = profileById(id);
        if (!p) return null;
        return (
          <Avatar key={id} className="h-5 w-5 border border-background" title={p.full_name ?? p.email}>
            {p.avatar_url && <AvatarImage src={p.avatar_url} alt="" />}
            <AvatarFallback className="bg-primary/15 text-[8px] text-primary">{initials(p.full_name ?? p.email)}</AvatarFallback>
          </Avatar>
        );
      })}
    </div>
  );
}

function MiniCard({ p, onEdit, profileById }: { p: any; onEdit: (p: any) => void; profileById: (id?: string | null) => any }) {
  const t = typeMeta(p.content_type);
  return (
    <button onClick={() => onEdit(p)} className="group w-full rounded-lg border border-border/60 bg-surface-2 p-2 text-left transition hover:border-primary/40">
      {p.media_url && <img src={p.media_url} alt="" className="mb-1.5 h-16 w-full rounded object-cover" />}
      <div className="mb-1 flex items-center gap-1">
        <Badge variant="outline" className={"px-1 py-0 text-[9px] " + t.color}>{t.label}</Badge>
        {p.scheduled_at && <span className="text-[9px] text-muted-foreground">{hhmm(p.scheduled_at)}</span>}
      </div>
      <div className="line-clamp-2 text-[11px] font-medium leading-tight">{p.title}</div>
      <div className="mt-1 flex items-center justify-between">
        <span className={"text-[9px] " + (p.status === "published" ? "text-emerald-400" : "text-muted-foreground")}>{statusLabel(p.status)}</span>
        <MentionAvatars ids={p.mentions} profileById={profileById} />
      </div>
    </button>
  );
}

function WeekView({ anchor, postsByDay, onAdd, onEdit, profileById }: {
  anchor: Date; postsByDay: Map<string, any[]>; onAdd: (d: Date) => void; onEdit: (p: any) => void; profileById: (id?: string | null) => any;
}) {
  const start = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const todayK = ymd(new Date());
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
      {days.map((d, i) => {
        const k = ymd(d);
        const items = postsByDay.get(k) ?? [];
        const isToday = k === todayK;
        return (
          <div key={k} className={"flex min-h-48 flex-col rounded-xl border bg-surface/40 p-2 " + (isToday ? "border-primary/50" : "border-border/60")}>
            <div className="mb-2 flex items-center justify-between px-1">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{WEEKDAYS[i]}</div>
                <div className={"text-sm font-semibold " + (isToday ? "text-primary" : "")}>{d.getDate()}/{pad(d.getMonth() + 1)}</div>
              </div>
              <button onClick={() => onAdd(d)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="Adicionar neste dia">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              {items.map((p) => <MiniCard key={p.id} p={p} onEdit={onEdit} profileById={profileById} />)}
              {items.length === 0 && <div className="flex flex-1 items-center justify-center rounded border border-dashed border-border/40 text-[10px] text-muted-foreground">—</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthView({ anchor, postsByDay, onAdd, onEdit }: {
  anchor: Date; postsByDay: Map<string, any[]>; onAdd: (d: Date) => void; onEdit: (p: any) => void;
}) {
  const gridStart = startOfWeek(startOfMonth(anchor));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const todayK = ymd(new Date());
  const month = anchor.getMonth();
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-7 gap-1 pb-1">
          {WEEKDAYS.map((w) => <div key={w} className="px-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d) => {
            const k = ymd(d);
            const items = postsByDay.get(k) ?? [];
            const isToday = k === todayK;
            const dim = d.getMonth() !== month;
            return (
              <div key={k} className={"group min-h-24 rounded-lg border p-1.5 " + (isToday ? "border-primary/50 bg-primary/5" : "border-border/50 bg-surface/30") + (dim ? " opacity-40" : "")}>
                <div className="mb-1 flex items-center justify-between">
                  <span className={"text-[11px] font-medium " + (isToday ? "text-primary" : "text-muted-foreground")}>{d.getDate()}</span>
                  <button onClick={() => onAdd(d)} className="rounded p-0.5 text-muted-foreground opacity-0 transition hover:text-foreground group-hover:opacity-100"><Plus className="h-3 w-3" /></button>
                </div>
                <div className="space-y-1">
                  {items.slice(0, 3).map((p) => {
                    const t = typeMeta(p.content_type);
                    return (
                      <button key={p.id} onClick={() => onEdit(p)} className={"flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] " + t.color}>
                        <span className="truncate">{p.title}</span>
                      </button>
                    );
                  })}
                  {items.length > 3 && <div className="px-1 text-[9px] text-muted-foreground">+{items.length - 3} mais</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BoardView({ posts, onEdit, onDelete, onStatus, profileById }: {
  posts: any[]; onEdit: (p: any) => void; onDelete: (p: any) => void; onStatus: (id: string, status: string) => void; profileById: (id?: string | null) => any;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {STATUSES.map((col) => {
        const items = posts.filter((p) => p.status === col.value);
        return (
          <div key={col.value} className="surface-card flex flex-col gap-2 p-3">
            <div className="flex items-center justify-between px-1 pb-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{col.label}</h3>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((p) => {
                const t = typeMeta(p.content_type);
                return (
                  <div key={p.id} className="group relative rounded-lg border border-border/60 bg-surface-2 p-3 transition hover:border-primary/40">
                    <div className="absolute right-1.5 top-1.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="rounded p-1 text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground group-hover:opacity-100"><MoreVertical className="h-3.5 w-3.5" /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(p)}><Pencil className="mr-2 h-3.5 w-3.5" />Editar</DropdownMenuItem>
                          {STATUSES.filter((s) => s.value !== p.status).map((s) => (
                            <DropdownMenuItem key={s.value} onClick={() => onStatus(p.id, s.value)}>
                              <Sparkles className="mr-2 h-3.5 w-3.5" />Mover p/ {s.label}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuItem onClick={() => onDelete(p)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-3.5 w-3.5" />Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {p.media_url && <img src={p.media_url} alt="" className="mb-2 h-24 w-full rounded object-cover" />}
                    <div className="mb-1.5 flex items-center gap-1.5 pr-5">
                      <Badge variant="outline" className={"text-[9px] " + t.color}>{t.label}</Badge>
                      <span className="text-[10px] capitalize text-muted-foreground">{p.platform}</span>
                    </div>
                    <div className="text-sm font-medium leading-tight">{p.title}</div>
                    {p.description && <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{p.description}</p>}
                    <div className="mt-2 flex items-center justify-between">
                      {p.scheduled_at ? (
                        <span className="text-[10px] text-primary">{new Date(p.scheduled_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      ) : <span className="text-[10px] text-muted-foreground">Sem data</span>}
                      <MentionAvatars ids={p.mentions} profileById={profileById} />
                    </div>
                  </div>
                );
              })}
              {items.length === 0 && <div className="rounded border border-dashed border-border/40 p-4 text-center text-[11px] text-muted-foreground">Vazio</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
