import Link from "next/link";
import { supabase } from "@/lib/supabase";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <h1 className={styles.title}>Creative Sparring Team</h1>
        <Link href="/clients/new" className={styles.newBtn}>+ Nytt uppdrag</Link>
      </div>

      {!clients || clients.length === 0 ? (
        <p className={styles.empty}>Inga uppdrag än. Skapa ett för att börja.</p>
      ) : (
        <div className={styles.grid}>
          {clients.map((client) => (
            <div key={client.id} className={styles.card}>
              <div className={styles.cardBody}>
                <h2 className={styles.cardTitle}>{client.name}</h2>
                <p className={styles.cardSub}>{client.industry}</p>
                {client.competitors?.length > 0 && (
                  <p className={styles.cardMeta}>
                    Konkurrenter: {client.competitors.join(", ")}
                  </p>
                )}
              </div>
              <div className={styles.cardFooter}>
                <Link href={`/runs/new?client_id=${client.id}&client_name=${encodeURIComponent(client.name)}`} className={styles.runBtn}>
                  Starta uppdrag →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
