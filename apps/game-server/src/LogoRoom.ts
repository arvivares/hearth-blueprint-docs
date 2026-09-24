import { Room, ServerError, type Client } from "colyseus";
import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { ClientMessages, MessageRole, type ClientMessageType } from "../../../packages/contracts/src/messages";
import type { ErrorCode, GameConfig } from "../../../packages/contracts/src/common";
import { verifyToken, type TokenClaims } from "./tokens";
import { getById, unregisterRoom, type RoomRecord } from "./registry";

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

const MAX_MESSAGE_BYTES = 2048;
const IDLE_DISPOSE_MS = 10 * 60_000;

export class LogoRoom extends Room<LogoState> {
  private rec!: RoomRecord;
  private leaveTimers = new Map<string, NodeJS.Timeout>();
  private lastActivity = Date.now();

  onCreate(options: { roomId?: string }) {
    this.autoDispose = false;
    this.setState(new LogoState());
    // El registro se completa desde la API HTTP justo tras crear la sala.
    this.clock.setInterval(() => this.housekeeping(), 5_000);

    this.onMessage("*", (client, type, payload) => this.handleMessage(client, String(type), payload));
  }

  /** Vincula el registro HTTP con esta instancia (llamado por la API). */
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
    // Una sola conexión activa por identidad: la nueva sustituye a la anterior.
    for (const other of this.clients) {
      const o = other.userData as TokenClaims | undefined;
      if (other !== client && o && o.role === auth.role && o.sub === auth.sub) other.leave(4000, "REPLACED");
      if (other !== client && o && auth.role === "screen" && o.role === "screen") other.leave(4000, "REPLACED");
    }

    if (auth.role === "host") this.state.hostConnected = true;
    if (auth.role === "screen") this.state.screenConnected = true;
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
    if (auth.role === "screen" && !this.clients.some((c) => c !== client && (c.userData as TokenClaims)?.role === "screen"))
      this.state.screenConnected = false;
    if (auth.role === "player") {
      const p = this.state.players.get(auth.sub);
      if (p) p.connected = false;
      // En LOBBY se libera la plaza si no vuelve dentro de la ventana de reconexión.
      const t = setTimeout(() => {
        const cur = this.state.players.get(auth.sub);
        if (cur && !cur.connected && this.state.phase === "LOBBY") this.removePlayer(auth.sub);
      }, this.rec.config.reconnectSeconds * 1000);
      this.leaveTimers.set(auth.sub, t);
    }
  }

  onDispose() {
    for (const t of this.leaveTimers.values()) clearTimeout(t);
    unregisterRoom(this.roomId);
  }

  private removePlayer(playerId: string) {
    this.state.players.delete(playerId);
    this.rec.players.delete(playerId);
    clearTimeout(this.leaveTimers.get(playerId));
    this.leaveTimers.delete(playerId);
  }

  private housekeeping() {
    if (!this.rec) return;
    const now = Date.now();
    const graceMs = this.rec.config.reconnectSeconds * 1000;
    // Reservas HTTP que nunca llegaron a conectarse.
    for (const [id, identity] of this.rec.players) {
      if (!this.state.players.has(id) && now - identity.reservedAt > graceMs) this.rec.players.delete(id);
    }
    if (this.clients.length === 0 && now - this.lastActivity > IDLE_DISPOSE_MS) this.disconnect();
  }

  private fail(client: Client, code: ErrorCode, ref?: string) {
    client.send("error", { code, ref });
  }

  private handleMessage(client: Client, type: string, payload: unknown) {
    const auth = client.userData as TokenClaims;
    if (!(type in ClientMessages)) return this.fail(client, "INVALID_INPUT", type);
    const t = type as ClientMessageType;
    if (JSON.stringify(payload ?? {}).length > MAX_MESSAGE_BYTES) return this.fail(client, "INVALID_INPUT", t);
    const needed = MessageRole[t];
    if (needed !== "any" && needed !== auth.role) return this.fail(client, "FORBIDDEN", t);
    const parsed = ClientMessages[t].safeParse(payload ?? {});
    if (!parsed.success) return this.fail(client, "INVALID_INPUT", t);

    switch (t) {
      case "clock:sync":
        client.send("clock:pong", { clientSentAt: (parsed.data as { clientSentAt: number }).clientSentAt, serverNow: Date.now() });
        return;
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
        if (this.state.phase !== "LOBBY") return this.fail(client, "INVALID_PHASE", t);
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
      default:
        // Resto de mensajes: se implementan en etapas posteriores.
        return this.fail(client, "INVALID_PHASE", t);
    }
  }
}
