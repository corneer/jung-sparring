# Jung Sparring — Kontext för Claude Code

Detta dokument beskriver exakt vad som är byggt och pushat i repot.
Läs det innan du skapar eller redigerar kod.

---

## Repo-struktur

```
jung-sparring/
├── agents/                          ← System prompts för alla agenter (.md-filer)
│   ├── orchestrators/
│   │   ├── axel-research-orchestrator.md
│   │   └── saga-creative-orchestrator.md
│   ├── research/
│   │   ├── finn-signal-collector.md
│   │   └── nora-insight-builder.md
│   ├── creative/
│   │   ├── hugo-art-director.md
│   │   ├── tuva-copywriter.md
│   │   └── viggo-creative-director.md
│   ├── opposition/
│   │   ├── sigge-ai-slop-filter.md
│   │   ├── maja-head-of-marketing.md
│   │   ├── nils-the-janitor.md
│   │   ├── frida-the-journalist.md
│   │   └── isak-the-strategist.md
│   ├── finance/
│   │   ├── tilde-cfo-client.md      ← CFO på klientsidan
│   │   └── otto-account-director.md ← Account Director på Jung
│   ├── pr/
│   │   ├── ebbe-earned-media-strategist.md
│   │   ├── lova-social-influencer.md
│   │   └── felix-experience-director.md
│   └── output/
│       └── alba-packager.md         ← Packar allt till Figma-ready brief
│
├── config/
│   └── variables.json               ← Globala variabler (byrånamn, modell, temperatur)
│
├── apps/
│   ├── api/                         ← Next.js API (Mårtens kod)
│   │   └── src/
│   │       └── lib/
│   │           └── agents/
│   │               ├── loader.ts    ← NY: läser .md-filer med variabelsubstitution
│   │               ├── prompts.ts   ← Uppdaterad: exporterar agentPrompt()
│   │               └── orchestrator.ts
│   └── mobile/                      ← React Native (Expo)
│
└── packages/
    └── types/
        └── src/index.ts             ← Uppdaterad: AgentKey-typen tillagd
```

---

## Agentsystemet

### Variabelsystem
Alla `.md`-filer använder `{{nyckel}}`-syntax för dynamiska värden:

```
{{agency.name}}                  → "Jung Relations"
{{agency.positioning}}           → "Nordens mest kreativa byrå"
{{agency.language}}              → "Swedish"
{{agency.tone}}                  → "Confident, sharp, no bullshit"
{{pipeline.output_format}}       → "Figma-ready brief"
{{agents.model}}                 → "claude-sonnet-4-20250514"
{{agents.temperature_creative}}  → 1.0
{{agents.temperature_analytical}}→ 0.3
```

Alla värden definieras i `config/variables.json`.

### Pipeline-flöde
```
Brief →
  [Research]    Finn (signaler) → Nora (insikter) → Axel (koordinerar)
  [Creative]    Saga (orkestrerar) → Hugo + Tuva (idéer) → Viggo (CD-granskning)
  [Opposition]  Sigge + Maja + Nils + Frida + Isak (parallellt)
  [Finance]     Tilde (klient-CFO) + Otto (byråns account)
  [PR]          Ebbe (earned media) + Lova (social) + Felix (experience)
  [Output]      Alba → Figma-ready brief
```

---

## loader.ts — Hur man använder det

Filen `apps/api/src/lib/agents/loader.ts` läser `.md`-filerna och substituerar variabler.

```typescript
import { loadAgentPrompt, getTemperature } from "@/lib/agents/loader";
import type { AgentKey } from "@jung/types";

// Hämta systemprompten för en agent
const systemPrompt = loadAgentPrompt("tilde");   // Tilde — CFO (klientsida)
const systemPrompt = loadAgentPrompt("ebbe");    // Ebbe — Earned Media

// Hämta temperatur (creative=1.0, analytical=0.3)
const temp = getTemperature("hugo");             // → 1.0

// Ladda alla agenter vid serverstart (fångar fel tidigt)
import { preloadAllAgents } from "@/lib/agents/loader";
preloadAllAgents();
```

### Re-export via prompts.ts
```typescript
import { agentPrompt } from "@/lib/agents/prompts";
const system = agentPrompt("otto");   // Account Director
```

---

## AgentKey-typen

Definierad i `packages/types/src/index.ts`:

```typescript
export type AgentKey =
  | "axel" | "saga"                          // Orchestrators
  | "finn" | "nora"                          // Research
  | "hugo" | "tuva" | "viggo"               // Creative
  | "sigge" | "maja" | "nils" | "frida" | "isak"  // Opposition
  | "tilde" | "otto"                         // Finance
  | "ebbe" | "lova" | "felix"               // PR
  | "alba";                                  // Output
```

---

## Befintliga API-routes (Mårtens kod — rör inte utan dialog)

```
GET/POST  /api/clients
GET/PUT/DELETE /api/clients/[id]
GET/POST  /api/runs
POST      /api/runs/[runId]/researcher    (SSE)
GET/PATCH /api/runs/[runId]/signals
POST      /api/runs/[runId]/planner       (SSE)
GET/PATCH /api/runs/[runId]/insights
POST      /api/runs/[runId]/creative      (SSE)
POST      /api/runs/[runId]/evaluate      (SSE, Sigge + Isak parallellt)
```

---

## Vad som saknas / nästa steg

Dessa routes är **inte skapade än** och ska byggas i samma mönster som Mårtens befintliga routes:

### `/api/runs/[runId]/finance` (POST, SSE)
Kör **Tilde** (klient-CFO) och **Otto** (byråns account director) parallellt.
Tar emot idéer som överlevt opposition-fasen.
Använd `loadAgentPrompt("tilde")` och `loadAgentPrompt("otto")`.

### `/api/runs/[runId]/pr` (POST, SSE)
Kör **Ebbe** (earned media), **Lova** (social/influencer) och **Felix** (experience) parallellt.
Tar emot idéer som klarade finance-fasen.
Använd `loadAgentPrompt("ebbe")`, `loadAgentPrompt("lova")`, `loadAgentPrompt("felix")`.

### `/api/runs/[runId]/package` (POST, SSE)
Kör **Alba** — tar hela pipeline-outputen och paketerar till Figma-ready brief.
Använd `loadAgentPrompt("alba")`.

---

## Mönster för ny route (kopiera från evaluate/route.ts)

```typescript
import { loadAgentPrompt, getTemperature } from "@/lib/agents/loader";
import type { AgentKey } from "@jung/types";

// Kör agent med SSE-streaming
const stream = anthropic.messages.stream({
  model: vars.agents.model,
  max_tokens: 2048,
  temperature: getTemperature("tilde"),
  system: loadAgentPrompt("tilde"),
  messages: [{ role: "user", content: ideasContext }],
});
```

---

## DB-tabeller som kan behövas (Supabase)

För finance och PR-faserna behövs troligen:
- `finance_evaluations` — output från Tilde + Otto
- `pr_evaluations` — output från Ebbe + Lova + Felix
- `briefs` — Alba's slutliga Figma-ready brief

Kolla `supabase/migrations/001_initial.sql` för befintligt schema.
