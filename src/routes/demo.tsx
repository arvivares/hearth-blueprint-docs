import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { DEMO_ANSWER, DEMO_PHASES, DEMO_REMAINING_MS, demoSnapshot, type DemoPhase } from "@/game/demo/fixtures";
import { DemoBanner } from "@/game/ui";
import { HostView } from "@/game/views/HostView";
import { PlayerView } from "@/game/views/PlayerView";
import { TvView } from "@/game/views/TvView";

// DEMOSTRACIÓN: vistas alimentadas con datos ficticios. No se conecta al servidor.
export const Route = createFileRoute("/demo")({
  validateSearch: z.object({
    view: z.enum(["tv", "player", "host"]).catch("tv"),
    phase: z.enum(DEMO_PHASES).catch("LOBBY"),
  }),
  head: () => ({
    meta: [
      { title: "Demostración de interfaces — Logos" },
      { name: "description", content: "Vista de diseño con datos ficticios de la TV, el móvil y el anfitrión." },
      { property: "og:title", content: "Demostración de interfaces — Logos" },
      { property: "og:description", content: "Vista de diseño con datos ficticios de la TV, el móvil y el anfitrión." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DemoPage,
});

function DemoPage() {
  const { view, phase } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [origin, setOrigin] = useState("https://logos.example");
  useEffect(() => setOrigin(window.location.origin), []);
  const s = demoSnapshot(phase as DemoPhase);
  const url = `${origin}/play?room=${s.roomCode}`;
  const noop = () => {};

  return (
    <div className="flex h-[100dvh] flex-col">
      <DemoBanner />
      <nav className="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm">
        {(["tv", "player", "host"] as const).map((v) => (
          <Tab key={v} active={view === v} onClick={() => navigate({ search: { view: v, phase } })}>
            {v === "tv" ? "TV" : v === "player" ? "Móvil" : "Anfitrión"}
          </Tab>
        ))}
        <span className="mx-2 text-muted-foreground">|</span>
        {DEMO_PHASES.map((ph) => (
          <Tab key={ph} active={phase === ph} onClick={() => navigate({ search: { view, phase: ph } })}>{ph}</Tab>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-auto">
        {view === "tv" && (
          <TvView
            s={s}
            code={s.roomCode}
            joinUrl={url}
            joinHost={origin.replace(/^https?:\/\//, "")}
            remainingMs={phase === "ROUND_ACTIVE" ? DEMO_REMAINING_MS : null}
            mediaSrc={null}
            revealAnswer={phase === "ROUND_RESULTS" ? DEMO_ANSWER : null}
            connection="demo"
            fill
          />
        )}
        {view === "player" && (
          <div className="mx-auto h-full max-w-sm border-x">
            <PlayerView
              s={s}
              playerId="demo-4"
              alias="Lucía"
              connection="demo"
              connectionError={null}
              remainingMs={phase === "ROUND_ACTIVE" ? DEMO_REMAINING_MS : null}
              lastResult={phase === "ROUND_ACTIVE" ? { attemptId: "demo", roundId: s.roundId, status: "incorrect" } : null}
              pending={false}
              errorCode={null}
              onSubmit={noop}
              fill
            />
          </div>
        )}
        {view === "host" && (
          <HostView
            s={s}
            code={s.roomCode}
            joinUrl={url}
            connection="demo"
            connectionError={null}
            serverError={null}
            pairing={{ code: "000000", expiresAt: 0 }}
            pairingError={null}
            onPair={noop}
            onConfigure={noop}
            onCommand={noop}
            onKick={noop}
          />
        )}
      </div>
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("rounded-lg px-3 py-1 font-semibold", active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
      {children}
    </button>
  );
}
