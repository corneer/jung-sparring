"use client";
import { useEffect, useRef, useState, use, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import styles from "./page.module.css";

type Stage = "research" | "creative" | "opposition" | "finance" | "pr" | "package" | "done";

const STAGES: Stage[] = ["research", "creative", "opposition", "finance", "pr", "package"];

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

const STAGE_ENDPOINTS: Record<Stage, string[]> = {
  research: ["researcher", "planner"],
  creative: ["creative"],
  opposition: ["evaluate"],
  finance: ["finance"],
  pr: ["pr"],
  package: ["package"],
  done: [],
};

interface Output { role: string; text: string; done: boolean; }
interface ReviewItem { id: string; content: string; selected: boolean; }

export default function RunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = use(params);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const [stage, setStage] = useState<Stage>("research");
  const [outputs, setOutputs] = useState<Partial<Record<Stage, Output[]>>>({});
  const [streaming, setStreaming] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [reviewType, setReviewType] = useState<"insights" | "ideas">("insights");
  const [briefContent, setBriefContent] = useState<string>("");

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, []);

  useEffect(() => { scrollToBottom(); }, [outputs, scrollToBottom]);

  const append = (s: Stage, role: string, delta: string) => {
    setOutputs(prev => {
      const list = prev[s] ?? [];
      const last = list[list.length - 1];
      if (last && last.role === role && !last.done) {
        return { ...prev, [s]: [...list.slice(0, -1), { ...last, text: last.text + delta }] };
      }
      return { ...prev, [s]: [...list, { role, text: delta, done: false }] };
    });
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
    setReviewing(false);
    scrollToBottom();
    const endpoints = STAGE_ENDPOINTS[s];
    for (let i = 0; i < endpoints.length; i++) {
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
      await openReview(s);
    } else {
      const nextIdx = STAGES.indexOf(s) + 1;
      if (nextIdx < STAGES.length) {
        const next = STAGES[nextIdx];
        setStage(next);
        await runStage(next);
      } else {
        setStage("done");
        // Fetch brief
        const res = await fetch(`/api/runs/${runId}/briefs`);
        if (res.ok) {
          const briefs = await res.json();
          if (briefs?.[0]?.content) setBriefContent(briefs[0].content);
        }
      }
    }
  };

  const openReview = async (s: Stage) => {
    if (s === "research") {
      const res = await fetch(`/api/runs/${runId}/insights`);
      const items = await res.json();
      setReviewItems((items ?? []).map((i: { id: string; content: string }) => ({ id: i.id, content: i.content, selected: true })));
      setReviewType("insights");
    } else if (s === "creative" || s === "opposition") {
      const res = await fetch(`/api/runs/${runId}/ideas`);
      const items = await res.json();
      setReviewItems((items ?? []).map((i: { id: string; content: string }) => ({ id: i.id, content: i.content, selected: true })));
      setReviewType("ideas");
    }
    setReviewing(true);
    scrollToBottom();
  };

  const toggleItem = (id: string) =>
    setReviewItems(prev => prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item));

  const handleApprove = async () => {
    setReviewing(false);
    const selectedIds = reviewItems.filter(i => i.selected).map(i => i.id);
    if (reviewType === "insights") {
      await fetch(`/api/runs/${runId}/insights`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insight_ids: selectedIds, approved: true }),
      });
      // Reject unselected
      const rejectedIds = reviewItems.filter(i => !i.selected).map(i => i.id);
      if (rejectedIds.length) {
        await fetch(`/api/runs/${runId}/insights`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ insight_ids: rejectedIds, approved: false }),
        });
      }
    }
    const next = STAGES[STAGES.indexOf(stage) + 1];
    setStage(next);
    await runStage(next);
  };

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
        {STAGES.map((s, idx) => (
          <div key={s} className={styles.stagePill} style={{
            borderColor: s === stage ? COLORS[s] : "var(--border)",
            color: s === stage ? COLORS[s] : idx < stageIdx ? "var(--dim)" : "var(--muted)",
          }}>
            {LABELS[s]}
          </div>
        ))}
        {stage === "done" && (
          <div className={styles.stagePill} style={{ borderColor: COLORS.done, color: COLORS.done }}>Klart ✓</div>
        )}
      </div>

      {/* Main output */}
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

        {/* Brief view */}
        {stage === "done" && briefContent && (
          <div className={styles.briefBlock}>
            <div className={styles.briefHeader}>
              <span className={styles.briefTitle}>Figma-ready Brief</span>
              <button
                className={styles.copyBtn}
                onClick={() => navigator.clipboard.writeText(briefContent)}
              >
                Kopiera
              </button>
            </div>
            <div className={styles.briefContent}>
              <ReactMarkdown>{briefContent}</ReactMarkdown>
            </div>
          </div>
        )}

        {stage === "done" && !briefContent && (
          <div className={styles.doneBlock}>
            <p className={styles.doneTitle}>Uppdraget är klart.</p>
            <p className={styles.doneSub}>Alba paketerar briefen...</p>
            <a href="/" className={styles.homeBtn}>← Nytt uppdrag</a>
          </div>
        )}
      </div>

      {/* Review panel */}
      {reviewing && !streaming && (
        <div className={styles.reviewPanel}>
          <div className={styles.reviewHeader}>
            <p className={styles.reviewTitle}>
              {reviewType === "insights" ? "Välj insikter att ta med" : "Välj idéer att ta vidare"}
            </p>
            <p className={styles.reviewSub}>
              {reviewItems.filter(i => i.selected).length} av {reviewItems.length} valda
            </p>
          </div>
          <div className={styles.reviewList}>
            {reviewItems.map(item => (
              <button
                key={item.id}
                className={`${styles.reviewItem} ${item.selected ? styles.reviewItemSelected : ""}`}
                onClick={() => toggleItem(item.id)}
              >
                <span className={styles.reviewCheck}>{item.selected ? "✓" : "○"}</span>
                <div className={styles.reviewText}>
                  <ReactMarkdown>{item.content.slice(0, 400) + (item.content.length > 400 ? "\n\n…" : "")}</ReactMarkdown>
                </div>
              </button>
            ))}
          </div>
          <div className={styles.reviewFooter}>
            <button
              className={styles.approveBtn}
              onClick={handleApprove}
              disabled={reviewItems.filter(i => i.selected).length === 0}
            >
              Godkänn valda &amp; fortsätt →
            </button>
          </div>
        </div>
      )}

      {/* Streaming indicator */}
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
