import {
  shortlinkConfigured,
  syncShortLinks,
  type StoredShortLinks,
} from "./shortlink";
import {
  buildNextTokens,
  getReportTokens,
  saveReportTokens,
  type ReportTokens,
} from "./tokens";

export interface RotateResult {
  rotated: boolean;
  tokens: ReportTokens;
  links: StoredShortLinks;
  errors: string[];
}

/**
 * Rotaciona os tokens de reporte e atualiza os short links (short.io).
 *
 * Ordem importa: os short links são atualizados PRIMEIRO; os tokens
 * novos só são persistidos se a sincronização não teve erro. Assim, uma
 * falha na API do short.io deixa tudo como estava (QRs impressos
 * continuam válidos), em vez de deixar links apontando pra tokens mortos.
 *
 * `force` (botão do /admin) rotaciona mesmo sem short.io configurado —
 * útil antes dos short links existirem, mas invalida QRs impressos com
 * URL direta. O cron diário NUNCA força: sem short links configurados,
 * rotação automática quebraria os QRs todo dia.
 */
export async function rotateAndSync(opts: {
  force: boolean;
}): Promise<RotateResult> {
  const current = await getReportTokens();
  const candidate = buildNextTokens(current);

  if (!shortlinkConfigured()) {
    if (!opts.force) {
      return {
        rotated: false,
        tokens: current,
        links: {},
        errors: [
          "short.io não configurado (SHORTIO_API_KEY/SHORTIO_DOMAIN) — rotação automática pulada",
        ],
      };
    }
    await saveReportTokens(candidate);
    return {
      rotated: true,
      tokens: candidate,
      links: {},
      errors: [
        "Tokens rotacionados SEM short links (short.io não configurado) — QRs com URL direta antiga ficaram inválidos",
      ],
    };
  }

  const { links, errors } = await syncShortLinks(candidate);

  if (errors.length > 0) {
    // short.io falhou: mantém os tokens atuais (QRs continuam funcionando).
    return { rotated: false, tokens: current, links, errors };
  }

  await saveReportTokens(candidate);
  return { rotated: true, tokens: candidate, links, errors: [] };
}
