// =====================================================================
// Tempo real — mudanças de outros usuários aparecem sem recarregar
// =====================================================================
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useBoardRealtime(boardId: string) {
  const qc = useQueryClient();
  const [live, setLive] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      // Debounce: uma rajada de mudanças vira um único refetch.
      clearTimeout(timer);
      timer = setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["board", boardId] });
        qc.invalidateQueries({ queryKey: ["updates"] });
      }, 300);
    };

    const filter = `board_id=eq.${boardId}`;
    const channel = supabase
      .channel(`board:${boardId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "items", filter }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "groups", filter }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "columns", filter }, refresh)
      // column_values/updates não têm board_id — assina tudo e deixa o
      // debounce + staleTime segurarem o custo (time pequeno).
      .on("postgres_changes", { event: "*", schema: "public", table: "column_values" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "updates" }, refresh)
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [boardId, qc]);

  return live;
}
