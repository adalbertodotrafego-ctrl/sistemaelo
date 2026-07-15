// Contas do Google Ads monitoradas (somadas com o Meta na aba Clientes → verba).
// Mapeamento fixo: nome do cliente (mesma convenção usada em META_ACCOUNTS) -> Customer ID
// da conta no Google Ads (só números, sem hífen).
// Preencha esta lista quando as credenciais GOOGLE_ADS_* estiverem configuradas no servidor
// (ver src/lib/google-ads.functions.ts) — até lá a integração fica "não conectada" e a
// verba mostrada em Clientes usa só o Meta.

export type GoogleAdsAccount = {
  /** Nome do cliente exibido no sistema (mesmo texto usado em META_ACCOUNTS quando o cliente tem as duas contas) */
  client: string;
  /** Nome da conta no Google Ads (referência) */
  accountName: string;
  /** Customer ID da conta (10 dígitos, sem hífen) */
  customerId: string;
  /** Moeda da conta */
  currency: "BRL" | "USD";
};

export const GOOGLE_ADS_ACCOUNTS: GoogleAdsAccount[] = [];
