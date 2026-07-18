/* Faixa do slider de /admin/aparencia. Módulo separado de
 * background-settings.ts (que importa ./store, e por sua vez o pacote
 * `redis`) porque BackgroundEditor.tsx é Client Component: importar um
 * valor (não um `import type`) de um arquivo com dependências
 * server-only faz o webpack tentar empacotar `redis`/`net` no bundle
 * do navegador. */
export const BACKGROUND_LIMITS = {
  overlayOpacity: { min: 0, max: 1, step: 0.01 },
} as const;
