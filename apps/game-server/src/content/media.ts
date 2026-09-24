import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { logoSvg, type CatalogItem } from "./catalog";

/**
 * Almacén en memoria de imágenes por etapa. Cada imagen tiene un id opaco
 * aleatorio sin relación con la respuesta. Los permisos se verifican en la API
 * contra el estado vivo de la sala en cada petición.
 */
export interface MediaEntry {
  roomId: string;
  roundId: string;
  kind: "stage" | "full";
  stage: number; // 1..N para "stage"; 0 para "full"
  data: Buffer;
}

const store = new Map<string, MediaEntry>();

export const getMedia = (id: string) => store.get(id);

export function dropRoundMedia(roomId: string, roundId?: string) {
  for (const [id, m] of store) if (m.roomId === roomId && (!roundId || m.roundId === roundId)) store.delete(id);
}

/** Tamaño de bloque del pixelado por etapa: de muy grueso a fino (nunca el original). */
export function blockSizes(stages: number): number[] {
  const max = 72;
  const min = 10;
  if (stages === 1) return [min];
  return Array.from({ length: stages }, (_, i) => Math.round(max * Math.pow(min / max, i / (stages - 1))));
}

export async function prepareRoundMedia(roomId: string, roundId: string, item: CatalogItem, stages: number) {
  const original = await sharp(Buffer.from(logoSvg(item))).png().toBuffer();
  const size = 512;
  const stageIds: string[] = [];
  for (const [i, block] of blockSizes(stages).entries()) {
    const small = Math.max(2, Math.round(size / block));
    const down = await sharp(original).resize(small, small, { kernel: "cubic" }).toBuffer();
    const data = await sharp(down).resize(size, size, { kernel: "nearest" }).webp({ quality: 80 }).toBuffer();
    const id = randomBytes(16).toString("hex");
    store.set(id, { roomId, roundId, kind: "stage", stage: i + 1, data });
    stageIds.push(id);
  }
  const fullId = randomBytes(16).toString("hex");
  store.set(fullId, { roomId, roundId, kind: "full", stage: 0, data: await sharp(original).webp({ quality: 90 }).toBuffer() });
  return { stageIds, fullId };
}
