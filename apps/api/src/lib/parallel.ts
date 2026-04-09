// Tavily API — web search for AI agents
// Docs: https://docs.tavily.com
// Free tier: 1 000 req/month — sign up at https://tavily.com

const TAVILY_BASE_URL = "https://api.tavily.com";

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  published_date?: string;
  score: number;
}

interface TavilySearchResponse {
  results: TavilyResult[];
  answer?: string;
}

// ─── Shared types (kept for backwards-compat with orchestrator) ───────────────

export interface ParallelSearchResult {
  title: string;
  url: string;
  snippet: string;
  published_at?: string;
}

// ─── Tavily client ────────────────────────────────────────────────────────────

async function tavilyFetch(
  path: string,
  body: object,
  timeoutMs = 15000
): Promise<Response> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY is not set");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${TAVILY_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, ...body }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function parallelSearch(query: string): Promise<ParallelSearchResult[]> {
  try {
    const res = await tavilyFetch("/search", {
      query,
      search_depth: "basic",
      max_results: 6,
    });
    if (!res.ok) {
      console.warn(`[tavily] search failed (${res.status})`);
      return [];
    }
    const data: TavilySearchResponse = await res.json();
    return (data.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
      published_at: r.published_date,
    }));
  } catch (err) {
    console.warn("[tavily] search error:", err instanceof Error ? err.message : err);
    return [];
  }
}

export async function parallelDeepResearch(query: string): Promise<{ answer: string; sources: { title: string; url: string }[] }> {
  try {
    const res = await tavilyFetch(
      "/search",
      { query, search_depth: "advanced", max_results: 8 },
      30000
    );
    if (!res.ok) {
      console.warn(`[tavily] deep search failed (${res.status})`);
      return { answer: "Djupanalys ej tillgänglig. Använder befintlig kunskap.", sources: [] };
    }
    const data: TavilySearchResponse = await res.json();
    const answer =
      data.answer ??
      (data.results ?? [])
        .slice(0, 5)
        .map((r) => `${r.title}: ${r.content}`)
        .join("\n\n");
    const sources = (data.results ?? []).map((r) => ({ title: r.title, url: r.url }));
    return { answer, sources };
  } catch (err) {
    console.warn("[tavily] deep search error:", err instanceof Error ? err.message : err);
    return { answer: "Djupanalys ej tillgänglig. Använder befintlig kunskap.", sources: [] };
  }
}

export function formatSearchResultsAsContext(results: ParallelSearchResult[]): string {
  if (results.length === 0) return "Inga sökresultat. Basera svaret på din träningsdata.";
  return results
    .map(
      (r, i) =>
        `[${i + 1}] ${r.title}\nKälla: ${r.url}${r.published_at ? ` (${r.published_at})` : ""}\n${r.snippet}`
    )
    .join("\n\n");
}
