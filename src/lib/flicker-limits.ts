/* Faixas dos sliders de /admin/flicker. Módulo separado de
 * flicker-settings.ts (que importa ./store, e por sua vez o pacote
 * `redis`) porque FlickerEditor.tsx é Client Component: importar um
 * valor (não um `import type`) de um arquivo com dependências
 * server-only faz o webpack tentar empacotar `redis`/`net` no bundle
 * do navegador. */
export const FLICKER_LIMITS = {
  onDuration: { min: 0.5, max: 4, step: 0.1 },
  ambientInterval: { min: 5, max: 30, step: 1 },
  intensity: { min: 0, max: 1, step: 0.05 },
} as const;
