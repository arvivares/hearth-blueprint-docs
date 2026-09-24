import { test } from "node:test";
import assert from "node:assert/strict";
import { isCorrectAnswer, normalizeAnswer } from "../src/rules/normalize";
import { computeRanking, pointsForStage, stageForElapsed } from "../src/rules/scoring";

test("normalización: mayúsculas, acentos, espacios y signos", () => {
  assert.equal(normalizeAnswer("  Nébula   Móvil! "), "nebulamovil");
  assert.equal(normalizeAnswer("ONDALIA-café"), "ondaliacafe");
  assert.equal(normalizeAnswer("Gorrión"), "gorrion");
  assert.equal(normalizeAnswer("   "), "");
});

test("aciertos por respuesta y alias; sin coincidencia aproximada", () => {
  assert.ok(isCorrectAnswer("zentrova", "Zentrova", []));
  assert.ok(isCorrectAnswer("Kravik and Sons", "Kravik & Sons", ["Kravik and Sons"]));
  assert.ok(isCorrectAnswer("kravik", "Kravik & Sons", ["Kravik"]));
  assert.ok(!isCorrectAnswer("Zentrov", "Zentrova", []));
  assert.ok(!isCorrectAnswer("Zentrovaa", "Zentrova", []));
  assert.ok(!isCorrectAnswer("", "Zentrova", []));
});

test("puntos por etapa", () => {
  const t = [1000, 800, 600, 400, 200];
  assert.deepEqual([1, 2, 3, 4, 5].map((s) => pointsForStage(s, t)), t);
  assert.equal(pointsForStage(0, t), 0);
  assert.equal(pointsForStage(9, t), 200);
});

test("etapa según tiempo transcurrido", () => {
  assert.equal(stageForElapsed(0, 25000, 5), 1);
  assert.equal(stageForElapsed(4999, 25000, 5), 1);
  assert.equal(stageForElapsed(5000, 25000, 5), 2);
  assert.equal(stageForElapsed(30000, 25000, 5), 5);
});

test("desempates: puntos, luego aciertos, luego posición compartida", () => {
  const r = computeRanking([
    { playerId: "a", score: 1000, correctCount: 1 },
    { playerId: "b", score: 1800, correctCount: 2 },
    { playerId: "c", score: 1000, correctCount: 2 },
    { playerId: "d", score: 1000, correctCount: 1 },
    { playerId: "e", score: 0, correctCount: 0 },
  ]);
  assert.deepEqual(r, [
    { playerId: "b", rank: 1 },
    { playerId: "c", rank: 2 },
    { playerId: "a", rank: 3 },
    { playerId: "d", rank: 3 },
    { playerId: "e", rank: 5 },
  ]);
});
