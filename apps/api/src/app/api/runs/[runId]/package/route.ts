import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { anthropic } from "@/lib/anthropic";
import { loadAgentPrompt, getTemperature, getModel } from "@/lib/agents/loader";
import type { Signal, Insight, Idea } from "@jung/types";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;

  const { data: run } = await supabase.from("runs").select("*").eq("id", runId).single();
  if (!run) return new Response(JSON.stringify({ error: "Run not found" }), { status: 404 });

  // Gather all pipeline output
  const [
    { data: insights },
    { data: ideas },
    { data: evaluations },
    { data: financeEvals },
    { data: prEvals },
  ] = await Promise.all([
    supabase.from("insights").select("*").eq("run_id", runId).eq("approved", true),
    supabase.from("ideas").select("*").eq("run_id", runId),
    supabase.from("evaluations").select("*").in(
      "idea_id",
      (await supabase.from("ideas").select("id").eq("run_id", runId)).data?.map((i: { id: string }) => i.id) ?? []
    ),
    supabase.from("finance_evaluations").select("*").eq("run_id", runId).order("created_at", { ascending: false }).limit(1),
    supabase.from("pr_evaluations").select("*").eq("run_id", runId).order("created_at", { ascending: false }).limit(1),
  ]);

  await supabase.from("runs").update({ status: "packaging" }).eq("id", runId);

  const insightText = (insights as Insight[] ?? []).map((i) => i.content).join("\n\n---\n\n");
  const ideaText = (ideas as Idea[] ?? []).map((i) => i.content).join("\n\n---\n\n");

  // Surface Sigge's and Isak's actual critique
  const evalText = evaluations?.length
    ? evaluations.map((e: { filter_reasoning: string; opponent_challenge: string }) =>
        `SIGGES DOM:\n${e.filter_reasoning}\n\nISAKS INVÄNDNING:\n${e.opponent_challenge}`
      ).join("\n\n---\n\n")
    : "Ingen oppositionsbedömning tillgänglig.";

  const financeText = financeEvals?.[0]
    ? `TILDE (CFO):\n${financeEvals[0].tilde_output}\n\nOTTO (ACCOUNT):\n${financeEvals[0].otto_output}`
    : "Ingen finansbedömning tillgänglig.";
  const prText = prEvals?.[0]
    ? `EBBE (EARNED MEDIA):\n${prEvals[0].ebbe_output}\n\nLOVA (SOCIAL):\n${prEvals[0].lova_output}\n\nFELIX (EXPERIENCE):\n${prEvals[0].felix_output}`
    : "Ingen PR-bedömning tillgänglig.";

  const context = `UPPDRAG: ${run.topic}

## INSIKTER (Nora — godkända av beställaren)
${insightText}

## KREATIVT KONCEPT (Hugo)
${ideaText}

## OPPOSITIONENS DOM (Sigge + Isak)
${evalText}

## FINANSIELL BEDÖMNING (Tilde + Otto)
${financeText}

## PR-BEDÖMNING (Ebbe + Lova + Felix)
${prText}`;

  const model = getModel();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      };

      try {
        const s = anthropic.messages.stream({
          model,
          max_tokens: 4096,
          temperature: getTemperature("alba"),
          system: loadAgentPrompt("alba"),
          messages: [{ role: "user", content: `Paketera följande pipeline-output till en Figma-ready brief:\n\n${context}` }],
        });

        let briefText = "";
        for await (const event of s) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            briefText += event.delta.text;
            send({ role: "alba", type: "delta", content: event.delta.text });
          }
        }

        send({ role: "alba", type: "done" });

        // Save brief
        await supabase.from("briefs").insert({
          run_id: runId,
          content: briefText,
        });

        await supabase.from("runs").update({ status: "done" }).eq("id", runId);
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send({ role: "alba", type: "error", error: message });
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
