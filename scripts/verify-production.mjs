#!/usr/bin/env node
import { Client } from "colyseus.js";

const BASE_URL = process.argv[2] || "https://peekrush.inmerzion.io";

console.log(`[verify] Probando despliegue en ${BASE_URL}...`);

async function testHttp() {
  // 1. Web SSR test
  const webRes = await fetch(`${BASE_URL}/`);
  if (!webRes.ok) throw new Error(`Fallo web /: HTTP ${webRes.status}`);
  const html = await webRes.text();
  if (!html.includes("<!DOCTYPE html>")) throw new Error("Fallo web /: No se recibió HTML válido");
  console.log("✓ Web SSR / responde HTTP 200 y HTML");

  // 2. Health check
  const healthRes = await fetch(`${BASE_URL}/health`);
  if (!healthRes.ok) throw new Error(`Fallo /health: HTTP ${healthRes.status}`);
  const health = await healthRes.json();
  if (!health.ok) throw new Error("Fallo /health: ok !== true");
  console.log(`✓ Game Server /health responde OK (versión: ${health.version})`);

  // 3. Crear sala
  const createRes = await fetch(`${BASE_URL}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config: { rounds: 3, roundSeconds: 15 } }),
  });
  if (!createRes.ok) throw new Error(`Fallo crear sala: HTTP ${createRes.status}`);
  const room = await createRes.json();
  if (!room.roomCode || !room.roomId || !room.hostToken) throw new Error("Fallo crear sala: respuesta incompleta");
  console.log(`✓ API /api/rooms responde OK (sala creada: ${room.roomCode})`);

  // 4. Info sala
  const infoRes = await fetch(`${BASE_URL}/api/rooms/${room.roomCode}`);
  if (!infoRes.ok) throw new Error(`Fallo info sala: HTTP ${infoRes.status}`);
  const info = await infoRes.json();
  if (info.roomCode !== room.roomCode) throw new Error("Fallo info sala: código no coincide");
  console.log(`✓ API /api/rooms/${room.roomCode} responde OK (fase: ${info.phase})`);

  // 5. Unir jugador
  const joinRes = await fetch(`${BASE_URL}/api/rooms/${room.roomCode}/players`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alias: "TestBot" }),
  });
  if (!joinRes.ok) throw new Error(`Fallo unir jugador: HTTP ${joinRes.status}`);
  const player = await joinRes.json();
  if (!player.playerToken || player.alias !== "TestBot") throw new Error("Fallo unir jugador: token inválido");
  console.log("✓ API unir jugador responde OK");

  // 6. Conexión WebSocket / Colyseus
  const client = new Client(BASE_URL);
  const colyseusRoom = await client.joinById(room.roomId, { token: player.playerToken });
  if (!colyseusRoom) throw new Error("Fallo conexión Colyseus WebSocket");
  console.log(`✓ Colyseus WebSocket conectado a sala ${colyseusRoom.id}`);

  await colyseusRoom.leave();
  console.log("✓ Colyseus WebSocket desconectado limpiamente");
}

try {
  await testHttp();
  console.log("\n Todos los tests de producción pasaron correctamente.");
} catch (err) {
  console.error("\n✗ Error en verificación:", err);
  process.exit(1);
}
