/**
 * Agent Orchestrator
 *
 * Hierarki:
 *   MainOrchestrator
 *     └── ResearcherOrchestrator  (kan spwana sub-agenter: search, monitor)
 *     └── PlannerOrchestrator     (kan spwana sub-agenter: deep-research, synthesis)
 *     └── CreativeAgent
 *     └── EvalOrchestrator        (spwnar Filter + Opponent parallellt)
 *         ├── FilterAgent
 *         └── OpponentAgent
 *
 * Varje "orchestrator"-agent kör Claude med tool_use där verktygen
 * antingen anropar externa API:er (parallel.ai) eller kör sub-agenter.
 */

import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/anthropic";
import { parallelSearch, parallelDeepResearch, formatSearchResultsAsContext } from "@/lib/parallel";
import {
  researcherSystemPrompt,
  plannerSystemPrompt,
  creativeSystemPrompt,
  filterSystemPrompt,
  opponentSystemPrompt,
} from "./prompts";
import type { Client, Run, Signal, Insight, AgentRole } from "@jung/types";

export interface StreamEvent {
  role: AgentRole;
  type: "delta" | "done" | "error";
  content?: string;
  error?: string;
}

type Emit = (event: StreamEvent) => void;

// ─── Tool definitions ─────────────────────────────────────────────────────────

const parallelSearchTool: Anthropic.Tool = {
  name: "parallel_search",
  description: "Sök efter aktuella nyheter och trender via Parallel.ai",
  input_schema: {
    type: "object" as const,
    properties: {
      query: { type: "string", description: "Sökfrågan" },
    },
    required: ["query"],
  },
};

const parallelDeepResearchTool: Anthropic.Tool = {
  name: "parallel_deep_research",
  description: "Kör djupgående research via Parallel.ai för komplex analys",
  input_schema: {
    type: "object" as const,
    properties: {
      query: { type: "string", description: "Frågan att forska kring" },
    },
    required: ["query"],
  },
};

// ─── Tool executor ────────────────────────────────────────────────────────────

async function executeTool(
  toolName: string,
  toolInput: Record<string, string>,
  emit: Emit,
  role: AgentRole
): Promise<string> {
  if (toolName === "parallel_search") {
    emit({ role, type: "delta", content: `\n🔍 Söker: "${toolInput.query}"...\n` });
    const results = await parallelSearch(toolInput.query);
    const formatted = formatSearchResultsAsContext(results);
    emit({ role, type: "delta", content: `✓ ${results.length} resultat hittades.\n\n` });
    return formatted;
  }

  if (toolName === "parallel_deep_research") {
    emit({ role, type: "delta", content: `\n🔬 Djupanalys: "${toolInput.query}"...\n` });
    const result = await parallelDeepResearch(toolInput.query);
    emit({ role, type: "delta", content: `✓ Djupanalys klar.\n\n` });
    return result.answer;
  }

  return `Okänt verktyg: ${toolName}`;
}

// ─── Agentic loop (orchestrator pattern) ─────────────────────────────────────

async function agentLoop(
  role: AgentRole,
  systemPrompt: string,
  userMessage: string,
  tools: Anthropic.Tool[],
  emit: Emit,
  maxIterations = 5
): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  let fullOutput = "";

  for (let i = 0; i < maxIterations; i++) {
    const response = await anthropic.messages.create({
      model: role === "creative" ? "claude-sonnet-4-6" : "claude-opus-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      tools: tools.length > 0 ? tools : undefined,
      messages,
    });

    // Stream text content
    for (const block of response.content) {
      if (block.type === "text") {
        fullOutput += block.text;
        emit({ role, type: "delta", content: block.text });
      }
    }

    // If done, return
    if (response.stop_reason === "end_turn") {
      break;
    }

    // Handle tool use
    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of toolUseBlocks) {
        if (block.type !== "tool_use") continue;
        const result = await executeTool(
          block.name,
          block.input as Record<string, string>,
          emit,
          role
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }

      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    break;
  }

  return fullOutput;
}

// ─── Public agent runners ─────────────────────────────────────────────────────

export async function runResearcher(
  client: Client,
  run: Run,
  emit: Emit
): Promise<string> {
  return agentLoop(
    "researcher",
    researcherSystemPrompt(client, run.topic),
    `Analysera ämnet "${run.topic}" för klienten ${client.name}. Använd parallel_search för att hitta aktuella signaler. Gör minst 2–3 sökningar med olika vinklar.`,
    [parallelSearchTool],
    emit
  );
}

export async function runPlanner(
  client: Client,
  run: Run,
  signals: Signal[],
  emit: Emit
): Promise<string> {
  const signalText = signals.map((s) => s.content).join("\n\n---\n\n");
  return agentLoop(
    "planner",
    plannerSystemPrompt(client, run.topic),
    `GODKÄNDA SIGNALER:\n${signalText}\n\nAnvänd parallel_deep_research för att fördjupa analysen och destillera starka insikter för ${client.name}.`,
    [parallelDeepResearchTool],
    emit
  );
}

export async function runCreative(
  client: Client,
  insights: Insight[],
  emit: Emit
): Promise<string> {
  const insightText = insights.map((i) => i.content).join("\n\n---\n\n");
  return agentLoop(
    "creative",
    creativeSystemPrompt(client),
    `GODKÄNDA INSIKTER:\n${insightText}\n\nGenerera nu konkreta idéer.`,
    [],
    emit
  );
}

export async function runEvaluation(
  ideas: { content: string }[],
  insights: Insight[],
  emit: Emit
): Promise<{ filterOutput: string; opponentOutput: string }> {
  const ideaText = ideas.map((i) => i.content).join("\n\n---\n\n");
  const insightText = insights.map((i) => i.content).join("\n\n---\n\n");

  // Filter and Opponent run in parallel – each is its own agent loop
  const [filterOutput, opponentOutput] = await Promise.all([
    agentLoop(
      "filter",
      filterSystemPrompt(),
      `IDÉER ATT GRANSKA:\n${ideaText}`,
      [],
      emit
    ),
    agentLoop(
      "opponent",
      opponentSystemPrompt(),
      `INSIKTER:\n${insightText}\n\nIDÉER ATT UTMANA:\n${ideaText}`,
      [],
      emit
    ),
  ]);

  return { filterOutput, opponentOutput };
}
