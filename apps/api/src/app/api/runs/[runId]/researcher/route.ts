import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { runResearcher } from "@/lib/agents/orchestrator";
import type { Client, Run } from "@jung/types";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;

  const { data: run } = await supabase.from("runs").select("*").eq("id", runId).single();
  if (!run) return new Response(JSON.stringify({ error: "Run not found" }), { status: 404 });

  const { data: client } = await supabase
    .from("clients").select("*").eq("id", (run as Run).client_id).single();
  if (!client) return new Response(JSON.stringify({ error: "Client not found" }), { status: 404 });

  await supabase.from("runs").update({ status: "researching" }).eq("id", runId);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));

      try {
        const fullText = await runResearcher(client as Client, run as Run, send);

        await supabase.from("signals").insert({
          run_id: runId,
          content: fullText,
          sources: [],
          approved: null,
        });

        send({ role: "finn", type: "done" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send({ role: "researcher", type: "error", error: message });
        await supabase.from("runs").update({ status: "error" }).eq("id", runId);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
