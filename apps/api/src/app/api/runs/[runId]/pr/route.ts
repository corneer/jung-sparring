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

  await supabase.from("runs").update({ status: "pr-ing" }).eq("id", runId);

  const ideaText = (ideas as Idea[]).map((i) => i.content).join("\n\n---\n\n");
  const model = getModel();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      };

      try {
        // Run Ebbe, Lova and Felix in parallel
        const ebbePromise = (async () => {
          const s = anthropic.messages.stream({
            model,
            max_tokens: 2048,
            temperature: getTemperature("ebbe"),
            system: loadAgentPrompt("ebbe"),
            messages: [{ role: "user", content: `IDÉER ATT BEDÖMA FÖR EARNED MEDIA:\n\n${ideaText}` }],
          });
          let text = "";
          for await (const event of s) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              text += event.delta.text;
              send({ role: "ebbe", type: "delta", content: event.delta.text });
            }
          }
          send({ role: "ebbe", type: "done" });
          return text;
        })();

        const lovaPromise = (async () => {
          const s = anthropic.messages.stream({
            model,
            max_tokens: 2048,
            temperature: getTemperature("lova"),
            system: loadAgentPrompt("lova"),
            messages: [{ role: "user", content: `IDÉER ATT BEDÖMA FÖR SOCIAL & INFLUENCER:\n\n${ideaText}` }],
          });
          let text = "";
          for await (const event of s) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              text += event.delta.text;
              send({ role: "lova", type: "delta", content: event.delta.text });
            }
          }
          send({ role: "lova", type: "done" });
          return text;
        })();

        const felixPromise = (async () => {
          const s = anthropic.messages.stream({
            model,
            max_tokens: 2048,
            temperature: getTemperature("felix"),
            system: loadAgentPrompt("felix"),
            messages: [{ role: "user", content: `IDÉER ATT BEDÖMA FÖR EXPERIENCE:\n\n${ideaText}` }],
          });
          let text = "";
          for await (const event of s) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              text += event.delta.text;
              send({ role: "felix", type: "delta", content: event.delta.text });
            }
          }
          send({ role: "felix", type: "done" });
          return text;
        })();

        const [ebbeText, lovaText, felixText] = await Promise.all([
          ebbePromise,
          lovaPromise,
          felixPromise,
        ]);

        // Save PR evaluation
        await supabase.from("pr_evaluations").insert({
          run_id: runId,
          ebbe_output: ebbeText,
          lova_output: lovaText,
          felix_output: felixText,
        });

        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send({ role: "ebbe", type: "error", error: message });
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
