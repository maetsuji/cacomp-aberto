const GIPHY_RANDOM_ENDPOINT = "https://api.giphy.com/v1/gifs/random";

interface GiphyRandomResponse {
  data?: {
    images?: {
      fixed_height?: { url?: string };
    };
  };
}

/**
 * Busca um GIF aleatório no GIPHY para o tema informado, filtrado para
 * público geral (rating "g" bloqueia conteúdo explícito/violento).
 *
 * Sem `cache: "no-store"` de propósito: esse fetch herda o
 * `revalidate` da Home (Seção "ESTRATÉGIA DE CACHE" em page.tsx), então
 * o GIF muda a cada regeneração — a cada 5 min ou quando um reporte
 * dispara `revalidatePath("/")` — sem tornar a página dinâmica.
 */
export async function getRandomGif(tag: string): Promise<string | null> {
  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey) return null;

  const url = new URL(GIPHY_RANDOM_ENDPOINT);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("tag", tag);
  url.searchParams.set("rating", "g");

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;

    const json = (await res.json()) as GiphyRandomResponse;
    return json.data?.images?.fixed_height?.url ?? null;
  } catch {
    // GIPHY fora do ar ou lento não pode derrubar a regeneração da Home.
    return null;
  }
}
