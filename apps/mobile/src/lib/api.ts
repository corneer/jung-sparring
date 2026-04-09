import type { Client, Run, Signal, Insight, Idea, StreamChunk, AgentRole } from "@jung/types";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

// ─── Clients ─────────────────────────────────────────────────────────────────

export async function getClients(): Promise<Client[]> {
  const res = await fetch(`${API_BASE}/api/clients`);
  if (!res.ok) throw new Error("Failed to fetch clients");
  return res.json();
}

export async function createClient(
  data: Omit<Client, "id" | "created_at">
): Promise<Client> {
  const res = await fetch(`${API_BASE}/api/clients`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create client");
  return res.json();
}

export async function updateClient(id: string, data: Partial<Client>): Promise<Client> {
  const res = await fetch(`${API_BASE}/api/clients/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update client");
  return res.json();
}

// ─── Runs ─────────────────────────────────────────────────────────────────────

export async function getRuns(clientId?: string): Promise<Run[]> {
  const url = clientId
    ? `${API_BASE}/api/runs?client_id=${clientId}`
    : `${API_BASE}/api/runs`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch runs");
  return res.json();
}

export async function createRun(clientId: string, topic: string): Promise<Run> {
  const res = await fetch(`${API_BASE}/api/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, topic }),
  });
  if (!res.ok) throw new Error("Failed to create run");
  return res.json();
}

// ─── Signals ─────────────────────────────────────────────────────────────────

export async function getSignals(runId: string): Promise<Signal[]> {
  const res = await fetch(`${API_BASE}/api/runs/${runId}/signals`);
  if (!res.ok) throw new Error("Failed to fetch signals");
  return res.json();
}

export async function approveSignals(runId: string, signalIds: string[], approved: boolean) {
  const res = await fetch(`${API_BASE}/api/runs/${runId}/signals`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signal_ids: signalIds, approved }),
  });
  if (!res.ok) throw new Error("Failed to update signals");
}

// ─── Insights ────────────────────────────────────────────────────────────────

export async function getInsights(runId: string): Promise<Insight[]> {
  const res = await fetch(`${API_BASE}/api/runs/${runId}/insights`);
  if (!res.ok) throw new Error("Failed to fetch insights");
  return res.json();
}

export async function approveInsights(runId: string, insightIds: string[], approved: boolean) {
  const res = await fetch(`${API_BASE}/api/runs/${runId}/insights`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ insight_ids: insightIds, approved }),
  });
  if (!res.ok) throw new Error("Failed to update insights");
}

// ─── Streaming ───────────────────────────────────────────────────────────────

export async function streamAgent(
  runId: string,
  agent: "researcher" | "planner" | "creative" | "evaluate",
  onChunk: (chunk: StreamChunk) => void,
  onDone: () => void,
  onError: (err: string) => void
) {
  const res = await fetch(`${API_BASE}/api/runs/${runId}/${agent}`, {
    method: "POST",
  });

  if (!res.ok || !res.body) {
    onError(`HTTP ${res.status}`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr) continue;

      try {
        const chunk: StreamChunk = JSON.parse(jsonStr);
        if (chunk.type === "done") {
          onDone();
        } else if (chunk.type === "error") {
          onError(chunk.error ?? "Unknown error");
        } else {
          onChunk(chunk);
        }
      } catch {
        // ignore malformed chunks
      }
    }
  }
}
