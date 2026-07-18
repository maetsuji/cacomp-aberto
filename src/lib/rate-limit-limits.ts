/* Faixa do slider de janela do rate-limit em /admin. Módulo separado de
 * rate-limit.ts (que importa ./store, e por sua vez o pacote `redis`)
 * porque RateLimitEditor.tsx é Client Component: importar um valor (não
 * um `import type`) de um arquivo com dependências server-only faz o
 * webpack tentar empacotar `redis`/`net` no bundle do navegador. */
export const RATE_LIMIT_WINDOW_LIMITS = {
  minutes: { min: 1, max: 60, step: 1 },
} as const;

export const DEFAULT_RATE_LIMIT_WINDOW_MINUTES = 15;
