import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { createClient } from "@/lib/api";

export default function NewClientScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [coreQuestions, setCoreQuestions] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !industry.trim()) {
      Alert.alert("Obligatoriska fält", "Namn och bransch krävs.");
      return;
    }
    setSaving(true);
    try {
      await createClient({
        name: name.trim(),
        industry: industry.trim(),
        competitors: competitors.split("\n").map((s) => s.trim()).filter(Boolean),
        core_questions: coreQuestions.split("\n").map((s) => s.trim()).filter(Boolean),
      });
      router.back();
    } catch {
      Alert.alert("Fel", "Kunde inte spara klienten.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.label}>Namn *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="T.ex. Volvo Cars"
          placeholderTextColor="#444"
        />

        <Text style={styles.label}>Bransch *</Text>
        <TextInput
          style={styles.input}
          value={industry}
          onChangeText={setIndustry}
          placeholder="T.ex. Fordon, Retail, Tech"
          placeholderTextColor="#444"
        />

        <Text style={styles.label}>Konkurrenter (en per rad)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={competitors}
          onChangeText={setCompetitors}
          placeholder={"BMW\nMercedes\nTesla"}
          placeholderTextColor="#444"
          multiline
          numberOfLines={4}
        />

        <Text style={styles.label}>Kärnfrågor (en per rad)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={coreQuestions}
          onChangeText={setCoreQuestions}
          placeholder={"Hur når vi unga bilköpare?\nHur kommunicerar vi hållbarhet?"}
          placeholderTextColor="#444"
          multiline
          numberOfLines={4}
        />

        <TouchableOpacity
          style={[styles.btn, saving && styles.btnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.btnText}>{saving ? "Sparar..." : "Skapa klient"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  content: { padding: 20, gap: 8 },
  label: { color: "#aaa", fontSize: 13, marginTop: 12, marginBottom: 4 },
  input: {
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#222",
    borderRadius: 10,
    color: "#fff",
    padding: 14,
    fontSize: 15,
  },
  multiline: { height: 100, textAlignVertical: "top" },
  btn: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 24,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#000", fontSize: 16, fontWeight: "600" },
});
