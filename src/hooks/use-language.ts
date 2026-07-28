import { useSyncExternalStore } from "react";

// i18n leve: guarda o idioma no localStorage e avisa toda a árvore quando muda.
// A tradução cobre a navegação e a página de Configurações; o conteúdo das
// demais páginas é traduzido progressivamente.
export type Lang = "pt" | "en";

const KEY = "lang";
const listeners = new Set<() => void>();

function getLang(): Lang {
  if (typeof window === "undefined") return "pt";
  return (localStorage.getItem(KEY) as Lang) || "pt";
}
export function setLang(lang: Lang) {
  localStorage.setItem(KEY, lang);
  document.documentElement.lang = lang === "pt" ? "pt-BR" : "en";
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => { listeners.delete(cb); window.removeEventListener("storage", cb); };
}

const DICT: Record<string, { pt: string; en: string }> = {
  // grupos da navegação
  "nav.overview": { pt: "Visão geral", en: "Overview" },
  "nav.operation": { pt: "Operação", en: "Operations" },
  "nav.growth": { pt: "Crescimento", en: "Growth" },
  "nav.agency": { pt: "Agência", en: "Agency" },
  // itens
  "Dashboard": { pt: "Dashboard", en: "Dashboard" },
  "Novidades": { pt: "Novidades", en: "What's new" },
  "Clientes": { pt: "Clientes", en: "Clients" },
  "CRM": { pt: "CRM", en: "CRM" },
  "Tarefas": { pt: "Tarefas", en: "Tasks" },
  "Eventos": { pt: "Eventos", en: "Events" },
  "Meta Ads": { pt: "Meta Ads", en: "Meta Ads" },
  "Planejamento Elo": { pt: "Planejamento Elo", en: "Elo Planner" },
  "Metas": { pt: "Metas", en: "Goals" },
  "Relatórios": { pt: "Relatórios", en: "Reports" },
  "Equipe": { pt: "Equipe", en: "Team" },
  "Financeiro": { pt: "Financeiro", en: "Finance" },
  "Contratos": { pt: "Contratos", en: "Contracts" },
  "Arquivos": { pt: "Arquivos", en: "Files" },
  // configurações
  "settings.title": { pt: "Configurações", en: "Settings" },
  "settings.preferences": { pt: "Preferências", en: "Preferences" },
  "settings.language": { pt: "Idioma", en: "Language" },
  "settings.theme": { pt: "Tema", en: "Theme" },
  "settings.faq": { pt: "Perguntas frequentes", en: "FAQ" },
  "settings.privacy": { pt: "Privacidade", en: "Privacy" },
  "settings.about": { pt: "Sobre & Banco de dados", en: "About & Database" },
};

export function useLang() {
  const lang = useSyncExternalStore(subscribe, getLang, () => "pt" as Lang);
  const t = (key: string) => DICT[key]?.[lang] ?? key;
  return { lang, setLang, t };
}
