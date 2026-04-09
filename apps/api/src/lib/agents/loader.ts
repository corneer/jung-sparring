import fs from "fs";
import path from "path";
import type { AgentKey } from "@jung/types";

// Map each AgentKey to its .md file path (relative to repo root)
const AGENT_FILES: Record<AgentKey, string> = {
  axel: "agents/orchestrators/axel-research-orchestrator.md",
  saga: "agents/orchestrators/saga-creative-orchestrator.md",
  finn: "agents/research/finn-signal-collector.md",
  nora: "agents/research/nora-insight-builder.md",
  hugo: "agents/creative/hugo-art-director.md",
  tuva: "agents/creative/tuva-copywriter.md",
  viggo: "agents/creative/viggo-creative-director.md",
  sigge: "agents/opposition/sigge-ai-slop-filter.md",
  maja: "agents/opposition/maja-head-of-marketing.md",
  nils: "agents/opposition/nils-the-janitor.md",
  frida: "agents/opposition/frida-the-journalist.md",
  isak: "agents/opposition/isak-the-strategist.md",
  tilde: "agents/finance/tilde-cfo-client.md",
  otto: "agents/finance/otto-account-director.md",
  ebbe: "agents/pr/ebbe-earned-media-strategist.md",
  lova: "agents/pr/lova-social-influencer.md",
  felix: "agents/pr/felix-experience-director.md",
  alba: "agents/output/alba-packager.md",
};

// Agents that use creative temperature (1.0) — analytical agents use 0.3
const CREATIVE_AGENTS: AgentKey[] = [
  "hugo",
  "tuva",
  "viggo",
  "saga",
  "alba",
];

// Repo root is 4 levels up from apps/api/src/lib/agents/
// process.cwd() in Next.js = apps/api/ (the workspace root where next dev runs)
// Repo root is 2 levels up: apps/api/ -> apps/ -> jung-sparring/
const REPO_ROOT = path.resolve(process.cwd(), "../..");

type Variables = {
  agency: { name: string; positioning: string; language: string; tone: string };
  pipeline: { output_format: string };
  agents: { model: string; temperature_creative: number; temperature_analytical: number };
};

let variables: Variables | null = null;

function loadVariables(): Variables {
  if (variables) return variables;
  const varPath = path.join(REPO_ROOT, "config/variables.json");
  const raw = fs.readFileSync(varPath, "utf-8");
  variables = JSON.parse(raw) as Variables;
  return variables;
}

function substituteVariables(template: string, vars: Variables): string {
  return template
    .replace(/\{\{agency\.name\}\}/g, vars.agency.name)
    .replace(/\{\{agency\.positioning\}\}/g, vars.agency.positioning)
    .replace(/\{\{agency\.language\}\}/g, vars.agency.language)
    .replace(/\{\{agency\.tone\}\}/g, vars.agency.tone)
    .replace(/\{\{pipeline\.output_format\}\}/g, vars.pipeline.output_format)
    .replace(/\{\{agents\.model\}\}/g, vars.agents.model)
    .replace(/\{\{agents\.temperature_creative\}\}/g, String(vars.agents.temperature_creative))
    .replace(/\{\{agents\.temperature_analytical\}\}/g, String(vars.agents.temperature_analytical));
}

// Cache for loaded prompts
const promptCache = new Map<AgentKey, string>();

export function loadAgentPrompt(key: AgentKey): string {
  const cached = promptCache.get(key);
  if (cached) return cached;

  const vars = loadVariables();
  const relPath = AGENT_FILES[key];
  const fullPath = path.join(REPO_ROOT, relPath);
  const raw = fs.readFileSync(fullPath, "utf-8");
  const prompt = substituteVariables(raw, vars);

  promptCache.set(key, prompt);
  return prompt;
}

export function getTemperature(key: AgentKey): number {
  const vars = loadVariables();
  return CREATIVE_AGENTS.includes(key)
    ? vars.agents.temperature_creative
    : vars.agents.temperature_analytical;
}

export function getModel(): string {
  return loadVariables().agents.model;
}

export function preloadAllAgents(): void {
  const keys = Object.keys(AGENT_FILES) as AgentKey[];
  for (const key of keys) {
    loadAgentPrompt(key);
  }
  console.log(`[loader] Preloaded ${keys.length} agents`);
}
