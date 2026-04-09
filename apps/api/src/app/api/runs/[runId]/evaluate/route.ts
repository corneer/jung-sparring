import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { anthropic } from "@/lib/anthropic";
import { filterSystemPrompt, opponentSystemPrompt } from "@/lib/agents/prompts";
import type { Run, Idea, Insight } from "@jung/types";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;

  const { data: run } = await supabase.from("runs").select("*").eq("id", runId).single();
  if (!run) return new Response(JSON.stringify({ error: "Run not found" }), { status: 404 });

  const { data: ideas } = await supabase.from("ideas").select("*").eq("run_id", runId);
  const { data: insights } = await supabase
    .from("insights")
    .select("*")
    .eq("run_id", runId)
    .eq("approved", true);

  if (!ideas || ideas.length === 0) {
    return new Response(JSON.stringify({ error: "No ideas found" }), { status: 400 });
  }

  await supabase.from("runs").update({ status: "evaluating" }).eq("id", runId);

  const ideaText = (ideas as Idea[]).map((i) => i.content).join("\n\n---\n\n");
  const insightText = (insights as Insight[] ?? []).map((i) => i.content).join("\n\n---\n\n");

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      };

      try {
        // Run Filter and Opponent in parallel
        const filterPromise = (async () => {
          const s = anthropic.messages.stream({
            model: "claude-opus-4-6",
            max_tokens: 2048,
            system: filterSystemPrompt(),
            messages: [{ role: "user", content: `IDÉER ATT GRANSKA:\n${ideaText}` }],
          });
          let text = "";
          for await (const event of s) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              text += event.delta.text;
              send({ role: "filter", type: "delta", content: event.delta.text });
            }
          }
          send({ role: "filter", type: "done" });
          return text;
        })();

        const opponentPromise = (async () => {
          const s = anthropic.messages.stream({
            model: "claude-opus-4-6",
            max_tokens: 2048,
            system: opponentSystemPrompt(),
            messages: [
              {
                role: "user",
                content: `INSIKTER:\n${insightText}\n\nIDÉER ATT UTMANA:\n${ideaText}`,
              },
            ],
          });
          let text = "";
          for await (const event of s) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              text += event.delta.text;
              send({ role: "opponent", type: "delta", content: event.delta.text });
            }
          }
          send({ role: "opponent", type: "done" });
          return text;
        })();

        const [filterText, opponentText] = await Promise.all([filterPromise, opponentPromise]);

        // Save evaluation
        for (const idea of ideas as Idea[]) {
          await supabase.from("evaluations").insert({
            idea_id: idea.id,
            filter_score: 5, // default score; full parse could extract per-idea scores
            filter_reasoning: filterText,
            opponent_challenge: opponentText,
            survived: true, // user makes final call
          });
        }

        await supabase.from("runs").update({ status: "done" }).eq("id", runId);
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send({ role: "filter", type: "error", error: message });
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
