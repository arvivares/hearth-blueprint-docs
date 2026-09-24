import fs from "node:fs";
import path from "node:path";

const API_KEY = process.env.ELEVENLABS_API_KEY || "sk_f0e95cecd463685edb3d3f93c411a2868689cac17524ec5d";
// Sarah: voz madura, profesional y televisiva
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";

const SCRIPTS = {
  es: {
    file: "public/audio/presentadora-es.mp3",
    text: `¡Hola! Te doy la bienvenida a PeekRush. Jugar es facilísimo y muy divertido. Te cuento cómo funciona.

PeekRush se juega en grupo frente a una pantalla principal compartida, como una televisión o un proyector, mientras cada jugador responde desde su propio teléfono móvil.

Si vas a organizar la partida, pulsa en "Crear sala". Obtendrás el código de tu partida y un código de vinculación para la televisión.

En la pantalla de la televisión, abre "Vincular pantalla" e introduce ese código. Verás aparecer un código QR gigante y el estado de la sala.

Para uniros como jugadores, solo tenéis que escanear el código QR con el móvil o entrar en peekrush.inmerzion.io, introducir el código de sala y elegir vuestro alias.

Cuando empiece la partida, en la pantalla grande aparecerá un logotipo que se irá revelando por etapas. ¡El objetivo es adivinar la marca antes que nadie! Cuanto más rápido escribas el nombre correcto en tu móvil, más puntos conseguirás. Al final de las rondas conoceremos al ganador. ¡Mucha suerte y a jugar!`,
  },
  en: {
    file: "public/audio/presentadora-en.mp3",
    text: `Hello and welcome to PeekRush! Playing is super easy and lots of fun. Let me explain how it works.

PeekRush is played in a group in front of a shared main screen, such as a TV or projector, while every player submits their answers directly from their own mobile phone.

If you are hosting the game, click on "Create room". You will get your room code and a pairing code for the TV screen.

On the TV screen, open "Link screen" and enter that code. A giant QR code will appear along with the room status.

To join as a player, simply scan the QR code with your phone camera or visit peekrush.inmerzion.io, enter the room code, and choose your nickname.

Once the host starts the game, a logo will appear on the big screen, gradually revealing itself in stages. Your goal is to guess the brand before anyone else! The faster you enter the correct name on your mobile phone, the more points you score. At the end of all rounds, we will crown the champion. Good luck and enjoy the game!`,
  },
};

for (const [lang, item] of Object.entries(SCRIPTS)) {
  console.log(`[elevenlabs] Generando locución [${lang}] con voz ${VOICE_ID}...`);
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: "POST",
    headers: {
      "xi-api-key": API_KEY,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
    },
    body: JSON.stringify({
      text: item.text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.85,
        style: 0.2,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error(`[elevenlabs] Error generando ${lang} (${res.status}):`, errBody);
    process.exit(1);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const outPath = path.resolve(item.file);
  fs.writeFileSync(outPath, buffer);
  console.log(`✓ Audio [${lang}] guardado en ${outPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

// Mantener compatibilidad con el archivo previo
fs.copyFileSync(path.resolve("public/audio/presentadora-es.mp3"), path.resolve("public/audio/presentadora-como-jugar.mp3"));
console.log("✓ Copia de compatibilidad generada: presentadora-como-jugar.mp3");
