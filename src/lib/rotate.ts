import { lccxConfigured, syncShortLinks, type StoredShortLinks } from "./shortlink";
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
 * Rotaciona os tokens de reporte e atualiza os short links do lc.cx.
 *
 * Ordem importa: os short links são atualizados PRIMEIRO; os tokens
 * novos só são persistidos se a sincronização não teve erro. Assim, uma
 * falha na API do lc.cx deixa tudo como estava (QRs impressos continuam
 * válidos), em vez de deixar os links apontando para tokens mortos.
 *
 * `force` (botão do /admin) rotaciona mesmo sem lc.cx configurado —
 * útil antes dos short links existirem, mas invalida QRs impressos com
 * URL direta. O cron diário NUNCA força: sem short links configurados,
 * rotação automática quebraria os QRs todo dia.
 */
export async function rotateAndSync(opts: {
  force: boolean;
}): Promise<RotateResult> {
  const current = await getReportTokens();
  const candidate = buildNextTokens(current);

  if (!lccxConfigured()) {
    if (!opts.force) {
      return {
        rotated: false,
        tokens: current,
        links: {},
        errors: ["LCCX_API_KEY não configurada — rotação automática pulada"],
      };
    }
    await saveReportTokens(candidate);
    return {
      rotated: true,
      tokens: candidate,
      links: {},
      errors: [
        "Tokens rotacionados SEM short links (LCCX_API_KEY ausente) — QRs com URL direta antiga ficaram inválidos",
      ],
    };
  }

  const { links, errors } = await syncShortLinks(candidate);

  if (errors.length > 0) {
    // lc.cx falhou: mantém os tokens atuais (QRs continuam funcionando).
    return { rotated: false, tokens: current, links, errors };
  }

  await saveReportTokens(candidate);
  return { rotated: true, tokens: candidate, links, errors: [] };
}
