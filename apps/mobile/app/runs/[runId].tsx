import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { streamAgent, approveSignals, approveInsights, getSignals, getInsights } from "@/lib/api";
import type { StreamChunk } from "@jung/types";

type Stage = "researcher" | "planner" | "creative" | "evaluate" | "done";

interface AgentOutput {
  role: string;
  text: string;
  done: boolean;
}

const STAGE_LABELS: Record<Stage, string> = {
  researcher: "Researcher",
  planner: "Planner",
  creative: "Creative",
  evaluate: "Filter + Opponent",
  done: "Klart",
};

const STAGE_COLOR: Record<Stage, string> = {
  researcher: "#3b82f6",
  planner: "#8b5cf6",
  creative: "#ec4899",
  evaluate: "#f59e0b",
  done: "#22c55e",
};

export default function RunScreen() {
  const { runId } = useLocalSearchParams<{ runId: string }>();
  const scrollRef = useRef<ScrollView>(null);

  const [currentStage, setCurrentStage] = useState<Stage>("researcher");
  const [outputs, setOutputs] = useState<Partial<Record<Stage, AgentOutput[]>>>({});
  const [streaming, setStreaming] = useState(false);
  const [waitingApproval, setWaitingApproval] = useState(false);

  const appendOutput = (stage: Stage, role: string, delta: string) => {
    setOutputs((prev) => {
      const existing = prev[stage] ?? [];
      const last = existing[existing.length - 1];
      if (last && last.role === role && !last.done) {
        return {
          ...prev,
          [stage]: [...existing.slice(0, -1), { ...last, text: last.text + delta }],
        };
      }
      return { ...prev, [stage]: [...existing, { role, text: delta, done: false }] };
    });
    scrollRef.current?.scrollToEnd({ animated: true });
  };

  const markDone = (stage: Stage, role: string) => {
    setOutputs((prev) => {
      const existing = prev[stage] ?? [];
      return {
        ...prev,
        [stage]: existing.map((o) =>
          o.role === role ? { ...o, done: true } : o
        ),
      };
    });
  };

  const runStage = async (stage: Stage) => {
    setStreaming(true);
    setWaitingApproval(false);

    const agentEndpoint =
      stage === "evaluate" ? "evaluate" : stage;

    await streamAgent(
      runId,
      agentEndpoint as "researcher" | "planner" | "creative" | "evaluate",
      (chunk: StreamChunk) => {
        appendOutput(stage, chunk.role, chunk.content ?? "");
      },
      () => {
        markDone(stage, stage === "evaluate" ? "filter" : stage);
        setStreaming(false);
        if (stage === "researcher" || stage === "planner") {
          setWaitingApproval(true);
        } else if (stage === "creative") {
          setWaitingApproval(true);
        } else {
          setCurrentStage("done");
        }
      },
      (err) => {
        setStreaming(false);
        Alert.alert("Fel", err);
      }
    );
  };

  // Auto-start researcher on mount
  useEffect(() => {
    runStage("researcher");
  }, []);

  const handleApproveAll = async () => {
    try {
      if (currentStage === "researcher") {
        const signals = await getSignals(runId);
        await approveSignals(runId, signals.map((s) => s.id), true);
        setCurrentStage("planner");
        await runStage("planner");
      } else if (currentStage === "planner") {
        const insights = await getInsights(runId);
        await approveInsights(runId, insights.map((i) => i.id), true);
        setCurrentStage("creative");
        await runStage("creative");
      } else if (currentStage === "creative") {
        setCurrentStage("evaluate");
        await runStage("evaluate");
      }
    } catch {
      Alert.alert("Fel", "Kunde inte fortsätta.");
    }
  };

  const stages: Stage[] = ["researcher", "planner", "creative", "evaluate"];

  return (
    <View style={styles.container}>
      {/* Stage pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stagesRow}>
        {stages.map((s) => {
          const idx = stages.indexOf(s);
          const currentIdx = stages.indexOf(currentStage);
          const isActive = s === currentStage;
          const isDone = idx < currentIdx || currentStage === "done";
          return (
            <View
              key={s}
              style={[
                styles.stagePill,
                isActive && { borderColor: STAGE_COLOR[s] },
                isDone && { opacity: 0.4 },
              ]}
            >
              <Text style={[styles.stagePillText, isActive && { color: STAGE_COLOR[s] }]}>
                {STAGE_LABELS[s]}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Output area */}
      <ScrollView
        ref={scrollRef}
        style={styles.outputScroll}
        contentContainerStyle={{ padding: 16, gap: 16 }}
      >
        {stages.map((stage) => {
          const agentOutputs = outputs[stage];
          if (!agentOutputs || agentOutputs.length === 0) return null;
          return (
            <View key={stage}>
              <Text style={[styles.stageHeader, { color: STAGE_COLOR[stage] }]}>
                {STAGE_LABELS[stage]}
              </Text>
              {agentOutputs.map((o, i) => (
                <View key={i} style={styles.outputBlock}>
                  <Text style={styles.outputText}>{o.text}</Text>
                  {!o.done && <ActivityIndicator size="small" color={STAGE_COLOR[stage]} style={{ marginTop: 8 }} />}
                </View>
              ))}
            </View>
          );
        })}

        {currentStage === "done" && (
          <View style={styles.doneBlock}>
            <Text style={styles.doneText}>Teamet är klart.</Text>
            <Text style={styles.doneSubtext}>
              Granska resultaten ovan. Det som överlevde filter och opponent är klart att paketera.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Action bar */}
      {waitingApproval && !streaming && currentStage !== "done" && (
        <View style={styles.actionBar}>
          <Text style={styles.actionLabel}>
            {currentStage === "researcher"
              ? "Godkänn signalerna och kör Planner?"
              : currentStage === "planner"
              ? "Godkänn insikterna och kör Creative?"
              : "Kör Filter + Opponent?"}
          </Text>
          <TouchableOpacity style={styles.approveBtn} onPress={handleApproveAll}>
            <Text style={styles.approveBtnText}>Godkänn &amp; fortsätt →</Text>
          </TouchableOpacity>
        </View>
      )}

      {streaming && (
        <View style={styles.streamingBar}>
          <ActivityIndicator color="#fff" size="small" />
          <Text style={styles.streamingText}>
            {STAGE_LABELS[currentStage]} arbetar...
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  stagesRow: { flexGrow: 0, paddingHorizontal: 12, paddingVertical: 10 },
  stagePill: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
  },
  stagePillText: { color: "#555", fontSize: 13, fontWeight: "500" },
  outputScroll: { flex: 1 },
  stageHeader: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", marginBottom: 8 },
  outputBlock: {
    backgroundColor: "#111",
    borderRadius: 10,
    padding: 14,
    borderLeftWidth: 2,
    borderLeftColor: "#222",
  },
  outputText: { color: "#ddd", fontSize: 14, lineHeight: 22 },
  doneBlock: {
    alignItems: "center",
    padding: 24,
    gap: 8,
  },
  doneText: { color: "#22c55e", fontSize: 20, fontWeight: "700" },
  doneSubtext: { color: "#555", textAlign: "center", fontSize: 14, lineHeight: 20 },
  actionBar: {
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
    padding: 16,
    gap: 10,
    backgroundColor: "#0d0d0d",
  },
  actionLabel: { color: "#888", fontSize: 13 },
  approveBtn: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  approveBtnText: { color: "#000", fontWeight: "600", fontSize: 15 },
  streamingBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
  },
  streamingText: { color: "#555", fontSize: 13 },
});
