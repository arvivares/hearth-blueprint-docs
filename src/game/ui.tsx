import { useEffect, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";
import type { ConnectionStatus } from "./useGameRoom";

export function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto min-h-[100dvh] max-w-3xl space-y-6 px-4 py-8">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
      {children}
    </main>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string | undefined }) {
  return <section className={cn("space-y-3 rounded-2xl border bg-card p-5 text-card-foreground", className)}>{children}</section>;
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger"; size?: "md" | "xl" };
export function Button({ variant = "primary", size = "md", className, ...props }: BtnProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40",
        size === "md" ? "px-4 py-2.5 text-sm" : "min-h-16 px-6 text-xl",
        variant === "primary" && "bg-primary text-primary-foreground hover:brightness-105",
        variant === "ghost" && "border bg-secondary text-secondary-foreground hover:bg-muted",
        variant === "danger" && "border border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground",
        className,
      )}
    />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-xl border border-input bg-background px-4 py-3 text-lg outline-none focus:border-ring focus:ring-2 focus:ring-ring/40",
        className,
      )}
    />
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-xl border border-destructive/60 bg-destructive/10 p-3 text-sm text-foreground">
      {children}
    </p>
  );
}

export function ConnectionDot({ status }: { status: ConnectionStatus | "demo" }) {
  const map = {
    connected: ["bg-success", "Conectado"],
    connecting: ["bg-warning animate-pulse", "Conectando…"],
    idle: ["bg-muted-foreground", "Sin conexión"],
    closed: ["bg-destructive", "Desconectado"],
    error: ["bg-destructive", "Error de conexión"],
    demo: ["bg-accent", "Demostración"],
  } as const;
  const [cls, label] = map[status];
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground" role="status">
      <span className={cn("h-2.5 w-2.5 rounded-full", cls)} aria-hidden />
      {label}
    </span>
  );
}

export function DemoBanner() {
  return (
    <div className="bg-stripes border-b-2 border-accent bg-accent/15 px-4 py-2 text-center text-xs font-bold uppercase tracking-widest text-accent" role="note">
      Demostración · datos ficticios · sin servidor
    </div>
  );
}

/** QR generado en el navegador; solo contiene la URL pública de entrada. */
export function RoomQR({ url, size = 240, className }: { url: string; size?: number; className?: string }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 0, width: 600, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#00000000" } }).then(setSrc);
  }, [url]);
  return (
    <div className={cn("rounded-2xl bg-paper p-4", className)} style={{ width: size + 32 }}>
      {src ? <img src={src} alt={`Código QR para entrar: ${url}`} width={size} height={size} className="block h-auto w-full" /> : <div style={{ width: size, height: size }} />}
    </div>
  );
}

export function joinUrl(code: string) {
  return `${window.location.origin}/play?room=${code}`;
}
