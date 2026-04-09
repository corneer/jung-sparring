import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { anthropic } from "@/lib/anthropic";
import { loadAgentPrompt, getTemperature, getModel } from "@/lib/agents/loader";
import type { Run, Insight } from "@jung/types";

export async function POST(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const body = await req.json().catch(() => ({}));
  const humanDirection: string | undefined = body?.human_direction;
  const redo: boolean = !!body?.redo;

  const { data: run } = await supabase.from("runs").select("*").eq("id", runId).single();
  if (!run) return new Response(JSON.stringify({ error: "Run not found" }), { status: 404 });

  if (redo) {
    await supabase.from("ideas").delete().eq("run_id", runId);
  }

  const { data: insights } = await supabase
    .from("insights")
    .select("*")
    .eq("run_id", runId)
    .eq("approved", true);

  if (!insights || insights.length === 0) {
    return new Response(JSON.stringify({ error: "No approved insights found" }), { status: 400 });
  }

  await supabase.from("runs").update({ status: "creating" }).eq("id", runId);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      };

      try {
        const insightText = (insights as Insight[]).map((i) => i.content).join("\n\n---\n\n");
        const directionNote = humanDirection ? `BESTÄLLARENS DIREKTIV: ${humanDirection}\n\n` : "";

        const claudeStream = anthropic.messages.stream({
          model: getModel(),
          max_tokens: 4096,
          temperature: getTemperature("hugo"),
          system: loadAgentPrompt("hugo"),
          messages: [
            {
              role: "user",
              content: `${directionNote}GODKÄNDA INSIKTER:\n${insightText}`,
            },
          ],
        });

        let fullText = "";
        for await (const event of claudeStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            fullText += event.delta.text;
            send({ role: "hugo", type: "delta", content: event.delta.text });
          }
        }

        await supabase.from("ideas").insert({
          run_id: runId,
          content: fullText,
        });

        send({ role: "hugo", type: "done" });
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send({ role: "hugo", type: "error", error: message });
        await supabase.from("runs").update({ status: "error" }).eq("id", runId);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
