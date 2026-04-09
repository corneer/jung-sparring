"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import styles from "./page.module.css";

function NewRunForm() {
  const router = useRouter();
  const params = useSearchParams();
  const clientId = params.get("client_id") ?? "";
  const clientName = params.get("client_name") ?? "";
  const [topic, setTopic] = useState("");
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setCreating(true);
    const res = await fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, topic: topic.trim() }),
    });
    const run = await res.json();
    router.push(`/runs/${run.id}`);
  };

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <a href="/" className={styles.back}>← Tillbaka</a>
        <p className={styles.clientLabel}>Klient</p>
        <h1 className={styles.clientName}>{clientName}</h1>
      </div>
      <form onSubmit={handleSubmit} className={styles.form}>
        <label className={styles.label}>Ämne / Brief</label>
        <textarea
          className={styles.textarea}
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder={"T.ex. Lansering av ny elbil Q3 2025\n\nEller\n\nHållbarhetskommunikation inför Earth Day"}
          rows={6}
          autoFocus
          required
        />
        <p className={styles.hint}>Research · Kreativt · Opposition · Finans · PR · Brief</p>
        <button type="submit" className={styles.btn} disabled={creating}>
          {creating ? "Startar..." : "Starta uppdrag"}
        </button>
      </form>
    </main>
  );
}

export default function NewRunPage() {
  return <Suspense><NewRunForm /></Suspense>;
}
