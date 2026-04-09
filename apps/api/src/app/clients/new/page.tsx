"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function NewClientPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [coreQuestions, setCoreQuestions] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !industry.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          industry: industry.trim(),
          competitors: competitors.split("\n").map(s => s.trim()).filter(Boolean),
          core_questions: coreQuestions.split("\n").map(s => s.trim()).filter(Boolean),
        }),
      });
      router.push("/");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <a href="/" className={styles.back}>← Tillbaka</a>
        <h1 className={styles.title}>Nytt uppdrag</h1>
      </div>
      <form onSubmit={handleSubmit} className={styles.form}>
        <label className={styles.label}>Namn *</label>
        <input className={styles.input} value={name} onChange={e => setName(e.target.value)} placeholder="T.ex. Volvo Cars" required />

        <label className={styles.label}>Bransch *</label>
        <input className={styles.input} value={industry} onChange={e => setIndustry(e.target.value)} placeholder="T.ex. Fordon, Retail, Tech" required />

        <label className={styles.label}>Konkurrenter (en per rad)</label>
        <textarea className={styles.textarea} value={competitors} onChange={e => setCompetitors(e.target.value)} placeholder={"BMW\nMercedes\nTesla"} rows={4} />

        <label className={styles.label}>Kärnfrågor (en per rad)</label>
        <textarea className={styles.textarea} value={coreQuestions} onChange={e => setCoreQuestions(e.target.value)} placeholder={"Hur når vi unga bilköpare?\nHur kommunicerar vi hållbarhet?"} rows={4} />

        <button type="submit" className={styles.btn} disabled={saving}>
          {saving ? "Sparar..." : "Skapa uppdrag"}
        </button>
      </form>
    </main>
  );
}
