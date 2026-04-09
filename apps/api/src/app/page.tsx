export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "monospace" }}>
      <h1>Jung Sparring API</h1>
      <p>Available endpoints:</p>
      <ul>
        <li>GET/POST /api/clients</li>
        <li>GET/PUT/DELETE /api/clients/[id]</li>
        <li>GET/POST /api/runs</li>
        <li>POST /api/runs/[runId]/researcher (SSE)</li>
        <li>GET/PATCH /api/runs/[runId]/signals</li>
        <li>POST /api/runs/[runId]/planner (SSE)</li>
        <li>GET/PATCH /api/runs/[runId]/insights</li>
        <li>POST /api/runs/[runId]/creative (SSE)</li>
        <li>POST /api/runs/[runId]/evaluate (SSE, parallel)</li>
      </ul>
    </main>
  );
}
