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

async function parallelFetch(path: string, body: object): Promise<Response> {
  const apiKey = process.env.PARALLEL_AI_API_KEY;
  if (!apiKey) throw new Error("PARALLEL_AI_API_KEY is not set");

  return fetch(`${PARALLEL_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
}

export async function parallelSearch(query: string): Promise<ParallelSearchResult[]> {
  const res = await parallelFetch("/search", { query });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Parallel.ai search failed: ${err}`);
  }
  const data: ParallelSearchResponse = await res.json();
  return data.results;
}

export async function parallelDeepResearch(query: string): Promise<ParallelDeepResearchResponse> {
  const res = await parallelFetch("/deep-research", { query });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Parallel.ai deep research failed: ${err}`);
  }
  return res.json();
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
