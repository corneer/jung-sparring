// Parallel.ai API integration
// Docs: https://docs.parallel.ai

const PARALLEL_BASE_URL = "https://api.parallel.ai/v1";

interface ParallelSearchResult {
  title: string;
  url: string;
  snippet: string;
  published_at?: string;
}

interface ParallelSearchResponse {
  results: ParallelSearchResult[];
}

interface ParallelDeepResearchResponse {
  answer: string;
  sources: { title: string; url: string }[];
}

async function parallelFetch(path: string, body: object, timeoutMs = 15000): Promise<Response> {
  const apiKey = process.env.PARALLEL_AI_API_KEY;
  if (!apiKey) throw new Error("PARALLEL_AI_API_KEY is not set");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${PARALLEL_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function parallelSearch(query: string): Promise<ParallelSearchResult[]> {
  try {
    const res = await parallelFetch("/search", { query });
    if (!res.ok) {
      const err = await res.text();
      console.warn(`[parallel] search failed (${res.status}): ${err}`);
      return [];
    }
    const data: ParallelSearchResponse = await res.json();
    return data.results ?? [];
  } catch (err) {
    console.warn("[parallel] search error:", err instanceof Error ? err.message : err);
    return [];
  }
}

export async function parallelDeepResearch(query: string): Promise<ParallelDeepResearchResponse> {
  try {
    const res = await parallelFetch("/deep-research", { query }, 30000);
    if (!res.ok) {
      const err = await res.text();
      console.warn(`[parallel] deep-research failed (${res.status}): ${err}`);
      return { answer: "Djupanalys ej tillgänglig. Använder befintlig kunskap.", sources: [] };
    }
    return res.json();
  } catch (err) {
    console.warn("[parallel] deep-research error:", err instanceof Error ? err.message : err);
    return { answer: "Djupanalys ej tillgänglig. Använder befintlig kunskap.", sources: [] };
  }
}

// Format search results as context for Claude
export function formatSearchResultsAsContext(results: ParallelSearchResult[]): string {
  if (results.length === 0) return "Inga sökresultat hittades.";
  return results
    .map(
      (r, i) =>
        `[${i + 1}] ${r.title}\nKälla: ${r.url}${r.published_at ? ` (${r.published_at})` : ""}\n${r.snippet}`
    )
    .join("\n\n");
}
