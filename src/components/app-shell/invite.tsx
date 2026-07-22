// =====================================================================
// Convite para o Elo Marketing OS — gera um link compartilhável
// =====================================================================
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Copy, Loader2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-auth";

function newToken() {
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "").slice(0, 32);
}

const linkFor = (token: string) => `${window.location.origin}/auth?convite=${token}`;

export function InviteButton() {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const { user } = useCurrentUser();
  const qc = useQueryClient();

  const { data: invites } = useQuery({
    queryKey: ["invites"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("invites").select("*").is("used_at", null).order("created_at", { ascending: false });
      if (error) {
        if (/does not exist|schema cache/i.test(error.message)) return { rows: [] as any[], missing: true };
        throw error;
      }
      return { rows: (data ?? []) as any[], missing: false };
    },
  });
  const rows = invites?.rows ?? [];
  const missing = invites?.missing ?? false;

  const create = useMutation({
    mutationFn: async () => {
      const token = newToken();
      const { error } = await (supabase as any).from("invites").insert({
        token, note: note.trim() || null, created_by: user?.id,
      });
      if (error) throw error;
      return token;
    },
    onSuccess: async (token) => {
      setNote("");
      qc.invalidateQueries({ queryKey: ["invites"] });
      await copy(token);
      toast.success("Convite criado e link copiado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("invites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invites"] }); toast.success("Convite cancelado."); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(linkFor(token));
      setCopied(token);
      setTimeout(() => setCopied((c) => (c === token ? null : c)), 2000);
    } catch {
      toast.error("Não foi possível copiar — selecione o link e copie manualmente.");
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
        title="Convidar alguém para o Elo OS"
        aria-label="Convidar"
      >
        <UserPlus className="h-5 w-5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>Convidar para o Elo Marketing OS</DialogTitle></DialogHeader>

          {missing ? (
            <p className="text-sm text-muted-foreground">
              Para usar convites, aplique a migração <strong>20260722140000_invites.sql</strong> no Supabase.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Para quem é? (opcional)</Label>
                <div className="flex gap-2">
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ex: Novo social media"
                    onKeyDown={(e) => { if (e.key === "Enter") create.mutate(); }}
                  />
                  <Button onClick={() => create.mutate()} disabled={create.isPending}>
                    {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                    Gerar link
                  </Button>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  O link vale 14 dias. Mande por WhatsApp, e-mail… quem abrir cria a conta já com as boas-vindas.
                </p>
              </div>

              {rows.length > 0 && (
                <div>
                  <Label>Convites em aberto</Label>
                  <div className="mt-1 space-y-1.5">
                    {rows.map((i: any) => {
                      const expired = new Date(i.expires_at) < new Date();
                      return (
                        <div key={i.id} className="flex items-center gap-2 rounded-lg border border-border/60 p-2">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm">{i.note || "Convite"}</div>
                            <div className="truncate text-[10px] text-muted-foreground">
                              {expired
                                ? "Expirado"
                                : `Válido até ${new Date(i.expires_at).toLocaleDateString("pt-BR")}`}
                            </div>
                          </div>
                          {!expired && (
                            <Button size="sm" variant="outline" className="h-8" onClick={() => copy(i.token)}>
                              {copied === i.token ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                          <Button
                            size="sm" variant="ghost" className="h-8 text-muted-foreground hover:text-destructive"
                            onClick={() => remove.mutate(i.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
