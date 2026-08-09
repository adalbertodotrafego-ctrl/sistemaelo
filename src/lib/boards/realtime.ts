// =====================================================================
// Tempo real — mudanças de outros usuários aparecem sem recarregar
// =====================================================================
// Antes, `column_values` e `updates` eram assinadas SEM filtro (não tinham
// board_id). Resultado: qualquer célula editada em qualquer quadro acordava
// todo mundo, e cada cliente recarregava o quadro inteiro. Com dez pessoas
// ninguém percebia; com mil, uma digitação viraria mil recargas de vários MB.
//
// Agora as duas tabelas têm board_id (preenchido por gatilho no banco), então
// o filtro roda no servidor: o navegador só recebe o que é do quadro aberto.
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useBoardRealtime(boardId: string) {
  const qc = useQueryClient();
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!boardId) return;
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
      .on("postgres_changes", { event: "*", schema: "public", table: "column_values", filter }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "updates", filter }, refresh)
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [boardId, qc]);

  return live;
}
