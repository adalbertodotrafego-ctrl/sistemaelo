import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MentionTextarea } from "@/components/ui-extras/mention-textarea";
import { StatCard } from "@/components/ui-extras/page";
import { initials, brl, shortDate } from "@/lib/format";
import {
  ArrowLeft, Mail, Phone, MapPin, Globe, MessageCircle, Instagram, Send,
  AlertTriangle, CheckCircle2, DollarSign, Megaphone, FileSignature, FileBarChart,
  Wallet, ArrowUpRight, ArrowDownRight, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-auth";
import { notifyUsers } from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated/clients/$id")({
  component: ClientDetail,
});

const reportStatusLabels: Record<string, string> = { draft: "Rascunho", final: "Finalizado" };

function ClientDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const [note, setNote] = useState("");
  const [noteMentions, setNoteMentions] = useState<string[]>([]);

  const { data: profiles } = useQuery({
    queryKey: ["team-min"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email, avatar_url").order("full_name")).data ?? [],
  });

  const { data: client } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: projects } = useQuery({
    queryKey: ["client-projects", id],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("*").eq("client_id", id).order("created_at",{ascending:false});
      return data ?? [];
    },
  });

  const { data: campaigns } = useQuery({
    queryKey: ["client-campaigns", id],
    queryFn: async () => {
      const { data } = await supabase.from("campaigns").select("*").eq("client_id", id);
      return data ?? [];
    },
  });

  const { data: contracts } = useQuery({
    queryKey: ["client-contracts", id],
    queryFn: async () => (await supabase.from("contracts").select("*").eq("client_id", id).order("created_at", { ascending: false })).data ?? [],
  });

  const { data: financeEntries } = useQuery({
    queryKey: ["client-finance", id],
    queryFn: async () => (await supabase.from("finance_entries").select("*").eq("client_id", id).order("due_date", { ascending: false })).data ?? [],
  });

  const { data: clientReports } = useQuery({
    queryKey: ["client-reports-tab", id],
    queryFn: async () => (await (supabase as any).from("client_reports").select("*").eq("client_id", id).order("created_at", { ascending: false })).data ?? [],
  });

  const { data: notes } = useQuery({
    queryKey: ["client-notes", id],
    queryFn: async () => {
      const { data } = await supabase.from("client_notes").select("*").eq("client_id", id).order("created_at",{ascending:false});
      return data ?? [];
    },
  });

  const addNote = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("client_notes").insert({ client_id: id, body: note, author_id: user?.id });
      if (error) throw error;
      if (noteMentions.length > 0) {
        await notifyUsers(noteMentions, {
          kind: "mention", title: "Você foi mencionado numa anotação de cliente",
          body: `${client?.company ?? client?.name ?? "Cliente"}: ${note}`, link: `/clients/${id}`, excludeUserId: user?.id,
        });
      }
    },
    onSuccess: () => { setNote(""); setNoteMentions([]); qc.invalidateQueries({ queryKey: ["client-notes", id] }); toast.success("Anotação salva"); },
  });

  if (!client) return <div className="surface-card p-10 text-center text-sm text-muted-foreground">Carregando…</div>;

  // ---- Visão 360: junta campanhas, contratos, financeiro e relatórios num só lugar ----
  const totalInvested = (campaigns ?? []).reduce((s: number, c: any) => s + Number(c.invested ?? 0), 0);
  const activeCampaigns = (campaigns ?? []).filter((c: any) => c.status === "active").length;

  const income = (financeEntries ?? []).filter((f: any) => f.kind === "income").reduce((s: number, f: any) => s + Number(f.amount ?? 0), 0);
  const pendingIncome = (financeEntries ?? []).filter((f: any) => f.kind === "income" && !f.paid_at).reduce((s: number, f: any) => s + Number(f.amount ?? 0), 0);

  const activeContract = (contracts ?? []).find((c: any) => c.status === "active");
  const daysToRenewal = activeContract?.renewal_at
    ? Math.ceil((new Date(activeContract.renewal_at).getTime() - Date.now()) / 86400000)
    : null;

  const lastReport = (clientReports ?? [])[0];

  const alerts: { label: string; tone: "warning" | "destructive" | "success" }[] = [];
  if (daysToRenewal !== null && daysToRenewal < 0) alerts.push({ label: "Contrato vencido — renovar assim que possível", tone: "destructive" });
  else if (daysToRenewal !== null && daysToRenewal <= 30) alerts.push({ label: `Contrato vence em ${daysToRenewal} dia(s)`, tone: "warning" });
  if (pendingIncome > 0) alerts.push({ label: `${brl(pendingIncome)} pendente(s) de pagamento`, tone: "warning" });
  if ((campaigns?.length ?? 0) > 0 && activeCampaigns === 0) alerts.push({ label: "Nenhuma campanha ativa no momento", tone: "warning" });
  if ((clientReports?.length ?? 0) === 0) alerts.push({ label: "Nenhum relatório criado ainda para este cliente", tone: "warning" });
  if (alerts.length === 0) alerts.push({ label: "Tudo em dia com este cliente", tone: "success" });

  const alertStyles = {
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    destructive: "border-red-500/30 bg-red-500/10 text-red-400",
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  };

  return (
    <div>
      <Link to="/clients" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar para clientes
      </Link>

      <div className="surface-card mb-6 overflow-hidden p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar className="h-20 w-20">
            {client.logo_url && <AvatarImage src={client.logo_url} alt={client.company ?? client.name} className="object-cover" />}
            <AvatarFallback className="bg-primary/15 text-2xl text-primary">{initials(client.company ?? client.name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl font-semibold">{client.company ?? client.name}</h1>
              <Badge>{client.status}</Badge>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">{client.name} · {client.segment ?? "—"}</div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {client.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{client.email}</span>}
              {client.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{client.phone}</span>}
              {client.whatsapp && <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />{client.whatsapp}</span>}
              {client.instagram && <span className="inline-flex items-center gap-1"><Instagram className="h-3 w-3" />{client.instagram}</span>}
              {client.website && <span className="inline-flex items-center gap-1"><Globe className="h-3 w-3" />{client.website}</span>}
              {(client.city || client.state) && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{[client.city,client.state].filter(Boolean).join(", ")}</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Mensalidade</div>
            <div className="font-display text-2xl font-semibold">{brl(client.monthly_value)}</div>
            <div className="text-xs text-muted-foreground">Cliente desde {shortDate(client.entry_date)}</div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="projects">Projetos ({projects?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="campaigns">Campanhas ({campaigns?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="contracts">Contratos ({contracts?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="finance">Financeiro ({financeEntries?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="reports">Relatórios ({clientReports?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="notes">Anotações ({notes?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5 space-y-5">
          <div className="flex flex-wrap gap-2">
            {alerts.map((a, i) => (
              <div key={i} className={"inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium " + alertStyles[a.tone]}>
                {a.tone === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                {a.label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Investido em anúncios" value={brl(totalInvested)} icon={Megaphone} accent="primary" />
            <StatCard label="Receita recebida" value={brl(income)} icon={DollarSign} accent="success" />
            <StatCard
              label="Contrato"
              value={activeContract ? "Ativo" : "Sem contrato ativo"}
              icon={FileSignature}
              accent={activeContract ? "success" : "warning"}
              hint={activeContract?.renewal_at ? `Renova em ${shortDate(activeContract.renewal_at)}` : undefined}
            />
            <StatCard
              label="Último relatório"
              value={lastReport ? shortDate(lastReport.created_at) : "Nenhum"}
              icon={FileBarChart}
              accent={lastReport ? "primary" : "warning"}
            />
          </div>

          <div className="surface-card p-6">
            <h3 className="mb-2 font-display text-lg font-semibold">Observações</h3>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{client.notes || "Sem observações registradas."}</p>
          </div>
        </TabsContent>

        <TabsContent value="projects" className="mt-5 space-y-3">
          {(projects ?? []).length === 0 && <div className="surface-card p-8 text-center text-sm text-muted-foreground">Nenhum projeto ainda.</div>}
          {(projects ?? []).map((p: any) => (
            <div key={p.id} className="surface-card flex items-center justify-between p-4">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.category ?? "Sem categoria"}</div>
              </div>
              <Badge variant="outline">{p.status}</Badge>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="campaigns" className="mt-5 space-y-3">
          {(campaigns ?? []).length === 0 && <div className="surface-card p-8 text-center text-sm text-muted-foreground">Nenhuma campanha cadastrada.</div>}
          {(campaigns ?? []).map((c: any) => (
            <div key={c.id} className="surface-card p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">{c.name}</div>
                <Badge variant="outline">{c.channel}</Badge>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-3 text-xs">
                <div><div className="text-muted-foreground">Investido</div><div className="font-semibold">{brl(c.invested)}</div></div>
                <div><div className="text-muted-foreground">Leads</div><div className="font-semibold">{c.leads}</div></div>
                <div><div className="text-muted-foreground">ROAS</div><div className="font-semibold">{c.roas}x</div></div>
                <div><div className="text-muted-foreground">CPA</div><div className="font-semibold">{brl(c.cpa)}</div></div>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="contracts" className="mt-5 space-y-3">
          {(contracts ?? []).length === 0 ? (
            <div className="surface-card p-8 text-center text-sm text-muted-foreground">
              Nenhum contrato cadastrado.
              <div className="mt-3"><Link to="/contracts" className="inline-flex items-center gap-1 text-primary hover:underline">Cadastrar em Contratos <ExternalLink className="h-3 w-3" /></Link></div>
            </div>
          ) : (
            <>
              {(contracts ?? []).map((c: any) => (
                <div key={c.id} className="surface-card flex items-center justify-between p-4">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{c.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {brl(c.value ?? 0)} · Renova {shortDate(c.renewal_at)}
                    </div>
                  </div>
                  <Badge variant={c.status === "active" ? "default" : "secondary"} className="capitalize">{c.status}</Badge>
                </div>
              ))}
              <Link to="/contracts" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">Ver e editar em Contratos <ExternalLink className="h-3 w-3" /></Link>
            </>
          )}
        </TabsContent>

        <TabsContent value="finance" className="mt-5 space-y-3">
          {(financeEntries ?? []).length === 0 ? (
            <div className="surface-card p-8 text-center text-sm text-muted-foreground">
              Nenhum lançamento financeiro para este cliente.
              <div className="mt-3"><Link to="/finance" className="inline-flex items-center gap-1 text-primary hover:underline">Lançar em Financeiro <ExternalLink className="h-3 w-3" /></Link></div>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <StatCard label="Recebido" value={brl(income)} icon={ArrowUpRight} accent="success" />
                <StatCard label="Pendente" value={brl(pendingIncome)} icon={ArrowDownRight} accent={pendingIncome > 0 ? "warning" : "success"} />
              </div>
              <div className="surface-card divide-y divide-border/50 overflow-hidden">
                {(financeEntries ?? []).map((f: any) => (
                  <div key={f.id} className="flex items-center justify-between p-4">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{f.description ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">Vencimento {shortDate(f.due_date)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={f.paid_at ? "default" : "outline"}>{f.paid_at ? "Pago" : "Pendente"}</Badge>
                      <span className={"font-semibold " + (f.kind === "income" ? "text-emerald-400" : "text-red-400")}>
                        {f.kind === "income" ? "+" : "−"} {brl(f.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <Link to="/finance" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">Ver e editar em Financeiro <ExternalLink className="h-3 w-3" /></Link>
            </>
          )}
        </TabsContent>

        <TabsContent value="reports" className="mt-5 space-y-3">
          {(clientReports ?? []).length === 0 ? (
            <div className="surface-card p-8 text-center text-sm text-muted-foreground">
              Nenhum relatório criado para este cliente ainda.
              <div className="mt-3"><Link to="/reports" className="inline-flex items-center gap-1 text-primary hover:underline">Criar relatório <ExternalLink className="h-3 w-3" /></Link></div>
            </div>
          ) : (
            <>
              {(clientReports ?? []).map((r: any) => (
                <div key={r.id} className="surface-card flex items-center justify-between p-4">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{r.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {(r.period_start || r.period_end) ? `${shortDate(r.period_start)} → ${shortDate(r.period_end)}` : shortDate(r.created_at)}
                    </div>
                  </div>
                  <Badge variant={r.status === "final" ? "default" : "outline"}>{reportStatusLabels[r.status] ?? r.status}</Badge>
                </div>
              ))}
              <Link to="/reports" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">Ver todos em Relatórios <ExternalLink className="h-3 w-3" /></Link>
            </>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-5">
          <div className="surface-card p-5">
            <MentionTextarea
              placeholder="Adicione uma anotação sobre este cliente… use @ para mencionar alguém"
              value={note}
              onChange={setNote}
              mentionedIds={noteMentions}
              onMentionedIdsChange={setNoteMentions}
              profiles={profiles ?? []}
              rows={3}
            />
            <div className="mt-2 flex justify-end">
              <Button onClick={() => addNote.mutate()} disabled={!note.trim() || addNote.isPending}>
                <Send className="mr-2 h-4 w-4" /> Adicionar
              </Button>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {(notes ?? []).map((n: any) => (
              <div key={n.id} className="surface-card p-4">
                <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                <div className="mt-2 text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString("pt-BR")}</div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
