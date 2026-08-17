import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/lib/storage";
import { PageHeader, EmptyState } from "@/components/ui-extras/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MentionTextarea } from "@/components/ui-extras/mention-textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, MoreVertical, Pencil, Trash2, Instagram, ChevronLeft, ChevronRight,
  CalendarDays, LayoutGrid, CalendarRange, Upload, Loader2, X, Link2, AlertTriangle,
  Bell, ExternalLink, Wifi, Sparkles, CalendarClock, MapPin, Building2, Clock, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { initials } from "@/lib/format";
import { useCurrentUser } from "@/hooks/use-auth";
import { notifyUsers } from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated/social")({
  head: () => ({ meta: [{ title: "Planejamento & Eventos — Elo Marketing OS" }] }),
  component: PlanningAndEventsPage,
});

function PlanningAndEventsPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Elo Marketing"
        title="Planejamento & Eventos"
        description="Calendário de conteúdo do perfil da Elo e a agenda de eventos da agência, tudo num só lugar."
      />
      <ContentPlanningSection />
      <div className="border-t border-border/60 pt-8">
        <EventsSection />
      </div>
    </div>
  );
}

// =====================================================================
// Seção 1 — Planejamento de conteúdo (Instagram, TikTok…)
// =====================================================================

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

const VIDEO_LIKE = new Set(["reel", "video", "live"]);

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function startOfWeek(d: Date) {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const emptyPostForm = {
  title: "", description: "", link: "", content_type: "post", platform: "instagram",
  video_type: "", media_url: "", scheduled_at: "", status: "idea",
};

function ContentPlanningSection() {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyPostForm);
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

  useEffect(() => {
    const channel = supabase
      .channel("elo-posts-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "elo_posts" }, () => {
        qc.invalidateQueries({ queryKey: ["elo_posts"] });
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

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

  const openCreate = (date?: Date) => {
    setEditingId(null);
    setForm({ ...emptyPostForm, scheduled_at: date ? `${ymd(date)}T09:00` : "" });
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
      setOpen(false); setEditingId(null); setForm(emptyPostForm); setMentions([]);
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg font-semibold">Planejamento de conteúdo</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <a href={ELO_INSTAGRAM} target="_blank" rel="noopener noreferrer">
              <Instagram className="mr-2 h-4 w-4" />Ver perfil da Elo
            </a>
          </Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(emptyPostForm); setMentions([]); } }}>
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
        </div>
      </div>

      {missingTable && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            A tabela do Planejamento Elo ainda não foi criada no banco. Aplique a migração
            <strong> 20260716120000_elo_posts.sql</strong> no Supabase para começar a salvar conteúdos. Enquanto isso, a página abre normalmente, mas nada é salvo.
          </div>
        </div>
      )}

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

// =====================================================================
// Seção 2 — Eventos da Elo
// =====================================================================

const EVENT_KINDS = [
  { value: "evento", label: "Evento", color: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  { value: "feira", label: "Feira", color: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  { value: "palestra", label: "Palestra", color: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  { value: "gravacao", label: "Gravação", color: "bg-pink-500/15 text-pink-300 border-pink-500/30" },
  { value: "reuniao", label: "Reunião", color: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" },
  { value: "ativacao", label: "Ativação", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  { value: "viagem", label: "Viagem", color: "bg-orange-500/15 text-orange-300 border-orange-500/30" },
];
const eventKindMeta = (v: string) => EVENT_KINDS.find((k) => k.value === v) ?? EVENT_KINDS[0];

const EVENT_STATUSES = [
  { value: "planned", label: "Planejado" },
  { value: "confirmed", label: "Confirmado" },
  { value: "done", label: "Concluído" },
  { value: "canceled", label: "Cancelado" },
];
const eventStatusLabel = (v: string) => EVENT_STATUSES.find((s) => s.value === v)?.label ?? v;

const emptyEventForm = {
  title: "", description: "", kind: "evento", location: "", link: "",
  responsible_id: "", client_id: "", starts_at: "", ends_at: "", status: "confirmed",
};

const fmtDateTime = (iso: string, allDay: boolean) =>
  new Date(iso).toLocaleString("pt-BR", allDay
    ? { day: "2-digit", month: "long", weekday: "short" }
    : { day: "2-digit", month: "long", weekday: "short", hour: "2-digit", minute: "2-digit" });

function countdown(startsAt: string): { text: string; soon: boolean; now: boolean; past: boolean } {
  const diff = new Date(startsAt).getTime() - Date.now();
  const past = diff < -3 * 3600_000;
  const now = diff <= 0 && !past;
  const h = diff / 3600_000;
  const d = Math.floor(h / 24);
  let text: string;
  if (past) text = "Encerrado";
  else if (now) text = "Acontecendo agora";
  else if (h < 1) text = `Em ${Math.max(1, Math.round(diff / 60000))} min`;
  else if (h < 24) text = `Em ${Math.round(h)}h`;
  else if (d === 1) text = "Amanhã";
  else text = `Em ${d} dias`;
  return { text, soon: !past && !now && h <= 48, now, past };
}

function EventsSection() {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyEventForm);
  const [allDay, setAllDay] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: eventsData } = useQuery({
    queryKey: ["elo-events"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("elo_events").select("*").order("starts_at", { ascending: true });
      if (error) {
        if (/does not exist|schema cache/i.test(error.message)) return { rows: [] as any[], missing: true };
        throw error;
      }
      return { rows: (data ?? []) as any[], missing: false };
    },
  });
  const events = useMemo(() => eventsData?.rows ?? [], [eventsData]);
  const missing = eventsData?.missing ?? false;

  const { data: profiles } = useQuery({
    queryKey: ["team-min"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email, avatar_url").order("full_name")).data ?? [],
  });
  const { data: clients } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => (await supabase.from("clients").select("id, name, company").order("name")).data ?? [],
  });
  const profileById = (id?: string | null) => profiles?.find((p: any) => p.id === id);
  const clientById = (id?: string | null) => clients?.find((c: any) => c.id === id);

  useEffect(() => {
    const channel = supabase
      .channel("elo-events-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "elo_events" }, () => qc.invalidateQueries({ queryKey: ["elo-events"] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const upcoming = useMemo(
    () => events.filter((e: any) => e.status !== "canceled" && !countdown(e.starts_at).past),
    [events],
  );
  const past = useMemo(
    () => events.filter((e: any) => e.status !== "canceled" && countdown(e.starts_at).past),
    [events],
  );
  const soonest = upcoming[0];

  useEffect(() => {
    if (!user || !eventsData || missing) return;
    const soon = upcoming.filter((e: any) => countdown(e.starts_at).soon);
    if (soon.length === 0) return;
    const key = `elo-events-alert-${new Date().toISOString().slice(0, 10)}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    notifyUsers([user.id], {
      kind: "meeting",
      title: soon.length === 1 ? "Evento chegando!" : `${soon.length} eventos chegando`,
      body: soon.length === 1 ? `${soon[0].title} — ${countdown(soon[0].starts_at).text.toLowerCase()}` : "Confira a agenda de eventos da Elo.",
      link: "/social",
    });
  }, [user, eventsData, missing, upcoming]);

  const openCreate = () => { setEditingId(null); setForm(emptyEventForm); setAllDay(false); setOpen(true); };
  const openEdit = (e: any) => {
    setEditingId(e.id);
    setForm({
      title: e.title ?? "", description: e.description ?? "", kind: e.kind ?? "evento",
      location: e.location ?? "", link: e.link ?? "", responsible_id: e.responsible_id ?? "",
      client_id: e.client_id ?? "", starts_at: e.starts_at ? e.starts_at.slice(0, 16) : "",
      ends_at: e.ends_at ? e.ends_at.slice(0, 16) : "", status: e.status ?? "confirmed",
    });
    setAllDay(Boolean(e.all_day));
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Dê um nome ao evento");
      if (!form.starts_at) throw new Error("Defina a data de início");
      const payload: any = {
        title: form.title.trim(),
        description: form.description || null,
        kind: form.kind,
        location: form.location || null,
        link: form.link || null,
        responsible_id: form.responsible_id || null,
        client_id: form.client_id || null,
        starts_at: form.starts_at,
        ends_at: form.ends_at || null,
        all_day: allDay,
        status: form.status,
      };
      if (editingId) {
        const { error } = await (supabase as any).from("elo_events").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("elo_events").insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
      if (form.responsible_id && form.responsible_id !== user?.id) {
        await notifyUsers([form.responsible_id], {
          kind: "meeting", title: "Você é responsável por um evento", body: form.title, link: "/social", excludeUserId: user?.id,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["elo-events"] });
      setOpen(false); setEditingId(null); setForm(emptyEventForm);
      toast.success(editingId ? "Evento atualizado!" : "Evento criado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("elo_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["elo-events"] }); setDeleteTarget(null); toast.success("Evento excluído!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg font-semibold">Eventos da Elo</h2>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(emptyEventForm); } }}>
          <DialogTrigger asChild><Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Novo evento</Button></DialogTrigger>
          <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? "Editar evento" : "Novo evento"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome do evento *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Feira do Empreendedor 2026" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Tipo</Label>
                  <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{EVENT_KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{EVENT_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Início *</Label><Input type={allDay ? "date" : "datetime-local"} value={allDay ? form.starts_at.slice(0, 10) : form.starts_at} onChange={(e) => setForm({ ...form, starts_at: allDay ? `${e.target.value}T00:00` : e.target.value })} /></div>
                <div><Label>Fim</Label><Input type={allDay ? "date" : "datetime-local"} value={allDay ? form.ends_at.slice(0, 10) : form.ends_at} onChange={(e) => setForm({ ...form, ends_at: allDay ? `${e.target.value}T23:59` : e.target.value })} /></div>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="h-4 w-4" />
                Dia inteiro (sem horário)
              </label>
              <div><Label>Local</Label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Centro de Eventos, online, endereço…" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Responsável</Label>
                  <Select value={form.responsible_id || "none"} onValueChange={(v) => setForm({ ...form, responsible_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Ninguém" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ninguém</SelectItem>
                      {(profiles ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Cliente</Label>
                  <Select value={form.client_id || "none"} onValueChange={(v) => setForm({ ...form, client_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {(clients ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.company || c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Link (inscrição, mapa, briefing…)</Label>
                <div className="relative">
                  <Link2 className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://…" />
                </div>
              </div>
              <div><Label>Descrição</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalhes, agenda, o que levar…" /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {missing && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Para usar Eventos, aplique a migração <strong>20260723120000_elo_events.sql</strong> no Supabase. A página abre normalmente enquanto isso.
        </div>
      )}

      {soonest && (() => {
        const cd = countdown(soonest.starts_at);
        const km = eventKindMeta(soonest.kind);
        const owner = profileById(soonest.responsible_id);
        return (
          <div className={"surface-card mb-5 overflow-hidden p-0"}>
            <div className={"flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-3 " + (cd.soon || cd.now ? "bg-amber-500/10" : "bg-primary/5")}>
              <div className="flex items-center gap-2 text-sm font-medium">
                {cd.now ? <Clock className="h-4 w-4 text-amber-400" /> : <CalendarClock className="h-4 w-4 text-primary" />}
                Próximo evento
              </div>
              <Badge variant="outline" className={"gap-1 " + (cd.soon || cd.now ? "border-amber-500/40 bg-amber-500/15 text-amber-300" : "")}>
                {cd.text}
              </Badge>
            </div>
            <button onClick={() => openEdit(soonest)} className="block w-full p-5 text-left transition hover:bg-accent/30">
              <div className="mb-1.5 flex items-center gap-2">
                <Badge variant="outline" className={km.color}>{km.label}</Badge>
                <span className="text-[11px] text-muted-foreground">{eventStatusLabel(soonest.status)}</span>
              </div>
              <div className="font-display text-xl font-semibold">{soonest.title}</div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{fmtDateTime(soonest.starts_at, soonest.all_day)}</span>
                {soonest.location && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{soonest.location}</span>}
                {clientById(soonest.client_id) && <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{clientById(soonest.client_id)?.company || clientById(soonest.client_id)?.name}</span>}
                {owner && (
                  <span className="flex items-center gap-1.5">
                    <Avatar className="h-5 w-5">
                      {owner.avatar_url && <AvatarImage src={owner.avatar_url} alt="" />}
                      <AvatarFallback className="bg-primary/15 text-[8px] text-primary">{initials(owner.full_name ?? owner.email)}</AvatarFallback>
                    </Avatar>
                    {owner.full_name ?? owner.email}
                  </span>
                )}
              </div>
            </button>
          </div>
        );
      })()}

      {events.length === 0 && !missing ? (
        <EmptyState icon={CalendarClock} title="Nenhum evento ainda" description="Crie o primeiro evento que a Elo vai participar — feira, gravação, palestra…" />
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <EventListSection title="Próximos" count={upcoming.length}>
              {upcoming.map((e: any) => (
                <EventCard key={e.id} event={e} owner={profileById(e.responsible_id)} client={clientById(e.client_id)} onEdit={openEdit} onDelete={setDeleteTarget} />
              ))}
            </EventListSection>
          )}
          {past.length > 0 && (
            <EventListSection title="Já aconteceram" count={past.length}>
              {past.map((e: any) => (
                <EventCard key={e.id} event={e} owner={profileById(e.responsible_id)} client={clientById(e.client_id)} onEdit={openEdit} onDelete={setDeleteTarget} dim />
              ))}
            </EventListSection>
          )}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir evento?</AlertDialogTitle>
            <AlertDialogDescription>Isso vai excluir "{deleteTarget?.title}" permanentemente. Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate(deleteTarget.id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EventListSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{count}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </div>
  );
}

function EventCard({ event, owner, client, onEdit, onDelete, dim }: {
  event: any; owner: any; client: any; onEdit: (e: any) => void; onDelete: (e: any) => void; dim?: boolean;
}) {
  const cd = countdown(event.starts_at);
  const km = eventKindMeta(event.kind);
  return (
    <div className={"surface-card group relative p-4 transition hover:-translate-y-0.5 hover:shadow-elegant " + (dim ? "opacity-70" : "")}>
      <div className="absolute right-2.5 top-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded p-1 text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground group-hover:opacity-100"><MoreVertical className="h-4 w-4" /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(event)}><Pencil className="mr-2 h-3.5 w-3.5" />Editar</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(event)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-3.5 w-3.5" />Excluir</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <button onClick={() => onEdit(event)} className="block w-full pr-5 text-left">
        <div className="mb-1.5 flex items-center gap-1.5">
          <Badge variant="outline" className={"text-[10px] " + km.color}>{km.label}</Badge>
          {event.status === "done" ? (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400"><CheckCircle2 className="h-3 w-3" />Concluído</span>
          ) : (
            <Badge variant="outline" className={"gap-1 text-[10px] " + (cd.soon || cd.now ? "border-amber-500/40 bg-amber-500/15 text-amber-300" : "")}>
              {cd.text}
            </Badge>
          )}
        </div>
        <div className="font-display text-base font-semibold leading-tight">{event.title}</div>
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5"><CalendarDays className="h-3 w-3 shrink-0" />{fmtDateTime(event.starts_at, event.all_day)}</div>
          {event.location && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{event.location}</span></div>}
          {client && <div className="flex items-center gap-1.5"><Building2 className="h-3 w-3 shrink-0" /><span className="truncate">{client.company || client.name}</span></div>}
        </div>
      </button>

      <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5">
        {owner ? (
          <div className="flex items-center gap-1.5" title={owner.full_name ?? owner.email}>
            <Avatar className="h-5 w-5">
              {owner.avatar_url && <AvatarImage src={owner.avatar_url} alt="" />}
              <AvatarFallback className="bg-primary/15 text-[8px] text-primary">{initials(owner.full_name ?? owner.email)}</AvatarFallback>
            </Avatar>
            <span className="max-w-[110px] truncate text-[10px] text-muted-foreground">{owner.full_name ?? owner.email}</span>
          </div>
        ) : <span className="text-[10px] text-muted-foreground">Sem responsável</span>}
        {event.link && (
          <a href={event.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-[10px] text-primary hover:underline">
            Abrir link <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}
