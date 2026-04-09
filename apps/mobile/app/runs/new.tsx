import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { createRun } from "@/lib/api";

export default function NewRunScreen() {
  const router = useRouter();
  const { client_id, client_name } = useLocalSearchParams<{
    client_id: string;
    client_name: string;
  }>();
  const [topic, setTopic] = useState("");
  const [creating, setCreating] = useState(false);

  const handleStart = async () => {
    if (!topic.trim()) {
      Alert.alert("Ange ett ämne", "Vad ska agentteamet analysera?");
      return;
    }
    setCreating(true);
    try {
      const run = await createRun(client_id, topic.trim());
      router.replace(`/runs/${run.id}`);
    } catch {
      Alert.alert("Fel", "Kunde inte skapa körningen.");
      setCreating(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.clientLabel}>Klient</Text>
        <Text style={styles.clientName}>{client_name}</Text>

        <Text style={styles.label}>Ämne / Brief</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={topic}
          onChangeText={setTopic}
          placeholder={"T.ex. Lansering av ny elbil Q3 2025\neller\nHållbarhetskommunikation inför Earth Day"}
          placeholderTextColor="#444"
          multiline
          numberOfLines={5}
          autoFocus
        />
        <Text style={styles.hint}>
          Agentteamet kör: Researcher → Planner → Creative → Filter + Opponent
        </Text>

        <TouchableOpacity
          style={[styles.btn, creating && styles.btnDisabled]}
          onPress={handleStart}
          disabled={creating}
        >
          <Text style={styles.btnText}>{creating ? "Startar..." : "Kör agentteamet"}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a", padding: 20 },
  clientLabel: { color: "#555", fontSize: 12, marginBottom: 4 },
  clientName: { color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 24 },
  label: { color: "#aaa", fontSize: 13, marginBottom: 8 },
  input: {
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#222",
    borderRadius: 10,
    color: "#fff",
    padding: 14,
    fontSize: 15,
  },
  multiline: { height: 130, textAlignVertical: "top" },
  hint: { color: "#444", fontSize: 12, marginTop: 10, lineHeight: 18 },
  btn: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 28,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: "#000", fontSize: 16, fontWeight: "600" },
});
