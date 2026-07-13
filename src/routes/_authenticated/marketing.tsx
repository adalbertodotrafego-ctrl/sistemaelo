import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader, StatCard, EmptyState } from "@/components/ui-extras/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Megaphone, DollarSign, Wallet, MousePointerClick, AlertTriangle, CheckCircle2,
  RefreshCw, ChevronRight, Loader2, Target,
} from "lucide-react";
import { getMetaOverview, getMetaAccountCampaigns } from "@/lib/meta.functions";
import { objectiveLabel } from "@/lib/meta-accounts";

export const Route = createFileRoute("/_authenticated/marketing")({
  head: () => ({ meta: [{ title: "Meta Ads — Elo Marketing OS" }] }),
  component: MetaPage,
});

const PERIODS = [
  { value: "today", label: "Hoje" },
  { value: "this_month", label: "Este mês" },
  { value: "last_7d", label: "Últimos 7 dias" },
  { value: "last_30d", label: "Últimos 30 dias" },
];

const money = (v: number, ccy = "BRL") =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: ccy }).format(Number(v || 0));

// Indicador simples de saúde da campanha (não é garantia de resultado):
// sem gasto = não está entregando; CTR alto = saudável; CTR baixo = atenção.
function health(spend: number, ctr: number) {
  if (spend <= 0) return { label: "Sem entrega", cls: "bg-red-500/15 text-red-400 border-red-500/30", dot: "bg-red-400" };
  if (ctr >= 1) return { label: "Saudável", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-400" };
  return { label: "Atenção", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30", dot: "bg-amber-400" };
}

type Acct = {
  client: string; accountName: string; accountId: string; currency: string;
  activeCampaigns: number; spendPeriod: number; spendToday: number; ctr: number;
  impressions: number; clicks: number; error: string | null;
};

function MetaPage() {
  const overviewFn = useServerFn(getMetaOverview);
  const [period, setPeriod] = useState("this_month");
  const [selected, setSelected] = useState<Acct | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["meta-overview", period],
    queryFn: () => overviewFn({ data: { datePreset: period } }),
    staleTime: 60_000,
  });

  const accounts = (data?.accounts ?? []) as Acct[];
  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? "";

  // Totais (moedas separadas — não somamos BRL com USD).
  const sum = (list: Acct[], key: keyof Acct) => list.reduce((s, a) => s + Number(a[key] || 0), 0);
  const brlAccts = accounts.filter((a) => a.currency === "BRL");
  const usdAccts = accounts.filter((a) => a.currency === "USD");
  const totalPeriodBRL = sum(brlAccts, "spendPeriod");
  const totalPeriodUSD = sum(usdAccts, "spendPeriod");
  const totalTodayBRL = sum(brlAccts, "spendToday");
  const totalTodayUSD = sum(usdAccts, "spendToday");
  const activeCampaigns = sum(accounts, "activeCampaigns");
  const withoutActive = accounts.filter((a) => a.activeCampaigns === 0 && !a.error).length;
  const withActive = accounts.filter((a) => a.activeCampaigns > 0).length;
  const totImpr = sum(accounts, "impressions");
  const totClk = sum(accounts, "clicks");
  const ctrMedio = totImpr > 0 ? (totClk / totImpr) * 100 : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Crescimento"
        title="Meta Ads"
        description="Campanhas ativas por cliente, investimento e desempenho — direto do Meta Ads, ao vivo."
        actions={
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={"mr-2 h-4 w-4" + (isFetching ? " animate-spin" : "")} />Atualizar
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />Carregando dados do Meta…
        </div>
      ) : data && data.connected === false ? (
        <NotConnected />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            <StatCard
              label={`Total investido · ${periodLabel}`}
              value={money(totalPeriodBRL)}
              hint={totalPeriodUSD > 0 ? `+ ${money(totalPeriodUSD, "USD")} (Peoria)` : undefined}
              icon={DollarSign}
            />
            <StatCard
              label="Gasto hoje"
              value={money(totalTodayBRL)}
              hint={totalTodayUSD > 0 ? `+ ${money(totalTodayUSD, "USD")}` : undefined}
              icon={Wallet}
              accent="success"
            />
            <StatCard label="Campanhas ativas" value={activeCampaigns} icon={Megaphone} accent="primary" />
            <StatCard label="Contas sem campanha ativa" value={withoutActive} icon={AlertTriangle} accent="warning" />
            <StatCard label="CTR médio" value={ctrMedio.toFixed(2) + "%"} icon={MousePointerClick} accent="primary" />
            <StatCard label="Contas com anúncio ativo" value={`${withActive}/${accounts.length}`} icon={CheckCircle2} accent="success" />
          </div>

          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Clientes ({accounts.length})
            </h2>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {accounts.map((a) => {
              const paused = a.activeCampaigns === 0 && !a.error;
              return (
                <button
                  key={a.accountId}
                  onClick={() => setSelected(a)}
                  className="surface-card group relative flex items-center gap-4 p-5 text-left transition hover:border-primary/40 hover:shadow-elegant"
                >
                  <div className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border " +
                    (a.error ? "border-red-500/30 bg-red-500/10 text-red-400"
                      : paused ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                      : "border-primary/30 bg-primary/10 text-primary")}>
                    <Megaphone className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-display text-base font-semibold">{a.client}</span>
                      {a.currency !== "BRL" && <Badge variant="outline" className="text-[10px]">{a.currency}</Badge>}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">{a.accountName}</div>
                    {a.error ? (
                      <div className="mt-1 truncate text-xs text-red-400">⚠ {a.error}</div>
                    ) : (
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                        <span className={paused ? "text-amber-400" : "text-foreground"}>
                          <strong>{a.activeCampaigns}</strong> {a.activeCampaigns === 1 ? "campanha ativa" : "campanhas ativas"}
                        </span>
                        <span className="text-muted-foreground">Hoje: <strong className="text-foreground">{money(a.spendToday, a.currency)}</strong></span>
                        <span className="text-muted-foreground">{periodLabel}: <strong className="text-foreground">{money(a.spendPeriod, a.currency)}</strong></span>
                        <span className="text-muted-foreground">CTR: <strong className="text-foreground">{a.ctr.toFixed(2)}%</strong></span>
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                </button>
              );
            })}
          </div>
        </>
      )}

      <AccountDetailDialog account={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function AccountDetailDialog({ account, onClose }: { account: Acct | null; onClose: () => void }) {
  const campaignsFn = useServerFn(getMetaAccountCampaigns);
  const [period, setPeriod] = useState("today");

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["meta-campaigns", account?.accountId, period],
    enabled: !!account,
    queryFn: () => campaignsFn({ data: { accountId: account!.accountId, datePreset: period } }),
    staleTime: 30_000,
  });

  const ccy = account?.currency ?? "BRL";
  const campaigns = data?.campaigns ?? [];

  return (
    <Dialog open={!!account} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" />
            {account?.client}
            <span className="text-xs font-normal text-muted-foreground">· {account?.accountName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {isFetching ? "Atualizando…" : `${campaigns.length} campanha(s) ativa(s)`}
          </p>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />Carregando campanhas…
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState icon={Megaphone} title="Nenhuma campanha ativa" description="Esta conta não tem campanhas ativas no momento." />
        ) : (
          <div className="space-y-2">
            {campaigns.map((c: any) => {
              const h = health(c.spend, c.ctr);
              return (
                <div key={c.id} className="rounded-lg border border-border/60 bg-surface-2/40 p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{c.name}</div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]"><Target className="mr-1 h-3 w-3" />{objectiveLabel(c.objective)}</Badge>
                        <Badge variant="outline" className={"text-[10px] " + h.cls}>
                          <span className={"mr-1 inline-block h-1.5 w-1.5 rounded-full " + h.dot} />{h.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-border/40 pt-2 sm:grid-cols-5">
                    <Metric label="Gasto" value={money(c.spend, ccy)} strong />
                    <Metric label="CTR" value={c.ctr.toFixed(2) + "%"} />
                    <Metric label="Cliques" value={c.clicks.toLocaleString("pt-BR")} />
                    <Metric label="CPC" value={money(c.cpc, ccy)} />
                    <Metric label="Impressões" value={c.impressions.toLocaleString("pt-BR")} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={"font-display text-sm " + (strong ? "font-semibold text-primary" : "font-medium")}>{value}</div>
    </div>
  );
}

function NotConnected() {
  return (
    <EmptyState
      icon={AlertTriangle}
      title="Meta ainda não conectado"
      description="O sistema precisa de um token de acesso do seu Meta Business (variável META_ACCESS_TOKEN no servidor) para mostrar as campanhas ao vivo. Siga o passo a passo que a equipe recebeu para conectar. Assim que o token for salvo, os dados aparecem aqui automaticamente."
    />
  );
}
