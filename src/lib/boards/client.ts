import { supabase } from "@/integrations/supabase/client";

// As tabelas de Tarefas (workspaces, boards, groups, columns, items,
// column_values, updates…) não existem no types.ts gerado do Sistema Elo, então
// `supabase.from("boards")` não compila. Este alias reusa exatamente o MESMO
// cliente (mesma sessão, mesmo login) apenas sem a tipagem estrita das tabelas.
// Os tipos de retorno vêm de ./types.
export const sb = supabase as any;
