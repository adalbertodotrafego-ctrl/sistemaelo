import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LifeBuoy, Send, Loader2, X } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-auth";
import {
  useMyConversation, useConversationReplies, useStartConversation, useSendReply, useSupportRealtime,
} from "@/lib/support";

export function SupportWidget() {
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed bottom-24 right-6 z-50 flex max-h-[70vh] w-[22rem] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl shadow-black/20 sm:w-96"
          >
            <SupportChat userId={user.id} onClose={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setOpen((v) => !v)}
              aria-label="Falar com suporte"
              className="fixed bottom-6 right-6 z-50 flex h-13 w-13 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition hover:scale-105 hover:bg-primary/90"
              style={{ height: "3.25rem", width: "3.25rem" }}
            >
              {open ? <X className="h-6 w-6" /> : <LifeBuoy className="h-6 w-6" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">Falar com suporte</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </>
  );
}

function SupportChat({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { data, isLoading } = useMyConversation();
  useSupportRealtime("mine", userId);

  if (isLoading) {
    return (
      <>
        <ChatHeader title="Falar com suporte" onClose={onClose} />
        <div className="flex flex-1 items-center justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      </>
    );
  }
  if (data?.missing) {
    return (
      <>
        <ChatHeader title="Falar com suporte" onClose={onClose} />
        <div className="p-6 text-sm text-amber-500">
          Suporte ainda não está configurado neste ambiente — aplique as migrações de suporte no Supabase.
        </div>
      </>
    );
  }
  return data?.row ? <ChatThread conversation={data.row} onClose={onClose} /> : <StartChat onClose={onClose} />;
}

function ChatHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <LifeBuoy className="h-4 w-4 text-primary" />{title}
      </div>
      <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Fechar">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function StartChat({ onClose }: { onClose: () => void }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const start = useStartConversation();

  return (
    <>
      <ChatHeader title="Falar com suporte" onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-4">
        <p className="mb-4 text-sm text-muted-foreground">
          Conte o que está acontecendo — um admin da Elo entra na conversa com você.
        </p>
        <div className="space-y-3">
          <div><Label>Assunto</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex: Erro ao salvar cliente" /></div>
          <div><Label>Mensagem</Label><Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Descreva o problema ou dúvida…" /></div>
        </div>
        <Button
          className="mt-4 w-full"
          disabled={!subject.trim() || !message.trim() || start.isPending}
          onClick={() => start.mutate({ subject, message })}
        >
          {start.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Iniciar conversa
        </Button>
      </div>
    </>
  );
}

function ChatThread({ conversation, onClose }: { conversation: any; onClose: () => void }) {
  const { user } = useCurrentUser();
  const { data: replies } = useConversationReplies(conversation.id);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const send = useSendReply(conversation.id, { notifyAdmins: true, notifyTitle: "Nova mensagem de suporte" });

  const sendMessage = async () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    send.mutate(body);
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [replies?.length]);

  const timeline = [
    { id: conversation.id, sender_id: conversation.user_id, body: conversation.message, created_at: conversation.created_at },
    ...(replies ?? []),
  ];

  return (
    <>
      <ChatHeader title={conversation.subject} onClose={onClose} />

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-surface-2/40 p-4">
        {timeline.map((m: any) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={"flex items-end gap-2 " + (mine ? "flex-row-reverse" : "")}>
              {!mine && (
                <Avatar className="h-6 w-6 shrink-0"><AvatarFallback className="bg-primary/15 text-[10px] text-primary"><LifeBuoy className="h-3 w-3" /></AvatarFallback></Avatar>
              )}
              <div className={"max-w-[78%] rounded-2xl px-3.5 py-2 text-sm " + (mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border border-border/50 bg-surface")}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <div className={"mt-0.5 text-[10px] " + (mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
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
          placeholder="Escreva uma mensagem…"
          className="min-h-9 flex-1 resize-none"
        />
        <Button size="icon" className="shrink-0" onClick={sendMessage} disabled={!text.trim() || send.isPending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
}
