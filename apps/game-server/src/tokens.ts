import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Role } from "../../../packages/contracts/src/common";

export interface TokenClaims {
  roomId: string;
  role: Role;
  sub: string; // playerId | "host" | "screen:<gen>"
  gen?: number; // generación de pantalla
  exp: number; // ms
}

let secret: Buffer | null = null;
function getSecret(): Buffer {
  if (!secret) {
    const env = process.env.TOKEN_SECRET;
    if (env && env.length >= 32) secret = Buffer.from(env);
    else {
      if (process.env.NODE_ENV === "production") {
        throw new Error("TOKEN_SECRET (>=32 caracteres) es obligatorio en producción");
      }
      console.warn("[tokens] TOKEN_SECRET no definido: se usa uno aleatorio (solo desarrollo)");
      secret = randomBytes(32);
    }
  }
  return secret;
}

const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");

export function signToken(claims: TokenClaims): string {
  const body = b64(JSON.stringify(claims));
  const sig = createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken(token: unknown): TokenClaims | null {
  if (typeof token !== "string" || token.length > 1024) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", getSecret()).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString()) as TokenClaims;
    if (typeof claims.exp !== "number" || claims.exp < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}
