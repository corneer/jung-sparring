// Client profile
export interface Client {
  id: string;
  name: string;
  industry: string;
  competitors: string[];
  core_questions: string[];
  created_at: string;
}

// A pipeline run
export type RunStatus =
  | "pending"
  | "researching"
  | "planning"
  | "creating"
  | "evaluating"
  | "financing"
  | "pr-ing"
  | "packaging"
  | "done"
  | "error";

export interface Run {
  id: string;
  client_id: string;
  topic: string;
  status: RunStatus;
  created_at: string;
}

// Signal from Finn
export interface Signal {
  id: string;
  run_id: string;
  content: string;
  sources: string[];
  approved: boolean | null; // null = pending review
  created_at: string;
}

// Insight from Nora
export interface Insight {
  id: string;
  run_id: string;
  content: string;
  reasoning: string; // why now, why relevant
  approved: boolean | null;
  created_at: string;
}

// Idea from Hugo + Tuva
export interface Idea {
  id: string;
  run_id: string;
  content: string;
  created_at: string;
}

// Evaluation from opposition agents
export interface Evaluation {
  id: string;
  idea_id: string;
  filter_score: number; // 0-10, higher = less generic
  filter_reasoning: string;
  opponent_challenge: string;
  survived: boolean;
}

// Finance evaluation from Tilde + Otto
export interface FinanceEvaluation {
  id: string;
  run_id: string;
  tilde_output: string;
  otto_output: string;
  created_at: string;
}

// PR evaluation from Ebbe + Lova + Felix
export interface PrEvaluation {
  id: string;
  run_id: string;
  ebbe_output: string;
  lova_output: string;
  felix_output: string;
  created_at: string;
}

// Final Figma-ready brief from Alba
export interface Brief {
  id: string;
  run_id: string;
  content: string;
  created_at: string;
}

// All 18 named agents
export type AgentKey =
  | "axel" | "saga"                                    // Orchestrators
  | "finn" | "nora"                                    // Research
  | "hugo" | "tuva" | "viggo"                         // Creative
  | "sigge" | "maja" | "nils" | "frida" | "isak"      // Opposition
  | "tilde" | "otto"                                   // Finance
  | "ebbe" | "lova" | "felix"                         // PR
  | "alba";                                            // Output

// Streaming agent role (for SSE chunks)
export type AgentRole =
  | "finn" | "nora" | "axel"
  | "saga" | "hugo" | "tuva" | "viggo"
  | "sigge" | "maja" | "nils" | "frida" | "isak"
  | "tilde" | "otto"
  | "ebbe" | "lova" | "felix"
  | "alba";

export interface StreamChunk {
  role: AgentRole;
  type: "delta" | "done" | "error";
  content?: string;
  error?: string;
}

// API request/response shapes
export interface CreateRunRequest {
  client_id: string;
  topic: string;
}

export interface ApproveSignalsRequest {
  signal_ids: string[];
}

export interface ApproveInsightsRequest {
  insight_ids: string[];
}

export interface ApproveIdeasRequest {
  idea_ids: string[];
}
