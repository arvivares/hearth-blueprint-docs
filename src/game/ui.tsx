import { useEffect, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConnectionStatus } from "./useGameRoom";

export function Shell({
  title,
  headerRight,
  children,
  showHomeLink = true,
}: {
  title: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
  showHomeLink?: boolean;
}) {
  return (
    <div className="relative min-h-[100dvh] bg-[#000000] text-foreground overflow-x-hidden selection:bg-white selection:text-black">
      {/* Luz ambiental sutil estilo Apple */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 h-[450px] w-full max-w-4xl apple-glow opacity-70" />

      <main className="relative z-10 mx-auto min-h-[100dvh] max-w-2xl px-4 py-8 sm:py-12 space-y-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {showHomeLink && (
              <Link
                to="/"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-400 hover:text-white transition active:scale-95 border border-white/[0.06]"
                title="Volver al inicio"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            )}
            <div>
              <Link to="/" className="text-xs font-semibold tracking-tight text-zinc-500 hover:text-zinc-300 transition block">
                PeekRush.
              </Link>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">{title}</h1>
            </div>
          </div>
          {headerRight}
        </header>

        <div className="space-y-6">{children}</div>
      </main>
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string | undefined }) {
  return (
    <section className={cn("apple-glass rounded-3xl p-6 sm:p-8 space-y-4 border border-white/[0.08]", className)}>
      {children}
    </section>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger"; size?: "md" | "xl" };
export function Button({ variant = "primary", size = "md", className, ...props }: BtnProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40",
        size === "md" ? "rounded-xl px-5 py-3 text-sm" : "min-h-14 rounded-2xl px-6 text-lg",
        variant === "primary" && "bg-white text-black hover:bg-zinc-200 shadow-sm",
        variant === "ghost" && "bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/[0.1]",
        variant === "danger" && "bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20",
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
        "w-full rounded-2xl bg-white/[0.04] border border-white/[0.1] px-5 py-3.5 text-base sm:text-lg text-white placeholder:text-zinc-600 outline-none transition focus:border-white/30 focus:bg-white/[0.07] focus:ring-4 focus:ring-white/[0.04]",
        className,
      )}
    />
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
      {children}
    </p>
  );
}

export function ConnectionDot({ status }: { status: ConnectionStatus | "demo" }) {
  const map = {
    connected: ["bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]", "Conectado"],
    connecting: ["bg-amber-400 animate-pulse", "Conectando…"],
    idle: ["bg-zinc-500", "Sin conexión"],
    closed: ["bg-red-400", "Desconectado"],
    error: ["bg-red-400", "Error de conexión"],
    demo: ["bg-indigo-400", "Demostración"],
  } as const;
  const [cls, label] = map[status];
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400" role="status">
      <span className={cn("h-2 w-2 rounded-full", cls)} aria-hidden />
      {label}
    </span>
  );
}

export function DemoBanner() {
  return (
    <div className="border-b border-indigo-500/20 bg-indigo-950/20 px-4 py-2 text-center text-xs font-medium text-indigo-300 backdrop-blur-md" role="note">
      Modo Demostración · Simulación de interfaces sin servidor
    </div>
  );
}

/** QR generado en el navegador con soporte de contraste limpio */
export function RoomQR({ url, size = 240, className }: { url: string; size?: number; className?: string }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 0, width: 600, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } }).then(setSrc);
  }, [url]);
  return (
    <div className={cn("rounded-3xl bg-white p-4 shadow-2xl", className)} style={{ width: size + 32 }}>
      {src ? <img src={src} alt={`Código QR para entrar: ${url}`} width={size} height={size} className="block h-auto w-full" /> : <div style={{ width: size, height: size }} />}
    </div>
  );
}

export function joinUrl(code: string) {
  const clean = String(code || "").replace(/['"]/g, "").trim().toUpperCase();
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://peekrush.inmerzion.io";
  return `${origin}/play?room=${encodeURIComponent(clean)}`;
}

