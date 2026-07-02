import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { initials, brl, shortDate } from "@/lib/format";
import { ArrowLeft, Mail, Phone, MapPin, Globe, MessageCircle, Instagram, Send } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/clients/$id")({
  component: ClientDetail,
});

function ClientDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const [note, setNote] = useState("");

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
    },
    onSuccess: () => { setNote(""); qc.invalidateQueries({ queryKey: ["client-notes", id] }); toast.success("Anotação salva"); },
  });

  if (!client) return <div className="surface-card p-10 text-center text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div>
      <Link to="/clients" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar para clientes
      </Link>

      <div className="surface-card mb-6 overflow-hidden p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar className="h-20 w-20">
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
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="projects">Projetos ({projects?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="campaigns">Campanhas ({campaigns?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="notes">Anotações ({notes?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5">
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

        <TabsContent value="notes" className="mt-5">
          <div className="surface-card p-5">
            <Textarea
              placeholder="Adicione uma anotação sobre este cliente…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
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
