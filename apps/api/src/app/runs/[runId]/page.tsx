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
  creative: "Hugo · Tuva · Viggo",
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

type StageStatus = "pending" | "running" | "review" | "done";

interface Output { role: string; text: string; done: boolean; }
interface ReviewItem { id: string; content: string; selected: boolean; }

export default function RunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = use(params);
  const scrollRefs = useRef<Partial<Record<Stage, HTMLDivElement | null>>>({});
  const startedRef = useRef(false);

  const [activeTab, setActiveTab] = useState<Stage>("research");
  const [pipelineStage, setPipelineStage] = useState<Stage>("research");
  const [stageStatuses, setStageStatuses] = useState<Partial<Record<Stage, StageStatus>>>({});
  const [outputs, setOutputs] = useState<Partial<Record<Stage, Output[]>>>({});
  const [streaming, setStreaming] = useState(false);
  const [reviewStage, setReviewStage] = useState<Stage | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [reviewType, setReviewType] = useState<"insights" | "ideas">("insights");
  const [briefContent, setBriefContent] = useState<string>("");
  const [feedbacks, setFeedbacks] = useState<Partial<Record<Stage, string>>>({});

  const scrollToBottom = useCallback((s: Stage) => {
    requestAnimationFrame(() => {
      const el = scrollRefs.current[s];
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  useEffect(() => { scrollToBottom(activeTab); }, [outputs, activeTab, scrollToBottom]);

  const setStatus = (s: Stage, status: StageStatus) =>
    setStageStatuses(prev => ({ ...prev, [s]: status }));

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

  const streamEndpoint = async (s: Stage, endpoint: string, body?: Record<string, unknown>) => {
    const res = await fetch(`/api/runs/${runId}/${endpoint}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
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

  const runStage = async (s: Stage, body?: Record<string, unknown>) => {
    setStreaming(true);
    setPipelineStage(s);
    setActiveTab(s);
    setStatus(s, "running");
    setReviewStage(null);

    const endpoints = STAGE_ENDPOINTS[s];
    for (let i = 0; i < endpoints.length; i++) {
      if (s === "research" && i === 1) {
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
      const endpointBody = i === endpoints.length - 1 ? body : undefined;
      await streamEndpoint(s, endpoints[i], endpointBody);
    }
    setStreaming(false);

    if (APPROVAL_STAGES.includes(s)) {
      setStatus(s, "review");
      await openReview(s);
    } else {
      setStatus(s, "done");
      const nextIdx = STAGES.indexOf(s) + 1;
      if (nextIdx < STAGES.length) {
        const next = STAGES[nextIdx];
        await runStage(next);
      } else {
        setPipelineStage("done");
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
    setReviewStage(s);
  };

  const toggleItem = (id: string) =>
    setReviewItems(prev => prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item));

  const handleApprove = async (s: Stage) => {
    const selectedIds = reviewItems.filter(i => i.selected).map(i => i.id);
    const feedback = (feedbacks[s] ?? "").trim();
    setFeedbacks(prev => ({ ...prev, [s]: "" }));
    setReviewStage(null);
    setStatus(s, "done");

    if (reviewType === "insights") {
      await fetch(`/api/runs/${runId}/insights`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insight_ids: selectedIds, approved: true }),
      });
      const rejectedIds = reviewItems.filter(i => !i.selected).map(i => i.id);
      if (rejectedIds.length) {
        await fetch(`/api/runs/${runId}/insights`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ insight_ids: rejectedIds, approved: false }),
        });
      }
    }

    const next = STAGES[STAGES.indexOf(s) + 1];
    await runStage(next, feedback ? { human_direction: feedback } : undefined);
  };

  const handleRedo = async (s: Stage) => {
    const feedback = (feedbacks[s] ?? "").trim();
    setFeedbacks(prev => ({ ...prev, [s]: "" }));
    setReviewStage(null);
    setOutputs(prev => ({ ...prev, [s]: [] }));
    await runStage(s, { human_direction: feedback || undefined, redo: true });
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    runStage("research");
  }, []);

  const visibleTabs = pipelineStage === "done"
    ? [...STAGES, "done" as Stage]
    : STAGES.slice(0, STAGES.indexOf(pipelineStage) + 1);

  const isActiveReview = reviewStage === activeTab;
  const activeColor = COLORS[activeTab] ?? "#888";

  return (
    <div className={styles.layout}>
      {/* Tab bar */}
      <div className={styles.tabBar}>
        {visibleTabs.map(s => {
          const status = s === "done" ? "done" : stageStatuses[s];
          const isActive = s === activeTab;
          const isRunning = status === "running";
          const isReview = status === "review";
          return (
            <button
              key={s}
              className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
              style={isActive ? { borderBottomColor: COLORS[s], color: COLORS[s] } : undefined}
              onClick={() => setActiveTab(s)}
            >
              {LABELS[s]}
              {isRunning && <span className={styles.tabDot} style={{ background: COLORS[s] }} />}
              {isReview && <span className={styles.tabReviewBadge}>granskning</span>}
            </button>
          );
        })}
        <a href="/" className={styles.newBtn}>+ Nytt</a>
      </div>

      {/* Tab content */}
      <div
        className={styles.tabContent}
        ref={el => { scrollRefs.current[activeTab] = el; }}
      >
        {activeTab === "done" && pipelineStage === "done" ? (
          briefContent ? (
            <div className={styles.briefBlock}>
              <div className={styles.briefHeader}>
                <span className={styles.briefTitle}>Brief</span>
                <button className={styles.copyBtn} onClick={() => navigator.clipboard.writeText(briefContent)}>
                  Kopiera
                </button>
              </div>
              <div className={styles.briefContent}>
                <ReactMarkdown>{briefContent}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className={styles.doneBlock}>
              <p className={styles.doneTitle}>Uppdraget är klart.</p>
              <p className={styles.doneSub}>Alba paketerar briefen...</p>
            </div>
          )
        ) : (
          <>
            {/* Stage outputs */}
            <div className={styles.stageOutputs}>
              {(outputs[activeTab] ?? []).map((o, i) => (
                <div key={i} className={styles.bubble}>
                  <span className={styles.rolePill} style={{ color: COLORS[activeTab] }}>{o.role}</span>
                  <pre className={styles.text}>{o.text}</pre>
                  {!o.done && <span className={styles.cursor} />}
                </div>
              ))}
              {(outputs[activeTab] ?? []).length === 0 && stageStatuses[activeTab] !== "running" && (
                <p className={styles.emptyTab}>Inget innehåll ännu.</p>
              )}
            </div>

            {/* Inline review panel — shown when this tab is in review */}
            {isActiveReview && !streaming && (
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
                      style={item.selected ? { borderColor: `${activeColor}66` } : undefined}
                      onClick={() => toggleItem(item.id)}
                    >
                      <span className={styles.reviewCheck} style={item.selected ? { color: activeColor } : undefined}>
                        {item.selected ? "✓" : "○"}
                      </span>
                      <div className={styles.reviewText}>
                        <ReactMarkdown>{item.content.slice(0, 400) + (item.content.length > 400 ? "\n\n…" : "")}</ReactMarkdown>
                      </div>
                    </button>
                  ))}
                </div>
                <div className={styles.feedbackArea}>
                  <textarea
                    className={styles.feedbackInput}
                    placeholder={`Ge ${AGENT_LABELS[activeTab]} en ny direction... (valfritt)`}
                    value={feedbacks[activeTab] ?? ""}
                    onChange={e => setFeedbacks(prev => ({ ...prev, [activeTab]: e.target.value }))}
                    rows={2}
                  />
                  <div className={styles.reviewActions}>
                    <button className={styles.redoBtn} onClick={() => handleRedo(activeTab)}>
                      ↺ Kör om {(feedbacks[activeTab] ?? "").trim() ? "med feedback" : "steget"}
                    </button>
                    <button
                      className={styles.approveBtn}
                      onClick={() => handleApprove(activeTab)}
                      disabled={reviewItems.filter(i => i.selected).length === 0}
                    >
                      Godkänn &amp; fortsätt →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Feedback input for non-review stages (e.g. navigating to a past tab) */}
            {!isActiveReview && stageStatuses[activeTab] === "done" && !streaming && (
              <div className={styles.pastStageActions}>
                <textarea
                  className={styles.feedbackInput}
                  placeholder={`Kör om ${LABELS[activeTab]} med ny direction...`}
                  value={feedbacks[activeTab] ?? ""}
                  onChange={e => setFeedbacks(prev => ({ ...prev, [activeTab]: e.target.value }))}
                  rows={2}
                />
                <button
                  className={styles.redoBtn}
                  onClick={() => handleRedo(activeTab)}
                  disabled={streaming}
                >
                  ↺ Kör om {LABELS[activeTab]}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Streaming indicator */}
      {streaming && (
        <div className={styles.streamingBar}>
          <span className={styles.dot} style={{ background: COLORS[pipelineStage] }} />
          <span>
            <strong style={{ color: COLORS[pipelineStage] }}>{LABELS[pipelineStage]}</strong>
            {" "}<span style={{ color: "var(--muted)" }}>— {AGENT_LABELS[pipelineStage]} arbetar...</span>
          </span>
        </div>
      )}
    </div>
  );
}
