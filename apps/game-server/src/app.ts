import http from "node:http";
import type { AddressInfo } from "node:net";
import express, { type Request, type Response } from "express";
import cors from "cors";
import { Server, matchMaker } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameConfig } from "../../../packages/contracts/src/common";
import {
  CreateRoomRequest,
  JoinPlayerRequest,
  ScreenLinkRequest,
} from "../../../packages/contracts/src/http";
import { LogoRoom } from "./LogoRoom";
import {
  getByCode,
  newPairingCode,
  newRoomCode,
  registerRoom,
  reservePlayer,
  type RoomRecord,
} from "./registry";
import { signToken, verifyToken } from "./tokens";
import { getMedia } from "./content/media";
import { settings } from "./settings";
import { createDb } from "./db/pool";
import { migrate } from "./db/migrate";
import { abortStaleGames, activeCatalogCount, getGlobalLeaderboard } from "./db/repo";

const VERSION = "0.1.0";
const TOKEN_TTL_MS = 12 * 60 * 60_000;
const PAIRING_TTL_MS = 5 * 60_000;

function err(res: Response, status: number, error: string) {
  res.status(status).json({ error });
}

function bearer(req: Request) {
  const h = req.header("authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

/** Límite simple por IP y ventana de 1 minuto. */
function rateLimit(max: number) {
  const hits = new Map<string, { n: number; reset: number }>();
  return (req: Request, res: Response, next: () => void) => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const h = hits.get(key);
    if (!h || h.reset < now) hits.set(key, { n: 1, reset: now + 60_000 });
    else if (++h.n > max) return err(res, 429, "RATE_LIMITED");
    next();
  };
}

export async function startServer(port = Number(process.env.PORT ?? 2567), opts: { timeScale?: number; databaseUrl?: string } = {}) {
  if (opts.timeScale) settings.timeScale = opts.timeScale;
  const databaseUrl = opts.databaseUrl ?? process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL es obligatorio (PostgreSQL)");
  const db = createDb(databaseUrl);
  settings.db = db;
  await migrate(db);
  const stale = await abortStaleGames(db);
  if (stale) console.warn(`[db] ${stale} partidas a medias marcadas como interrumpidas tras reinicio`);
  const available = await activeCatalogCount(db);
  if (available === 0) console.warn("[db] catálogo vacío: ejecuta npm run db:seed");
  const app = express();
  // Detrás de un proxy inverso, sin esto todas las peticiones comparten la IP del proxy en el límite por IP.
  if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
  const origins = (process.env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (origins.length === 0) console.warn("[http] ALLOWED_ORIGINS vacío: se aceptan todos los orígenes (solo desarrollo)");
  app.use(cors({ origin: origins.length ? origins : true }));
  app.use(express.json({ limit: "4kb" }));

  const httpServer = http.createServer(app);
  const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer, maxPayload: 16 * 1024 }) });
  gameServer.define("logo", LogoRoom);

  app.get("/health", (_req, res) => res.json({ ok: true, version: VERSION }));

  app.get("/api/leaderboard", async (_req, res) => {
    try {
      const top = await getGlobalLeaderboard(db, 15);
      res.json(top);
    } catch (e) {
      console.error("[http] error al obtener clasificación global", e);
      res.status(500).json({ error: "INTERNAL" });
    }
  });

  app.post("/api/rooms", rateLimit(Number(process.env.CREATE_ROOM_LIMIT ?? 30)), async (req, res) => {
    const parsed = CreateRoomRequest.safeParse(req.body ?? {});
    if (!parsed.success) return err(res, 400, "INVALID_INPUT");
    const config = GameConfig.parse(parsed.data.config ?? {});
    const roomCode = newRoomCode();
    const cache = await matchMaker.createRoom("logo", { internalKey: settings.internalRoomKey });
    const rec: RoomRecord = {
      roomId: cache.roomId,
      roomCode,
      config,
      players: new Map(),
      pairing: null,
      screenGen: 0,
      acceptingPlayers: true,
    };
    registerRoom(rec);
    (matchMaker.getLocalRoomById(cache.roomId) as LogoRoom).attach(rec);
    const hostToken = signToken({ roomId: rec.roomId, role: "host", sub: "host", exp: Date.now() + TOKEN_TTL_MS });
    res.status(201).json({ roomCode, roomId: rec.roomId, hostToken });
  });

  app.get("/api/rooms/:code", (req, res) => {
    const rec = getByCode(req.params.code);
    if (!rec) return err(res, 404, "ROOM_NOT_FOUND");
    const room = matchMaker.getLocalRoomById(rec.roomId) as LogoRoom | undefined;
    res.json({
      roomCode: rec.roomCode,
      phase: room?.state.phase ?? "LOBBY",
      playerCount: rec.players.size,
      maxPlayers: rec.config.maxPlayers,
      acceptingPlayers: rec.acceptingPlayers && rec.players.size < rec.config.maxPlayers,
    });
  });

  app.post("/api/rooms/:code/screen-pairing", (req, res) => {
    const rec = getByCode(req.params.code);
    if (!rec) return err(res, 404, "ROOM_NOT_FOUND");
    const claims = verifyToken(bearer(req));
    if (!claims) return err(res, 401, "UNAUTHORIZED");
    if (claims.role !== "host" || claims.roomId !== rec.roomId) return err(res, 403, "FORBIDDEN");
    rec.pairing = { code: newPairingCode(), expiresAt: Date.now() + PAIRING_TTL_MS, failures: 0 };
    res.json({ pairingCode: rec.pairing.code, expiresAt: rec.pairing.expiresAt });
  });

  app.post("/api/rooms/:code/screen", rateLimit(30), (req, res) => {
    const rec = getByCode(req.params.code);
    if (!rec) return err(res, 404, "ROOM_NOT_FOUND");
    const parsed = ScreenLinkRequest.safeParse(req.body);
    const p = rec.pairing;
    if (!parsed.success || !p || p.expiresAt < Date.now() || p.code !== parsed.data.pairingCode) {
      if (p && ++p.failures >= 10) rec.pairing = null; // fuerza bruta: invalida el código
      return err(res, 403, "PAIRING_INVALID");
    }
    rec.pairing = null; // un solo uso
    rec.screenGen += 1; // invalida pantallas anteriores
    const screenToken = signToken({
      roomId: rec.roomId,
      role: "screen",
      sub: `screen:${rec.screenGen}`,
      gen: rec.screenGen,
      exp: Date.now() + TOKEN_TTL_MS,
    });
    res.json({ screenToken, roomId: rec.roomId });
  });

  app.post("/api/rooms/:code/players", rateLimit(Number(process.env.JOIN_LIMIT ?? 120)), (req, res) => {
    const rec = getByCode(req.params.code);
    if (!rec) return err(res, 404, "ROOM_NOT_FOUND");
    const parsed = JoinPlayerRequest.safeParse(req.body);
    if (!parsed.success) return err(res, 400, "ALIAS_INVALID");

    // Recuperación de sesión: token válido de esta sala y con identidad viva.
    const prev = verifyToken(parsed.data.playerToken);
    if (prev && prev.role === "player" && prev.roomId === rec.roomId) {
      const identity = rec.players.get(prev.sub);
      if (identity) {
        identity.reservedAt = Date.now();
        const room = matchMaker.getLocalRoomById(rec.roomId) as LogoRoom | undefined;
        return res.json({
          playerToken: parsed.data.playerToken,
          playerId: identity.playerId,
          roomId: rec.roomId,
          alias: identity.alias,
          waiting: room?.state.players.get(identity.playerId)?.waiting ?? false,
        });
      }
    }

    if (rec.players.size >= rec.config.maxPlayers) return err(res, 409, "ROOM_FULL");
    const identity = reservePlayer(rec, parsed.data.alias);
    const room = matchMaker.getLocalRoomById(rec.roomId) as LogoRoom | undefined;
    const playerToken = signToken({ roomId: rec.roomId, role: "player", sub: identity.playerId, exp: Date.now() + TOKEN_TTL_MS });
    res.json({
      playerToken,
      playerId: identity.playerId,
      roomId: rec.roomId,
      alias: identity.alias,
      waiting: (room?.state.phase ?? "LOBBY") !== "LOBBY",
    });
  });

  // Imágenes por etapa: id opaco + credencial de pantalla + comprobación contra el estado vivo.
  app.get("/api/media/:id", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const claims = verifyToken(bearer(req));
    if (!claims) return err(res, 401, "UNAUTHORIZED");
    const m = getMedia(req.params.id);
    if (!m) return err(res, 404, "NOT_FOUND");
    if (claims.role !== "screen" || claims.roomId !== m.roomId) return err(res, 403, "FORBIDDEN");
    const room = matchMaker.getLocalRoomById(m.roomId) as LogoRoom | undefined;
    const rec = room && getByCode(room.state.roomCode);
    if (!room || !rec || claims.gen !== rec.screenGen) return err(res, 403, "FORBIDDEN");
    const st = room.state;
    const phase = st.phase === "PAUSED" ? st.previousPhase : st.phase;
    const sameRound = st.roundId === m.roundId;
    const allowed =
      sameRound &&
      (m.kind === "stage"
        ? ["ROUND_ACTIVE", "ROUND_RESULTS"].includes(phase) && m.stage <= st.revealStage
        : phase === "ROUND_RESULTS");
    if (!allowed) return err(res, 403, "FORBIDDEN");
    res.type("image/png").send(m.data);
  });

  await gameServer.listen(port);
  const actualPort = (httpServer.address() as AddressInfo).port;
  return {
    port: actualPort,
    db,
    close: async () => {
      await gameServer.gracefullyShutdown(false);
      await db.end();
    },
  };
}
