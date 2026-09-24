import { useEffect, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import type { RoomSnapshot } from "./useGameRoom";

export function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">{title}</h1>
      {children}
    </main>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <section className="space-y-3 rounded-lg border bg-card p-4 text-card-foreground">{children}</section>;
}

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
    />
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="w-full rounded-md border border-input bg-background px-3 py-2" />;
}

export function ErrorBox({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">{children}</p>;
}

/** QR generado en el navegador; solo contiene la URL pública de entrada. */
export function RoomQR({ url }: { url: string }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 240 }).then(setSrc);
  }, [url]);
  return src ? <img src={src} alt={`QR para entrar: ${url}`} width={240} height={240} /> : null;
}

export function joinUrl(code: string) {
  return `${window.location.origin}/play?room=${code}`;
}

export function Participants({
  state,
  onKick,
  highlight,
}: {
  state: RoomSnapshot | null;
  onKick?: (id: string) => void;
  highlight?: string;
}) {
  if (!state) return <p className="text-sm text-muted-foreground">Esperando estado del servidor…</p>;
  const list = Object.entries(state.players);
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Jugadores: {list.length} / {state.maxPlayers} · Anfitrión {state.hostConnected ? "conectado" : "desconectado"} ·
        Pantalla {state.screenConnected ? "conectada" : "desconectada"}
      </p>
      <ul className="divide-y rounded-md border" data-testid="participants">
        {list.length === 0 && <li className="p-2 text-sm text-muted-foreground">Nadie todavía.</li>}
        {list.map(([id, p]) => (
          <li key={id} className="flex items-center justify-between p-2 text-sm">
            <span className={id === highlight ? "font-bold" : ""}>
              {p.alias} {p.connected ? "" : "(desconectado)"}
            </span>
            {onKick && (
              <button className="text-xs text-destructive underline" onClick={() => onKick(id)}>
                Expulsar
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
