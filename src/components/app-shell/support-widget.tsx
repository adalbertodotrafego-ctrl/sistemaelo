import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-auth";

export function SupportWidget() {
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const send = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Faça login para falar com o suporte");
      const { error } = await (supabase as any).from("support_messages").insert({
        user_id: user.id, subject: subject.trim(), message: message.trim(),
      });
      if (error) {
        if (/does not exist|schema cache/i.test(error.message)) {
          throw new Error("Suporte ainda não está configurado neste ambiente — aplique a migração 20260817130000_support.sql.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Mensagem enviada! Um admin vai te responder em breve.");
      setOpen(false); setSubject(""); setMessage("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) return null;

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setOpen(true)}
              aria-label="Falar com suporte"
              className="fixed bottom-6 right-6 z-50 flex h-13 w-13 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition hover:scale-105 hover:bg-primary/90"
              style={{ height: "3.25rem", width: "3.25rem" }}
            >
              <LifeBuoy className="h-6 w-6" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">Falar com suporte</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Falar com suporte</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Assunto *</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex: Erro ao salvar cliente" /></div>
            <div><Label>Mensagem *</Label><Textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Descreva o problema ou dúvida com o máximo de detalhes…" /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => send.mutate()} disabled={!subject.trim() || !message.trim() || send.isPending}>Enviar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
