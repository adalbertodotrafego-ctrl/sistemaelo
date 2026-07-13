// Traduz uma mensagem de erro técnica (JS/Supabase) para algo que o usuário
// entende, com uma dica prática do que fazer — usado pela tela de erro global.
export type FriendlyError = { title: string; description: string; tip: string };

export function humanizeError(error: unknown): FriendlyError {
  const message = error instanceof Error ? error.message : String(error);
  const msg = message.toLowerCase();

  if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("network request failed")) {
    return {
      title: "Sem conexão com o servidor",
      description: "O sistema não conseguiu se comunicar com o banco de dados nesse momento.",
      tip: "Confira sua internet e tente novamente. Se persistir, o servidor pode estar temporariamente fora do ar.",
    };
  }
  if (msg.includes("jwt") || msg.includes("token") || msg.includes("not authenticated") || msg.includes("session")) {
    return {
      title: "Sua sessão expirou",
      description: "Você precisa entrar de novo para continuar usando o sistema.",
      tip: 'Clique em "Ir para o início" e faça login novamente com seu email e senha.',
    };
  }
  if (msg.includes("permission") || msg.includes("rls") || msg.includes("policy") || msg.includes("403") || msg.includes("row-level security")) {
    return {
      title: "Sem permissão para essa ação",
      description: "Seu usuário não tem acesso a essa parte do sistema.",
      tip: "Peça para um administrador revisar seu cargo em Configurações → Cargos & Permissões.",
    };
  }
  if (msg.includes("duplicate key") || msg.includes("already exists") || msg.includes("unique constraint")) {
    return {
      title: "Esse registro já existe",
      description: "Você tentou salvar algo que já está cadastrado no sistema.",
      tip: "Volte e verifique se esse item já não existe antes de criar de novo.",
    };
  }
  if (msg.includes("violates") || msg.includes("null value") || msg.includes("required") || msg.includes("obrigat")) {
    return {
      title: "Faltou preencher alguma informação",
      description: "Um campo obrigatório não foi preenchido corretamente antes de salvar.",
      tip: "Volte e confira se todos os campos com * estão preenchidos.",
    };
  }
  return {
    title: "Algo deu errado",
    description: "O sistema encontrou um problema inesperado ao carregar essa tela.",
    tip: "Tente novamente. Se o erro continuar, copie o prompt abaixo e me envie numa conversa para eu investigar.",
  };
}

// Código curto e estável por incidente (mesma mensagem + mesma hora = mesmo
// código) — só para você conseguir referenciar o erro numa conversa comigo,
// não é rastreamento nem armazena nada em lugar nenhum.
export function errorRefCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const seed = message + new Date().toISOString().slice(0, 13);
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h << 5) - h + seed.charCodeAt(i);
  return `ELO-${Math.abs(h).toString(36).toUpperCase().slice(0, 6)}`;
}
