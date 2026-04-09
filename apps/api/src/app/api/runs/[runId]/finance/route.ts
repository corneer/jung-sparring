import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { anthropic } from "@/lib/anthropic";
import { loadAgentPrompt, getTemperature, getModel } from "@/lib/agents/loader";
import type { Idea } from "@jung/types";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;

  const { data: run } = await supabase.from("runs").select("*").eq("id", runId).single();
  if (!run) return new Response(JSON.stringify({ error: "Run not found" }), { status: 404 });

  const { data: ideas } = await supabase
    .from("ideas")
    .select("*")
    .eq("run_id", runId);

  if (!ideas || ideas.length === 0) {
    return new Response(JSON.stringify({ error: "No ideas found" }), { status: 400 });
  }

  await supabase.from("runs").update({ status: "financing" }).eq("id", runId);

  const ideaText = (ideas as Idea[]).map((i) => i.content).join("\n\n---\n\n");
  const model = getModel();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      };

      try {
        // Run Tilde (CFO) and Otto (Account Director) in parallel
        const tildePromise = (async () => {
          const s = anthropic.messages.stream({
            model,
            max_tokens: 2048,
            temperature: getTemperature("tilde"),
            system: loadAgentPrompt("tilde"),
            messages: [{ role: "user", content: `IDÉER ATT BEDÖMA FINANSIELLT:\n\n${ideaText}` }],
          });
          let text = "";
          for await (const event of s) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              text += event.delta.text;
              send({ role: "tilde", type: "delta", content: event.delta.text });
            }
          }
          send({ role: "tilde", type: "done" });
          return text;
        })();

        const ottoPromise = (async () => {
          const s = anthropic.messages.stream({
            model,
            max_tokens: 2048,
            temperature: getTemperature("otto"),
            system: loadAgentPrompt("otto"),
            messages: [{ role: "user", content: `IDÉER ATT BEDÖMA FRÅN ACCOUNT-PERSPEKTIV:\n\n${ideaText}` }],
          });
          let text = "";
          for await (const event of s) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              text += event.delta.text;
              send({ role: "otto", type: "delta", content: event.delta.text });
            }
          }
          send({ role: "otto", type: "done" });
          return text;
        })();

        const [tildeText, ottoText] = await Promise.all([tildePromise, ottoPromise]);

        // Save finance evaluation
        await supabase.from("finance_evaluations").insert({
          run_id: runId,
          tilde_output: tildeText,
          otto_output: ottoText,
        });

        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send({ role: "tilde", type: "error", error: message });
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
