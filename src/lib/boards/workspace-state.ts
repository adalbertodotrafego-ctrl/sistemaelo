// Estado leve compartilhado via localStorage: workspace selecionado e
// boards favoritos (por enquanto por dispositivo; vira tabela quando o
// time inteiro estiver dentro).
import { useEffect, useState } from "react";

const WS_KEY = "melo.workspace";
const FAV_KEY = "melo.favorites";
const EVT = "melo:state";

function read(key: string): string | null {
  return typeof window !== "undefined" ? localStorage.getItem(key) : null;
}
function emit() {
  window.dispatchEvent(new Event(EVT));
}

export function useSelectedWorkspaceId(): [string | null, (id: string) => void] {
  const [id, setId] = useState<string | null>(() => read(WS_KEY));
  useEffect(() => {
    const on = () => setId(read(WS_KEY));
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  return [
    id,
    (v: string) => {
      localStorage.setItem(WS_KEY, v);
      emit();
    },
  ];
}

export function useFavorites(): [Set<string>, (boardId: string) => void] {
  const [favs, setFavs] = useState<Set<string>>(
    () => new Set<string>(JSON.parse(read(FAV_KEY) ?? "[]")),
  );
  useEffect(() => {
    const on = () => setFavs(new Set<string>(JSON.parse(read(FAV_KEY) ?? "[]")));
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  return [
    favs,
    (boardId: string) => {
      const next = new Set<string>(JSON.parse(read(FAV_KEY) ?? "[]"));
      if (next.has(boardId)) next.delete(boardId);
      else next.add(boardId);
      localStorage.setItem(FAV_KEY, JSON.stringify([...next]));
      emit();
    },
  ];
}
