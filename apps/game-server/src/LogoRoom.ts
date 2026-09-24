import { randomUUID } from "node:crypto";
import { Room, ServerError, type Client } from "colyseus";
import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { ClientMessages, MessageRole, type ClientMessageType } from "../../../packages/contracts/src/messages";
import type { ErrorCode, GameConfig } from "../../../packages/contracts/src/common";
import { verifyToken, type TokenClaims } from "./tokens";
import { getById, unregisterRoom, type RoomRecord } from "./registry";
import * as repo from "./db/repo";
import type { Question } from "./db/repo";
import { dropRoundMedia, prepareRoundMedia } from "./content/media";
import { isCorrectAnswer, normalizeAnswer } from "./rules/normalize";
import { computeRanking, pointsForStage, stageForElapsed } from "./rules/scoring";
import { scaled, settings } from "./settings";

export class PlayerState extends Schema {
  @type("string") alias = "";
  @type("boolean") connected = false;
  @type("number") score = 0;
  @type("number") correctCount = 0;
  @type("boolean") answeredThisRound = false;
  @type("boolean") waiting = false;
}

export class RankEntry extends Schema {
  @type("string") playerId = "";
  @type("number") rank = 0;
}

export class LogoState extends Schema {
  @type("string") phase = "LOBBY";
  @type("string") previousPhase = "";
  @type("string") roomCode = "";
  @type("number") maxPlayers = 0;
  @type("number") roundIndex = 0;
  @type("number") totalRounds = 0;
  @type("number") roundSeconds = 0;
  @type("string") roundId = "";
  @type("number") revealStage = 0;
  @type("number") totalStages = 0;
  @type("number") phaseEndsAt = 0;
  @type("boolean") hostConnected = false;
  @type("boolean") screenConnected = false;
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type([RankEntry]) ranking = new ArraySchema<RankEntry>();
}

type AttemptStatus = "correct" | "incorrect" | "already_scored" | "round_closed" | "rate_limited" | "duplicate";
interface AttemptRecord {
  attemptId: string;
  roundId: string;
  playerId: string;
  status: AttemptStatus;
  points?: number;
  retryAt?: number;
  normalized: string;
  stage: number;
  receivedAt: number;
}

interface RoundData {
  roundId: string;
  item: Question;
  stageIds: string[];
  fullId: string;
}

const MAX_MESSAGE_BYTES = 2048;
/** Límite de mensajes por conexión (cubo de fichas): ráfaga de 20, recarga 10/s. */
const MSG_BURST = 20;
const MSG_REFILL_PER_S = 10;
/** Mensajes descartados en 10 s a partir de los cuales se cierra la conexión. */
const MSG_DROP_DISCONNECT = 100;
const IDLE_DISPOSE_MS = 10 * 60_000;
const TICK_MS = 50;
const ACTIVE_PHASES = ["PREPARING", "COUNTDOWN", "ROUND_ACTIVE", "ROUND_RESULTS"];

export class LogoRoom extends Room<LogoState> {
  private rec!: RoomRecord;
  private leaveTimers = new Map<string, NodeJS.Timeout>();
  private lastActivity = Date.now();

  // --- Motor de juego (solo servidor) ---
  private questions: Question[] = [];
  gameId: string | null = null;
  private starting = false;
  /** Visible para pruebas en proceso; nunca se envía a clientes antes del cierre. */
  round: RoundData | null = null;
  private attempts = new Map<string, AttemptRecord>(); // attemptId -> resultado (idempotencia)
  private lastAttemptAt = new Map<string, number>(); // playerId -> ms
  private pausedRemainingMs = 0;
  private pausedAt = 0;
  private roundMs = 0;
  private preparing = false;
  /** Resumen en memoria de la partida actual (lo durable está en PostgreSQL). */
  history: { roundId: string; itemId: string; version: number; attempts: AttemptRecord[] }[] = [];

  private get db() {
    if (!settings.db) throw new Error("Base de datos no configurada");
    return settings.db;
  }

  private persist(what: string, p: Promise<unknown>) {
    p.catch((e) => console.error(`[db] fallo al guardar ${what} (sala ${this.state.roomCode})`, e));
  }

  onCreate(options: { internalKey?: unknown } = {}) {
    // Las salas solo se crean desde POST /api/rooms; /matchmake/create queda rechazado.
    if (options?.internalKey !== settings.internalRoomKey) throw new ServerError(403, "FORBIDDEN");
    this.autoDispose = false;
    this.setState(new LogoState());
    this.clock.setInterval(() => this.housekeeping(), 5_000);
    this.clock.setInterval(() => this.tick(), TICK_MS);
    this.onMessage("*", (client, type, payload) => this.handleMessage(client, String(type), payload));
  }

  attach(rec: RoomRecord) {
    this.rec = rec;
    this.state.roomCode = rec.roomCode;
    this.applyConfig(rec.config);
  }

  private applyConfig(c: GameConfig) {
    this.state.maxPlayers = c.maxPlayers;
    this.state.totalRounds = c.rounds;
    this.state.roundSeconds = c.roundSeconds;
    this.state.totalStages = c.revealStages;
  }

  // ---------------- Conexiones ----------------

  onAuth(_client: Client, options: { token?: unknown }): TokenClaims {
    const claims = verifyToken(options?.token);
    if (!claims) throw new ServerError(401, "UNAUTHORIZED");
    if (claims.roomId !== this.roomId) throw new ServerError(403, "FORBIDDEN");
    const rec = getById(this.roomId);
    if (!rec) throw new ServerError(404, "ROOM_NOT_FOUND");
    if (claims.role === "player" && !rec.players.has(claims.sub)) throw new ServerError(403, "FORBIDDEN");
    if (claims.role === "screen" && claims.gen !== rec.screenGen) throw new ServerError(403, "FORBIDDEN");
    return claims;
  }

  onJoin(client: Client, _options: unknown, auth: TokenClaims) {
    this.lastActivity = Date.now();
    client.userData = auth;
    for (const other of this.clients) {
      const o = other.userData as TokenClaims | undefined;
      if (other !== client && o && o.role === auth.role && o.sub === auth.sub) other.leave(4000, "REPLACED");
      if (other !== client && o && auth.role === "screen" && o.role === "screen") other.leave(4000, "REPLACED");
    }

    if (auth.role === "host") this.state.hostConnected = true;
    if (auth.role === "screen") {
      this.state.screenConnected = true;
      this.sendCurrentMediaTo(client);
    }
    if (auth.role === "player") {
      const identity = this.rec.players.get(auth.sub)!;
      clearTimeout(this.leaveTimers.get(auth.sub));
      this.leaveTimers.delete(auth.sub);
      let p = this.state.players.get(auth.sub);
      if (!p) {
        p = new PlayerState();
        p.alias = identity.alias;
        p.waiting = this.state.phase !== "LOBBY";
        this.state.players.set(auth.sub, p);
      }
      p.connected = true;
      // Reconexión: reenviar los resultados ya procesados de la ronda vigente, sin repetir efectos.
      if (this.round) {
        for (const a of this.attempts.values()) {
          if (a.playerId === auth.sub && a.roundId === this.round.roundId) client.send("attempt:result", this.publicResult(a));
        }
      }
      if (this.state.phase === "ROUND_RESULTS" && this.round) {
        client.send("round:reveal", { roundId: this.round.roundId, answer: this.round.item.answer, mediaId: "" });
      }
    }
    client.send("session", { role: auth.role, playerId: auth.role === "player" ? auth.sub : undefined });
  }

  onLeave(client: Client) {
    this.lastActivity = Date.now();
    const auth = client.userData as TokenClaims | undefined;
    if (!auth) return;
    const stillConnected = this.clients.some(
      (c) => c !== client && (c.userData as TokenClaims)?.sub === auth.sub && (c.userData as TokenClaims)?.role === auth.role,
    );
    if (stillConnected) return;
    if (auth.role === "host") this.state.hostConnected = false;
    if (auth.role === "screen" && !this.clients.some((c) => c !== client && (c.userData as TokenClaims)?.role === "screen")) {
      this.state.screenConnected = false;
      // Sin pantalla nadie ve la partida: pausa automática.
      if (ACTIVE_PHASES.includes(this.state.phase)) this.pause();
    }
    if (auth.role === "player") {
      const p = this.state.players.get(auth.sub);
      if (p) p.connected = false;
      const t = setTimeout(() => {
        const cur = this.state.players.get(auth.sub);
        if (cur && !cur.connected && this.state.phase === "LOBBY") this.removePlayer(auth.sub);
      }, this.rec.config.reconnectSeconds * 1000);
      this.leaveTimers.set(auth.sub, t);
    }
  }

  onDispose() {
    for (const t of this.leaveTimers.values()) clearTimeout(t);
    dropRoundMedia(this.roomId);
    unregisterRoom(this.roomId);
  }

  private removePlayer(playerId: string) {
    this.state.players.delete(playerId);
    this.rec.players.delete(playerId);
    clearTimeout(this.leaveTimers.get(playerId));
    this.leaveTimers.delete(playerId);
    this.updateRanking();
  }

  private housekeeping() {
    if (!this.rec) return;
    const now = Date.now();
    const graceMs = this.rec.config.reconnectSeconds * 1000;
    for (const [id, identity] of this.rec.players) {
      if (!this.state.players.has(id) && now - identity.reservedAt > graceMs) this.rec.players.delete(id);
    }
    if (this.clients.length === 0 && now - this.lastActivity > IDLE_DISPOSE_MS) this.disconnect();
  }

  // ---------------- Motor ----------------

  private screens() {
    return this.clients.filter((c) => (c.userData as TokenClaims)?.role === "screen");
  }

  private activePlayers() {
    return [...this.state.players.entries()].filter(([, p]) => !p.waiting);
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  }

  private async startGame() {
    if (this.starting) return;
    this.starting = true;
    try {
      const questions = await repo.selectQuestions(this.db, this.rec.config.rounds);
      if (questions.length === 0) throw new Error("Catálogo vacío");
      // Mezclar el orden aleatoriamente para garantizar una experiencia distinta en cada partida
      for (let i = questions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [questions[i], questions[j]] = [questions[j], questions[i]];
      }
      const players = this.activePlayers();
      if (this.state.phase !== "LOBBY" || players.length === 0) return;
      const gameId = randomUUID();
      await repo.createGame(this.db, {
        id: gameId,
        roomCode: this.state.roomCode,
        config: { ...this.rec.config, rounds: questions.length },
        players: players.map(([id, p]) => ({ id, alias: p.alias })),
      });
      this.gameId = gameId;
      for (const p of this.state.players.values()) {
        p.score = 0;
        p.correctCount = 0;
        p.answeredThisRound = false;
        p.waiting = false;
      }
      this.attempts.clear();
      this.lastAttemptAt.clear();
      this.history = [];
      this.questions = questions;
      this.state.totalRounds = questions.length;
      this.state.roundIndex = -1;
      this.updateRanking();
      await this.prepareRound(0);
    } catch (e) {
      console.error("[motor] no se pudo iniciar la partida", e);
      for (const c of this.clients) if ((c.userData as TokenClaims)?.role === "host") this.fail(c, "INTERNAL", "host:start");
    } finally {
      this.starting = false;
    }
  }

  private async prepareRound(index: number) {
    if (this.round) dropRoundMedia(this.roomId, this.round.roundId);
    const item = this.questions[index]!;
    const roundId = randomUUID();
    this.state.roundIndex = index;
    this.state.roundId = roundId;
    this.state.revealStage = 0;
    this.state.phase = "PREPARING";
    this.state.phaseEndsAt = 0;
    this.round = null;
    this.preparing = true;
    for (const p of this.state.players.values()) p.answeredThisRound = false;
    await repo.createRound(this.db, { id: roundId, gameId: this.gameId!, index, itemId: item.itemId, versionId: item.versionId });
    const media = await prepareRoundMedia(this.roomId, roundId, item.image.bytes, this.state.totalStages);
    if (this.state.roundId !== roundId || this.state.phase === "ABORTED") return dropRoundMedia(this.roomId, roundId);
    this.round = { roundId, item, ...media };
    this.history.push({ roundId, itemId: item.itemId, version: item.version, attempts: [] });
    this.preparing = false;
    // Plazo para que la pantalla confirme que puede mostrar el estado inicial.
    if (this.state.phase === "PREPARING") this.state.phaseEndsAt = Date.now() + scaled(settings.prepareTimeoutMs);
  }

  private startCountdown() {
    this.state.phase = "COUNTDOWN";
    this.state.phaseEndsAt = Date.now() + scaled(settings.countdownMs);
  }

  private startRound() {
    this.roundMs = scaled(this.state.roundSeconds * 1000);
    this.state.phase = "ROUND_ACTIVE";
    this.state.phaseEndsAt = Date.now() + this.roundMs;
    this.setStage(1);
  }

  private setStage(stage: number) {
    if (!this.round || stage === this.state.revealStage) return;
    this.state.revealStage = stage;
    for (const s of this.screens()) this.sendCurrentMediaTo(s);
  }

  private sendCurrentMediaTo(client: Client) {
    if (!this.round) return;
    if (this.state.phase === "ROUND_ACTIVE" || (this.state.phase === "PAUSED" && this.state.previousPhase === "ROUND_ACTIVE")) {
      const stage = this.state.revealStage;
      if (stage >= 1) client.send("round:media", { roundId: this.round.roundId, stage, mediaId: this.round.stageIds[stage - 1] });
    }
    if (this.state.phase === "ROUND_RESULTS" || (this.state.phase === "PAUSED" && this.state.previousPhase === "ROUND_RESULTS")) {
      client.send("round:reveal", { roundId: this.round.roundId, answer: this.round.item.answer, mediaId: this.round.fullId });
    }
  }

  private endRound() {
    if (!this.round) return;
    this.state.phase = "ROUND_RESULTS";
    this.state.phaseEndsAt = Date.now() + scaled(settings.resultsMs);
    this.updateRanking();
    const { roundId, item, fullId } = this.round;
    this.persist("cierre de ronda", repo.endRound(this.db, roundId));
    // La solución solo se revela al cerrar la ronda. Los móviles no reciben la imagen.
    for (const c of this.clients) {
      const role = (c.userData as TokenClaims)?.role;
      c.send("round:reveal", { roundId, answer: item.answer, mediaId: role === "screen" ? fullId : "" });
    }
  }

  private nextAfterResults() {
    const next = this.state.roundIndex + 1;
    if (next >= this.questions.length) {
      this.state.phase = "FINAL_RESULTS";
      this.state.phaseEndsAt = 0;
      this.updateRanking();
      if (this.gameId) {
        const results = this.state.ranking.map((r) => {
          const p = this.state.players.get(r.playerId)!;
          return { playerId: r.playerId, score: p.score, correctCount: p.correctCount, rank: r.rank };
        });
        this.persist("resultados finales", repo.finishGame(this.db, this.gameId, results));
      }
    } else void this.prepareRound(next);
  }

  private updateRanking() {
    const standings = this.activePlayers().map(([playerId, p]) => ({ playerId, score: p.score, correctCount: p.correctCount }));
    const ranking = computeRanking(standings);
    this.state.ranking.clear();
    for (const r of ranking) {
      const e = new RankEntry();
      e.playerId = r.playerId;
      e.rank = r.rank;
      this.state.ranking.push(e);
    }
  }

  private pause() {
    if (!ACTIVE_PHASES.includes(this.state.phase)) return;
    this.state.previousPhase = this.state.phase;
    this.pausedRemainingMs = this.state.phaseEndsAt ? Math.max(0, this.state.phaseEndsAt - Date.now()) : 0;
    this.pausedAt = Date.now();
    this.state.phase = "PAUSED";
    this.state.phaseEndsAt = 0;
  }

  private resume() {
    const prev = this.state.previousPhase;
    this.state.previousPhase = "";
    if (prev === "PREPARING") {
      this.state.phase = "PREPARING";
      this.state.phaseEndsAt = this.round ? Date.now() + scaled(settings.prepareTimeoutMs) : 0;
      return;
    }
    this.state.phase = prev;
    this.state.phaseEndsAt = Date.now() + this.pausedRemainingMs;
    for (const s of this.screens()) this.sendCurrentMediaTo(s);
  }

  private abort() {
    if (this.gameId) this.persist("interrupción", repo.abortGame(this.db, this.gameId));
    this.state.phase = "ABORTED";
    this.state.phaseEndsAt = 0;
    if (this.round) dropRoundMedia(this.roomId, this.round.roundId);
    this.round = null;
  }

  private resetToLobby() {
    if (this.gameId && this.state.phase === "ABORTED") this.persist("interrupción", repo.abortGame(this.db, this.gameId));
    this.gameId = null;
    if (this.round) dropRoundMedia(this.roomId, this.round.roundId);
    this.round = null;
    this.state.phase = "LOBBY";
    this.state.previousPhase = "";
    this.state.roundIndex = 0;
    this.state.roundId = "";
    this.state.revealStage = 0;
    this.state.phaseEndsAt = 0;
    for (const [id, p] of [...this.state.players.entries()]) {
      if (!p.connected) this.removePlayer(id);
      else {
        p.score = 0;
        p.correctCount = 0;
        p.answeredThisRound = false;
        p.waiting = false;
      }
    }
    this.state.ranking.clear();
  }

  /** Reloj autoritativo: todas las transiciones temporizadas ocurren aquí. */
  private tick() {
    const now = Date.now();
    const s = this.state;
    switch (s.phase) {
      case "PREPARING":
        if (!this.preparing && s.phaseEndsAt && now >= s.phaseEndsAt) this.pause();
        break;
      case "COUNTDOWN":
        if (now >= s.phaseEndsAt) this.startRound();
        break;
      case "ROUND_ACTIVE": {
        const elapsed = this.roundMs - (s.phaseEndsAt - now);
        this.setStage(stageForElapsed(elapsed, this.roundMs, s.totalStages));
        if (now >= s.phaseEndsAt) this.endRound();
        break;
      }
      case "ROUND_RESULTS":
        if (now >= s.phaseEndsAt) this.nextAfterResults();
        break;
      case "PAUSED":
        if (now - this.pausedAt > scaled(settings.maxPauseMs)) this.abort();
        break;
    }
  }

  private publicResult(a: AttemptRecord) {
    return { attemptId: a.attemptId, roundId: a.roundId, status: a.status, points: a.points, retryAt: a.retryAt };
  }

  private handleAttempt(client: Client, playerId: string, data: { attemptId: string; roundId: string; text: string }) {
    const now = Date.now();
    const prev = this.attempts.get(data.attemptId);
    if (prev) {
      // Idempotencia: un reenvío no vuelve a evaluarse ni a puntuar.
      if (prev.playerId !== playerId) return this.fail(client, "INVALID_INPUT", "player:attempt");
      return client.send("attempt:result", { ...this.publicResult(prev), status: "duplicate", points: prev.points });
    }
    const p = this.state.players.get(playerId);
    if (!p || p.waiting) return this.fail(client, "INVALID_PHASE", "player:attempt");

    // Respuestas no evaluadas (cerrada, ya acertó, enfriamiento): se responden sin guardarse,
    // para que el spam con attemptId nuevos no haga crecer memoria ni base de datos.
    const reject = (status: AttemptStatus, extra: { retryAt?: number } = {}) =>
      client.send("attempt:result", { attemptId: data.attemptId, roundId: data.roundId, status, points: undefined, retryAt: extra.retryAt });
    const record = (status: AttemptStatus, extra: Partial<AttemptRecord> = {}) => {
      const a: AttemptRecord = {
        attemptId: data.attemptId,
        roundId: data.roundId,
        playerId,
        status,
        normalized: normalizeAnswer(data.text),
        stage: this.state.revealStage,
        receivedAt: now,
        ...extra,
      };
      this.attempts.set(a.attemptId, a);
      this.history.at(-1)?.attempts.push(a);
      if (this.gameId && this.round && a.roundId === this.round.roundId) {
        this.persist(
          "intento",
          repo.recordAttempt(this.db, { id: a.attemptId, gameId: this.gameId, roundId: a.roundId, playerId, status: a.status, normalized: a.normalized, stage: a.stage, points: a.points ?? 0, receivedAt: a.receivedAt }),
        );
      }
      client.send("attempt:result", this.publicResult(a));
    };

    const open = this.state.phase === "ROUND_ACTIVE" && this.round && data.roundId === this.round.roundId && now < this.state.phaseEndsAt;
    if (!open) return reject("round_closed");
    if (p.answeredThisRound) return reject("already_scored");
    const cooldown = scaled(this.rec.config.attemptCooldownMs);
    const last = this.lastAttemptAt.get(playerId) ?? 0;
    if (now - last < cooldown) return reject("rate_limited", { retryAt: last + cooldown });
    this.lastAttemptAt.set(playerId, now);

    if (isCorrectAnswer(data.text, this.round!.item.answer, this.round!.item.aliases)) {
      const points = pointsForStage(this.state.revealStage, this.rec.config.pointsByStage);
      p.score += points;
      p.correctCount += 1;
      p.answeredThisRound = true;
      record("correct", { points });

      // Si todos los jugadores activos ya acertaron (o si se juega de a uno), avanzar la ronda
      const active = this.activePlayers();
      if (active.length > 0 && active.every(([, pl]) => pl.answeredThisRound)) {
        this.endRound();
      }
      return;
    }
    return record("incorrect");
  }

  // ---------------- Mensajes ----------------

  private fail(client: Client, code: ErrorCode, ref?: string) {
    client.send("error", { code, ref });
  }

  private buckets = new WeakMap<Client, { tokens: number; at: number; dropped: number; windowAt: number; warnedAt: number }>();

  /** true si el mensaje puede procesarse. Descarta el exceso y cierra conexiones abusivas. */
  private allowMessage(client: Client): boolean {
    const now = Date.now();
    let b = this.buckets.get(client);
    if (!b) this.buckets.set(client, (b = { tokens: MSG_BURST, at: now, dropped: 0, windowAt: now, warnedAt: 0 }));
    b.tokens = Math.min(MSG_BURST, b.tokens + ((now - b.at) / 1000) * MSG_REFILL_PER_S);
    b.at = now;
    if (b.tokens >= 1) { b.tokens -= 1; return true; }
    if (now - b.windowAt > 10_000) { b.windowAt = now; b.dropped = 0; }
    b.dropped += 1;
    if (b.dropped >= MSG_DROP_DISCONNECT) { client.leave(4008, "RATE_LIMITED"); return false; }
    if (now - b.warnedAt > 1000) { b.warnedAt = now; this.fail(client, "RATE_LIMITED"); }
    return false;
  }

  private handleMessage(client: Client, type: string, payload: unknown) {
    const auth = client.userData as TokenClaims;
    if (!auth || !this.allowMessage(client)) return;
    if (!Object.prototype.hasOwnProperty.call(ClientMessages, type)) return this.fail(client, "INVALID_INPUT", type);
    const t = type as ClientMessageType;
    if (JSON.stringify(payload ?? {}).length > MAX_MESSAGE_BYTES) return this.fail(client, "INVALID_INPUT", t);
    const needed = MessageRole[t];
    if (needed !== "any" && needed !== auth.role) return this.fail(client, "FORBIDDEN", t);
    const parsed = ClientMessages[t].safeParse(payload ?? {});
    if (!parsed.success) return this.fail(client, "INVALID_INPUT", t);
    const phase = this.state.phase;
    const bad = () => this.fail(client, "INVALID_PHASE", t);

    switch (t) {
      case "clock:sync":
        return client.send("clock:pong", { clientSentAt: (parsed.data as { clientSentAt: number }).clientSentAt, serverNow: Date.now() });
      case "host:kick": {
        const { playerId } = parsed.data as { playerId: string };
        if (!this.rec.players.has(playerId)) return this.fail(client, "INVALID_INPUT", t);
        this.removePlayer(playerId);
        for (const c of this.clients) {
          const a = c.userData as TokenClaims;
          if (a.role === "player" && a.sub === playerId) c.leave(4003, "KICKED");
        }
        return;
      }
      case "host:configure": {
        if (phase !== "LOBBY") return bad();
        const next = { ...this.rec.config, ...(parsed.data as Partial<GameConfig>) };
        if (next.maxPlayers < this.rec.players.size) return this.fail(client, "INVALID_INPUT", t);
        if (next.pointsByStage.length !== next.revealStages) {
          next.pointsByStage = this.rec.config.pointsByStage.slice(0, next.revealStages);
          while (next.pointsByStage.length < next.revealStages) next.pointsByStage.push(0);
        }
        this.rec.config = next;
        this.applyConfig(next);
        return;
      }
      case "host:start":
        if (phase !== "LOBBY" || !this.state.screenConnected || this.activePlayers().length === 0) return bad();
        return void this.startGame();
      case "host:pause":
        return ACTIVE_PHASES.includes(phase) ? this.pause() : bad();
      case "host:resume":
        if (phase !== "PAUSED" || !this.state.screenConnected) return bad();
        return this.resume();
      case "host:next":
        if (phase === "ROUND_ACTIVE") return this.endRound();
        if (phase === "ROUND_RESULTS") return this.nextAfterResults();
        return bad();
      case "host:abort":
        return phase === "FINAL_RESULTS" || phase === "ABORTED" || phase === "LOBBY" ? bad() : this.abort();
      case "host:reset":
        return phase === "FINAL_RESULTS" || phase === "ABORTED" ? this.resetToLobby() : bad();
      case "screen:ready": {
        const { roundId } = parsed.data as { roundId: string };
        if (phase !== "PREPARING" || !this.round || roundId !== this.round.roundId) return bad();
        return this.startCountdown();
      }
      case "player:attempt":
        return this.handleAttempt(client, auth.sub, parsed.data as { attemptId: string; roundId: string; text: string });
    }
  }
}
