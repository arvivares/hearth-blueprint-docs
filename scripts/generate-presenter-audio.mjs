import fs from "node:fs";
import path from "node:path";

const API_KEY = process.env.ELEVENLABS_API_KEY || "sk_0e4c0181ee7075a222f2ee32ae234177f14b9f181d7622d8";
// Cristina: voz en español natural, profesional y amigable
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "dNjJKg63Fr5AXwIdkATa";

const text = `¡Hola! Te doy la bienvenida a PeekRush. Jugar es facilísimo y muy divertido. Te cuento cómo funciona.

PeekRush se juega en grupo frente a una pantalla principal compartida, como una televisión o un proyector, mientras cada jugador responde desde su propio teléfono móvil.

Si vas a organizar la partida, pulsa en "Crear sala". Obtendrás el código de tu partida y un código de vinculación para la televisión.

En la pantalla de la televisión, abre "Vincular pantalla" e introduce ese código. Verás aparecer un código QR gigante y el estado de la sala.

Para uniros como jugadores, solo tenéis que escanear el código QR con el móvil o entrar en peekrush.inmerzion.io, introducir el código de sala y elegir vuestro alias.

Cuando empiece la partida, en la pantalla grande aparecerá un logotipo que se irá revelando por etapas. ¡El objetivo es adivinar la marca antes que nadie! Cuanto más rápido escribas el nombre correcto en tu móvil, más puntos conseguirás. Al final de las rondas conoceremos al ganador. ¡Mucha suerte y a jugar!`;

console.log(`[elevenlabs] Generando locución de la presentadora con voz ${VOICE_ID}...`);

const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
  method: "POST",
  headers: {
    "xi-api-key": API_KEY,
    "Content-Type": "application/json",
    "Accept": "audio/mpeg",
  },
  body: JSON.stringify({
    text,
    model_id: "eleven_multilingual_v2",
    voice_settings: {
      stability: 0.55,
      similarity_boost: 0.85,
      style: 0.25,
      use_speaker_boost: true,
    },
  }),
});

if (!res.ok) {
  const errBody = await res.text();
  console.error(`[elevenlabs] Error ${res.status}:`, errBody);
  process.exit(1);
}

const buffer = Buffer.from(await res.arrayBuffer());
const outPath = path.resolve("public/audio/presentadora-como-jugar.mp3");
fs.writeFileSync(outPath, buffer);

console.log(`✓ Audio guardado en ${outPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
