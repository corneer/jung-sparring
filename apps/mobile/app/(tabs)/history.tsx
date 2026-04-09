import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { getRuns } from "@/lib/api";
import type { Run } from "@jung/types";

const STATUS_LABELS: Record<string, string> = {
  pending: "Väntar",
  researching: "Researcher kör...",
  planning: "Planner kör...",
  creating: "Creative kör...",
  evaluating: "Utvärderar...",
  done: "Klar",
  error: "Fel",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "#555",
  researching: "#3b82f6",
  planning: "#8b5cf6",
  creating: "#ec4899",
  evaluating: "#f59e0b",
  done: "#22c55e",
  error: "#ef4444",
};

export default function HistoryScreen() {
  const router = useRouter();
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRuns()
      .then(setRuns)
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={runs}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListEmptyComponent={
            <Text style={styles.empty}>Inga körningar ännu.</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/runs/${item.id}`)}
            >
              <View style={styles.cardRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.topic}
                </Text>
                <View style={[styles.badge, { backgroundColor: STATUS_COLOR[item.status] + "22" }]}>
                  <Text style={[styles.badgeText, { color: STATUS_COLOR[item.status] }]}>
                    {STATUS_LABELS[item.status] ?? item.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardDate}>
                {new Date(item.created_at).toLocaleDateString("sv-SE", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  empty: { color: "#555", textAlign: "center", marginTop: 40 },
  card: {
    backgroundColor: "#141414",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#222",
  },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "600", flex: 1, marginRight: 8 },
  cardDate: { color: "#555", fontSize: 12, marginTop: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: "600" },
});
