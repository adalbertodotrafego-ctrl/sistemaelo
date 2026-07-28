import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-auth";
import { toast } from "sonner";

export type Pin = { id: string; path: string; label: string; icon: string | null; created_at: string };

/** Páginas fixadas do usuário — cada um tem os seus atalhos na Home. */
export function usePins() {
  const qc = useQueryClient();
  const { user } = useCurrentUser();

  const { data } = useQuery({
    queryKey: ["user-pins", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("user_pins").select("*").order("created_at");
      if (error) {
        if (/does not exist|schema cache/i.test(error.message)) return [] as Pin[];
        throw error;
      }
      return (data ?? []) as Pin[];
    },
  });
  const pins = data ?? [];
  const isPinned = (path: string) => pins.some((p) => p.path === path);

  const toggle = useMutation({
    mutationFn: async (args: { path: string; label: string; icon?: string }) => {
      if (!user?.id) return;
      if (isPinned(args.path)) {
        const { error } = await (supabase as any).from("user_pins").delete().eq("user_id", user.id).eq("path", args.path);
        if (error) throw error;
        return "removed" as const;
      }
      const { error } = await (supabase as any).from("user_pins")
        .insert({ user_id: user.id, path: args.path, label: args.label, icon: args.icon ?? null });
      if (error) throw error;
      return "added" as const;
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["user-pins"] });
      if (result === "added") toast.success("Página fixada na Home!");
      else if (result === "removed") toast.success("Fixação removida.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { pins, isPinned, toggle };
}
