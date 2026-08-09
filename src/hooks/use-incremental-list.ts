// =====================================================================
// Lista que cresce conforme o usuário rola
// =====================================================================
// Um grupo pode ter milhares de itens (o "Arquivo de Demandas" tem 2.656).
// Renderizar tudo de uma vez cria dezenas de milhares de nós no DOM — cada
// linha tem uma célula por coluna — e o navegador congela ao abrir o quadro.
//
// Em vez de virtualizar de verdade (o que exigiria altura fixa e brigaria
// com o arrastar-e-soltar e com as colunas redimensionáveis), a lista começa
// com um pedaço e cresce sozinha quando a sentinela do fim aparece na tela.
// A rolagem continua natural e o DOM fica pequeno.
import { useCallback, useEffect, useRef, useState } from "react";

export function useIncrementalList<T>(items: T[], chunk = 60) {
  const [limit, setLimit] = useState(chunk);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Lista trocou (busca, outro quadro): volta ao pedaço inicial.
  useEffect(() => { setLimit(chunk); }, [items, chunk]);

  const hasMore = limit < items.length;

  const showMore = useCallback(() => {
    setLimit((n) => Math.min(n + chunk, items.length));
  }, [chunk, items.length]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    // rootMargin: começa a carregar antes de o fim entrar na tela, para a
    // rolagem não "bater" no vazio.
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) showMore(); },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, showMore]);

  return {
    visible: hasMore ? items.slice(0, limit) : items,
    hidden: Math.max(0, items.length - limit),
    hasMore,
    showMore,
    sentinelRef,
  };
}
