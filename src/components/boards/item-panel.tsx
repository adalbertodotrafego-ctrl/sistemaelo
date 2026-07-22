// =====================================================================
// Painel lateral do item — aba "Atualizações" (comentários)
// =====================================================================
import { useEffect, useState } from "react";
import { BoardAvatar } from "@/components/boards/avatar";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { MentionTextarea } from "@/components/ui-extras/mention-textarea";
import { notifyUsers } from "@/lib/notifications";
import { useCurrentUser } from "@/hooks/use-auth";
import { Repeat, MoveRight } from "lucide-react";
import { useBoardOptions, useMoveItemToBoard, useProfiles, useUpdateItem } from "@/lib/boards/queries";
import { RECURRENCE_LABELS, type Item, type Recurrence } from "@/lib/boards/types";
import { useAddUpdate, useItemUpdates } from "@/lib/boards/updates";

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.floor((Date.now() - then) / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function ItemPanel({ item, boardId, onClose }: { item: Item; boardId: string; onClose: () => void }) {
  const { data: updates, isLoading } = useItemUpdates(item.id);
  const { data: profiles } = useProfiles();
  const { user: currentUser } = useCurrentUser();
  const addUpdate = useAddUpdate(item.id);
  const updateItem = useUpdateItem(boardId);
  const moveToBoard = useMoveItemToBoard(boardId);
  const { data: boards } = useBoardOptions();
  const [body, setBody] = useState("");
  const [bodyMentions, setBodyMentions] = useState<string[]>([]);
  const [desc, setDesc] = useState(item.description ?? "");
  const [descMentions, setDescMentions] = useState<string[]>([]);
  const [descLoadedFor, setDescLoadedFor] = useState(item.id);

  // Trocou de demanda no painel → recarrega a descrição daquela demanda.
  if (descLoadedFor !== item.id) {
    setDescLoadedFor(item.id);
    setDesc(item.description ?? "");
    setDescMentions([]);
  }
  const descDirty = desc !== (item.description ?? "");

  const saveDescription = () => {
    updateItem.mutate(
      { itemId: item.id, patch: { description: desc.trim() || null } },
      {
        onSuccess: () => {
          if (descMentions.length > 0) {
            notifyUsers(descMentions, {
              kind: "mention",
              title: "Você foi mencionado numa demanda",
              body: item.name || "Abra o quadro para ver os detalhes.",
              link: `/tasks/${boardId}`,
              excludeUserId: currentUser?.id,
            });
            setDescMentions([]);
          }
        },
      },
    );
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submit() {
    const text = body.trim();
    if (!text) return;
    addUpdate.mutate({ body: text }, {
      onSuccess: () => {
        if (bodyMentions.length > 0) {
          notifyUsers(bodyMentions, {
            kind: "mention",
            title: "Você foi mencionado numa atualização",
            body: item.name || text.slice(0, 80),
            link: `/tasks/${boardId}`,
            excludeUserId: currentUser?.id,
          });
        }
        setBodyMentions([]);
      },
    });
    setBody("");
  }

  return (
    <aside className="flex h-full w-[380px] shrink-0 flex-col border-l border-border bg-card shadow-xl">
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <h2 className="min-w-0 truncate font-display text-lg font-semibold text-foreground" title={item.name}>
          {item.name || "Sem nome"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Fechar (Esc)"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* Recorrência e envio para outro quadro */}
      <div className="grid grid-cols-2 gap-3 border-b border-border px-5 py-3">
        <div>
          <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Repeat className="h-3 w-3" />Recorrência
          </Label>
          <select
            value={item.recurrence ?? ""}
            onChange={(e) =>
              updateItem.mutate({
                itemId: item.id,
                patch: { recurrence: (e.target.value || null) as Recurrence | null },
              })
            }
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="">Não se repete</option>
            {(Object.keys(RECURRENCE_LABELS) as Recurrence[]).map((r) => (
              <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MoveRight className="h-3 w-3" />Enviar para o quadro
          </Label>
          <select
            value=""
            onChange={(e) => {
              const target = e.target.value;
              if (!target) return;
              moveToBoard.mutate({ itemId: item.id, targetBoardId: target }, { onSuccess: onClose });
            }}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="">Escolher quadro…</option>
            {(boards ?? []).filter((b) => b.id !== boardId).map((b) => (
              <option key={b.id} value={b.id}>{b.icon ? `${b.icon} ` : ""}{b.name}</option>
            ))}
          </select>
        </div>
        {item.recurrence && (
          <p className="col-span-2 -mt-1 text-[10px] text-muted-foreground">
            Ao marcar um status de conclusão, a demanda volta a ficar pendente sozinha no próximo período.
          </p>
        )}
      </div>

      {/* Descrição da demanda */}
      <div className="border-b border-border px-5 py-3">
        <Label className="text-xs text-muted-foreground">Descrição</Label>
        <div className="mt-1">
          <MentionTextarea
            rows={4}
            value={desc}
            onChange={setDesc}
            mentionedIds={descMentions}
            onMentionedIdsChange={setDescMentions}
            profiles={profiles ?? []}
            placeholder="Detalhe a demanda: o que precisa ser feito, contexto, links… use @ para marcar alguém."
          />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            {descDirty ? "Alterações não salvas" : "Tudo salvo"}
          </p>
          <Button size="sm" variant={descDirty ? "default" : "ghost"} disabled={!descDirty} onClick={saveDescription}>
            Salvar descrição
          </Button>
        </div>
      </div>

      <div className="border-b border-border px-5 py-2">
        <span className="border-b-2 border-primary pb-2 text-sm font-medium text-foreground">Atualizações</span>
      </div>

      <div className="border-b border-border px-5 py-3">
        <MentionTextarea
          rows={3}
          value={body}
          onChange={setBody}
          mentionedIds={bodyMentions}
          onMentionedIdsChange={setBodyMentions}
          profiles={profiles ?? []}
          placeholder="Escreva uma atualização… use @ para marcar alguém."
        />
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={submit} disabled={!body.trim() || addUpdate.isPending}>Atualizar</Button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {updates?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma atualização ainda. Comece a conversa deste item aqui. 💬
          </p>
        )}
        {updates?.map((u) => {
          const author = profiles?.find((p) => p.id === u.author_id);
          const name = author?.full_name || author?.email || "Alguém";
          return (
            <article key={u.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <BoardAvatar name={name} id={u.author_id ?? u.id} size={26} />
                <span className="text-sm font-medium text-foreground">{name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{relativeTime(u.created_at)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-foreground/90">{u.body}</p>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
