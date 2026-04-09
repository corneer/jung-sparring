import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { anthropic } from "@/lib/anthropic";
import { creativeSystemPrompt } from "@/lib/agents/prompts";
import type { Client, Run, Insight } from "@jung/types";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;

  const { data: run } = await supabase.from("runs").select("*").eq("id", runId).single();
  if (!run) return new Response(JSON.stringify({ error: "Run not found" }), { status: 404 });

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", (run as Run).client_id)
    .single();
  if (!client) return new Response(JSON.stringify({ error: "Client not found" }), { status: 404 });

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

        const claudeStream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system: creativeSystemPrompt(client as Client),
          messages: [
            {
              role: "user",
              content: `GODKÄNDA INSIKTER:\n${insightText}\n\nGenerera nu konkreta idéer baserade på dessa insikter.`,
            },
          ],
        });

        let fullText = "";
        for await (const event of claudeStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            fullText += event.delta.text;
            send({ role: "creative", type: "delta", content: event.delta.text });
          }
        }

        await supabase.from("ideas").insert({
          run_id: runId,
          content: fullText,
        });

        send({ role: "creative", type: "done" });
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send({ role: "creative", type: "error", error: message });
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
