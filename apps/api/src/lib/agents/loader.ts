/**
 * Agent Loader
 *
 * Läser .md-filer från /agents och substituerar {{variables}}
 * från config/variables.json. Gör det möjligt att redigera
 * agenternas system prompts utan att röra kod.
 *
 * Mappning av agent-nycklar till filer:
 *   orchestrators: axel, saga
 *   research:      finn, nora
 *   creative:      hugo, tuva, viggo
 *   opposition:    sigge, maja, nils, frida, isak
 *   finance:       tilde, otto
 *   pr:            ebbe, lova, felix
 *   output:        alba
 */

import fs from "fs";
import path from "path";
import type { AgentKey } from "@jung/types";

// Gå upp från apps/api till repo-roten
const REPO_ROOT = path.resolve(__dirname, "../../../../../../../");
const AGENTS_ROOT = path.join(REPO_ROOT, "agents");
const CONFIG_PATH = path.join(REPO_ROOT, "config", "variables.json");

interface Variables {
  agency: {
    name: string;
    positioning: string;
    language: string;
    tone: string;
  };
  pipeline: {
    max_ideas_per_round: number;
    opposition_rounds: number;
    output_format: string;
  };
  agents: {
    model: string;
    temperature_creative: number;
    temperature_analytical: number;
  };
}

// Mappar AgentKey till relativ filsökväg under /agents
const AGENT_FILES: Record<AgentKey, string> = {
  axel:  "orchestrators/axel-research-orchestrator.md",
  saga:  "orchestrators/saga-creative-orchestrator.md",
  finn:  "research/finn-signal-collector.md",
  nora:  "research/nora-insight-builder.md",
  hugo:  "creative/hugo-art-director.md",
  tuva:  "creative/tuva-copywriter.md",
  viggo: "creative/viggo-creative-director.md",
  sigge: "opposition/sigge-ai-slop-filter.md",
  maja:  "opposition/maja-head-of-marketing.md",
  nils:  "opposition/nils-the-janitor.md",
  frida: "opposition/frida-the-journalist.md",
  isak:  "opposition/isak-the-strategist.md",
  tilde: "finance/tilde-cfo-client.md",
  otto:  "finance/otto-account-director.md",
  ebbe:  "pr/ebbe-earned-media-strategist.md",
  lova:  "pr/lova-social-influencer.md",
  felix: "pr/felix-experience-director.md",
  alba:  "output/alba-packager.md",
};

function loadVariables(): Variables {
  const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
  return JSON.parse(raw) as Variables;
}

function substituteVariables(template: string, vars: Variables): string {
  const flat: Record<string, string> = {
    "agency.name":                    vars.agency.name,
    "agency.positioning":             vars.agency.positioning,
    "agency.language":                vars.agency.language,
    "agency.tone":                    vars.agency.tone,
    "pipeline.max_ideas_per_round":   String(vars.pipeline.max_ideas_per_round),
    "pipeline.opposition_rounds":     String(vars.pipeline.opposition_rounds),
    "pipeline.output_format":         vars.pipeline.output_format,
    "agents.model":                   vars.agents.model,
    "agents.temperature_creative":    String(vars.agents.temperature_creative),
    "agents.temperature_analytical":  String(vars.agents.temperature_analytical),
  };

  return Object.entries(flat).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    template
  );
}

// Cache så filer bara läses en gång per serverstart
const promptCache = new Map<AgentKey, string>();

/**
 * Returnerar systemprompten för given agent med alla variabler substituerade.
 * Cachas i minnet — inga diskläsningar i prod efter cold start.
 */
export function loadAgentPrompt(key: AgentKey): string {
  if (promptCache.has(key)) {
    return promptCache.get(key)!;
  }

  const filePath = AGENT_FILES[key];
  if (!filePath) {
    throw new Error(`Okänd agent-nyckel: "${key}"`);
  }

  const fullPath = path.join(AGENTS_ROOT, filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Agentfil saknas: ${fullPath}`);
  }

  const raw = fs.readFileSync(fullPath, "utf-8");
  const vars = loadVariables();
  const prompt = substituteVariables(raw, vars);

  promptCache.set(key, prompt);
  return prompt;
}

/**
 * Laddar alla agentprompts på en gång — användbart vid serverstart
 * för att fånga saknade filer tidigt.
 */
export function preloadAllAgents(): void {
  for (const key of Object.keys(AGENT_FILES) as AgentKey[]) {
    loadAgentPrompt(key);
  }
}

/**
 * Returnerar temperature för given agent baserat på variables.json.
 * Kreativa agenter körs varmast, analytiska svalast.
 */
export function getTemperature(key: AgentKey): number {
  const vars = loadVariables();
  const creativeAgents: AgentKey[] = ["hugo", "tuva", "finn", "lova", "felix", "ebbe"];
  return creativeAgents.includes(key)
    ? vars.agents.temperature_creative
    : vars.agents.temperature_analytical;
}
