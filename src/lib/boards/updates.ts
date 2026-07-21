// =====================================================================
// Updates (comentários) por item
// =====================================================================
// Nota: updates.author_id referencia auth.users (não profiles), então não dá
// pra usar embed do PostgREST — o autor é resolvido client-side cruzando com
// useProfiles().
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { sb } from "./client";
import type { BoardUpdate } from "./types";

export function useItemUpdates(itemId: string) {
  return useQuery({
    queryKey: ["updates", itemId],
    queryFn: async () => {
      const { data, error } = await sb.from("updates").select("*")
        .eq("item_id", itemId).order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as BoardUpdate[];
    },
    enabled: Boolean(itemId),
  });
}

export function useAddUpdate(itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { body: string }) => {
      const { data: auth } = await sb.auth.getUser();
      const { error } = await sb.from("updates").insert({
        item_id: itemId,
        author_id: auth.user?.id ?? null,
        body: args.body,
      });
      if (error) throw new Error(error.message);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Não foi possível salvar: ${msg}`);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["updates", itemId] }),
  });
}
