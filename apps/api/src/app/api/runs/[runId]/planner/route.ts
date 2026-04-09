import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { runPlanner } from "@/lib/agents/orchestrator";
import type { Client, Run, Signal } from "@jung/types";

export async function POST(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const body = await req.json().catch(() => ({}));
  const humanDirection: string | undefined = body?.human_direction;
  const redo: boolean = !!body?.redo;

  const { data: run } = await supabase.from("runs").select("*").eq("id", runId).single();
  if (!run) return new Response(JSON.stringify({ error: "Run not found" }), { status: 404 });

  const { data: client } = await supabase
    .from("clients").select("*").eq("id", (run as Run).client_id).single();
  if (!client) return new Response(JSON.stringify({ error: "Client not found" }), { status: 404 });

  if (redo) {
    await supabase.from("insights").delete().eq("run_id", runId);
  }

  const { data: signals } = await supabase
    .from("signals").select("*").eq("run_id", runId).eq("approved", true);

  if (!signals || signals.length === 0) {
    return new Response(JSON.stringify({ error: "No approved signals" }), { status: 400 });
  }

  await supabase.from("runs").update({ status: "planning" }).eq("id", runId);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));

      try {
        const fullText = await runPlanner(client as Client, run as Run, signals as Signal[], send, humanDirection);

        await supabase.from("insights").insert({
          run_id: runId,
          content: fullText,
          reasoning: "",
          approved: null,
        });

        send({ role: "nora", type: "done" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send({ role: "planner", type: "error", error: message });
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
