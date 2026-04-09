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
  | "done"
  | "error";

export interface Run {
  id: string;
  client_id: string;
  topic: string;
  status: RunStatus;
  created_at: string;
}

// Signal from Researcher
export interface Signal {
  id: string;
  run_id: string;
  content: string;
  sources: string[];
  approved: boolean | null; // null = pending review
  created_at: string;
}

// Insight from Planner
export interface Insight {
  id: string;
  run_id: string;
  content: string;
  reasoning: string; // why now, why relevant
  approved: boolean | null;
  created_at: string;
}

// Idea from Creative
export interface Idea {
  id: string;
  run_id: string;
  content: string;
  created_at: string;
}

// Evaluation from AI-slop filter + Opponent
export interface Evaluation {
  id: string;
  idea_id: string;
  filter_score: number; // 0-10, higher = less generic
  filter_reasoning: string;
  opponent_challenge: string;
  survived: boolean;
}

// Streaming chunk types sent from API → client
export type AgentRole =
  | "researcher"
  | "planner"
  | "creative"
  | "filter"
  | "opponent";

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
