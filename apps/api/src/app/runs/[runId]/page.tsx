"use client";
import { useEffect, useRef, useState, use, useCallback } from "react";
import styles from "./page.module.css";

type Stage = "research" | "creative" | "opposition" | "finance" | "pr" | "package" | "done";

const STAGES: Stage[] = ["research", "creative", "opposition", "finance", "pr", "package"];

// Human-in-the-loop: approve after these stages before continuing
const APPROVAL_STAGES: Stage[] = ["research", "creative", "opposition"];

const LABELS: Record<Stage, string> = {
  research: "Research",
  creative: "Kreativt",
  opposition: "Opposition",
  finance: "Finans",
  pr: "PR",
  package: "Brief",
  done: "Klart",
};

const AGENT_LABELS: Record<Stage, string> = {
  research: "Finn · Nora · Axel",
  creative: "Saga · Hugo · Tuva · Viggo",
  opposition: "Sigge · Maja · Nils · Frida · Isak",
  finance: "Tilde · Otto",
  pr: "Ebbe · Lova · Felix",
  package: "Alba",
  done: "",
};

const COLORS: Record<Stage, string> = {
  research: "#3b82f6",
  creative: "#ec4899",
  opposition: "#f59e0b",
  finance: "#10b981",
  pr: "#8b5cf6",
  package: "#06b6d4",
  done: "#22c55e",
};

// Maps each stage to its API endpoint(s)
// Research stage runs researcher first, then planner; we treat them as one phase
const STAGE_ENDPOINTS: Record<Stage, string[]> = {
  research: ["researcher", "planner"],
  creative: ["creative"],
  opposition: ["evaluate"],
  finance: ["finance"],
  pr: ["pr"],
  package: ["package"],
  done: [],
};

interface Output {
  role: string;
  text: string;
  done: boolean;
}

const APPROVAL_LABELS: Record<string, string> = {
  research: "Godkänn signaler & insikter → kör kreativt team",
  creative: "Godkänn kreativa koncept → kör opposition",
  opposition: "Godkänn opposition → kör finans & PR",
};

export default function RunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = use(params);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false); // guard against React Strict Mode double-invoke
  const [stage, setStage] = useState<Stage>("research");
  const [subStep, setSubStep] = useState(0);
  const [outputs, setOutputs] = useState<Partial<Record<Stage, Output[]>>>({});
  const [streaming, setStreaming] = useState(false);
  const [waitingApproval, setWaitingApproval] = useState(false);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, []);

  const append = (s: Stage, role: string, delta: string) => {
    setOutputs(prev => {
      const list = prev[s] ?? [];
      const last = list[list.length - 1];
      if (last && last.role === role && !last.done) {
        return { ...prev, [s]: [...list.slice(0, -1), { ...last, text: last.text + delta }] };
      }
      return { ...prev, [s]: [...list, { role, text: delta, done: false }] };
    });
    scrollToBottom();
  };

  const markDone = (s: Stage, role: string) =>
    setOutputs(prev => ({
      ...prev,
      [s]: (prev[s] ?? []).map(o => o.role === role ? { ...o, done: true } : o),
    }));

  const streamEndpoint = async (s: Stage, endpoint: string) => {
    const res = await fetch(`/api/runs/${runId}/${endpoint}`, { method: "POST" });
    if (!res.ok || !res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const chunk = JSON.parse(line.slice(6));
          if (chunk.type === "delta") append(s, chunk.role, chunk.content ?? "");
          if (chunk.type === "done") markDone(s, chunk.role);
        } catch { /* ignore */ }
      }
    }
  };

  const runStage = async (s: Stage) => {
    setStreaming(true);
    setWaitingApproval(false);
    setSubStep(0);
    scrollToBottom();

    const endpoints = STAGE_ENDPOINTS[s];
    for (let i = 0; i < endpoints.length; i++) {
      setSubStep(i);
      // For research: approve signals between researcher and planner
      if (s === "research" && i === 1) {
        // Auto-approve all signals before running planner
        const res = await fetch(`/api/runs/${runId}/signals`);
        const signals = await res.json();
        if (signals?.length) {
          await fetch(`/api/runs/${runId}/signals`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ signal_ids: signals.map((sig: { id: string }) => sig.id), approved: true }),
          });
        }
      }
      await streamEndpoint(s, endpoints[i]);
    }

    setStreaming(false);

    if (APPROVAL_STAGES.includes(s)) {
      setWaitingApproval(true);
    } else {
      // Auto-advance to next stage
      const nextIdx = STAGES.indexOf(s) + 1;
      if (nextIdx < STAGES.length) {
        const nextStage = STAGES[nextIdx];
        setStage(nextStage);
        await runStage(nextStage);
      } else {
        setStage("done");
      }
    }
  };

  const handleApprove = async () => {
    if (stage === "research") {
      // Approve insights
      const res = await fetch(`/api/runs/${runId}/insights`);
      const insights = await res.json();
      if (insights?.length) {
        await fetch(`/api/runs/${runId}/insights`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ insight_ids: insights.map((i: { id: string }) => i.id), approved: true }),
        });
      }
      setStage("creative");
      await runStage("creative");
    } else if (stage === "creative") {
      setStage("opposition");
      await runStage("opposition");
    } else if (stage === "opposition") {
      setStage("finance");
      await runStage("finance");
    }
  };

  // Scroll to bottom whenever outputs change
  useEffect(() => {
    scrollToBottom();
  }, [outputs, scrollToBottom]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    runStage("research");
  }, []);

  const stageIdx = STAGES.indexOf(stage);

  return (
    <div className={styles.layout}>
      {/* Stage bar */}
      <div className={styles.stageBar}>
        {STAGES.map((s, idx) => {
          const isActive = s === stage;
          const isPast = idx < stageIdx;
          return (
            <div
              key={s}
              className={styles.stagePill}
              style={{
                borderColor: isActive ? COLORS[s] : "var(--border)",
                color: isActive ? COLORS[s] : isPast ? "var(--dim)" : "var(--muted)",
              }}
            >
              {LABELS[s]}
            </div>
          );
        })}
        {stage === "done" && (
          <div className={styles.stagePill} style={{ borderColor: COLORS.done, color: COLORS.done }}>
            Klart ✓
          </div>
        )}
      </div>

      {/* Output */}
      <div className={styles.output} ref={scrollRef}>
        {STAGES.map(s => {
          const outs = outputs[s];
          if (!outs?.length) return null;
          return (
            <div key={s} className={styles.stageBlock}>
              <div className={styles.stageMeta}>
                <span className={styles.stageLabel} style={{ color: COLORS[s] }}>{LABELS[s]}</span>
                <span className={styles.agentNames}>{AGENT_LABELS[s]}</span>
              </div>
              {outs.map((o, i) => (
                <div key={i} className={styles.bubble}>
                  <span className={styles.rolePill}>{o.role}</span>
                  <pre className={styles.text}>{o.text}</pre>
                  {!o.done && <span className={styles.cursor} />}
                </div>
              ))}
            </div>
          );
        })}
        {stage === "done" && (
          <div className={styles.doneBlock}>
            <p className={styles.doneTitle}>Uppdraget är paketerat.</p>
            <p className={styles.doneSub}>Alba har satt ihop en Figma-ready brief baserat på hela pipelines output.</p>
            <a href="/" className={styles.homeBtn}>← Nytt uppdrag</a>
          </div>
        )}
      </div>

      {/* Action bar */}
      {waitingApproval && !streaming && (
        <div className={styles.actionBar}>
          <div>
            <p className={styles.actionLabel}>{APPROVAL_LABELS[stage] ?? "Fortsätt"}</p>
            <p className={styles.actionSub}>Granska ovan innan du godkänner.</p>
          </div>
          <button className={styles.approveBtn} onClick={handleApprove}>
            Godkänn &amp; fortsätt →
          </button>
        </div>
      )}
      {streaming && (
        <div className={styles.streamingBar}>
          <span className={styles.dot} style={{ background: COLORS[stage] }} />
          <span>
            <strong style={{ color: COLORS[stage] }}>{LABELS[stage]}</strong>
            {" "}<span style={{ color: "var(--muted)" }}>— {AGENT_LABELS[stage]} arbetar...</span>
          </span>
        </div>
      )}
    </div>
  );
}
