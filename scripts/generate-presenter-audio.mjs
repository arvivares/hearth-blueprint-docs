import fs from "node:fs";
import path from "node:path";

const API_KEY = process.env.ELEVENLABS_API_KEY || "sk_f0e95cecd463685edb3d3f93c411a2868689cac17524ec5d";
// Sarah: voz madura, profesional y televisiva
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";

const SCRIPTS = {
  es: {
    file: "public/audio/presentadora-es.mp3",
    text: `¡Hola! Te doy la bienvenida a PeekRush. Jugar es facilísimo y muy emocionante. Te cuento cómo funciona:

Puedes jugar en grupo con tus amigos o tú solo directamente desde el navegador.

Para jugar en grupo, pulsa en "Crear sala". Tu pantalla se convertirá en la pantalla principal del juego y mostrará un código QR gigante. Tus amigos solo tienen que escanear el código QR con la cámara de su móvil y escribir su nombre para unirse al instante.

Si estás solo, simplemente pulsa en "Jugar solo" para empezar una partida individual y responder directamente con tu teclado.

Cuando empiece la partida, aparecerá un logotipo que se irá revelando poco a poco. ¡Tu objetivo es adivinar la marca antes que nadie! Cuanto más rápido aciertes, más puntos conseguirás. Al final veremos el podio de la partida y la tabla de récords globales. ¡Mucha suerte y a jugar!`,
  },
  en: {
    file: "public/audio/presentadora-en.mp3",
    text: `Hello and welcome to PeekRush! Playing is super easy and lots of fun. Here is how it works:

You can play in a group with friends or by yourself directly from your browser.

To play with friends, click on "Create room". Your screen will turn into the main game screen, displaying a giant QR code. Your friends simply scan the QR code with their phone cameras and enter their nickname to join instantly.

If you are playing alone, just click on "Play solo" to start a single-player game and type your answers right on your keyboard.

Once the game starts, a brand logo will gradually reveal itself in stages. Your goal is to guess the brand before anyone else! The faster you guess correctly, the more points you score. At the end, we will reveal the podium and the global leaderboard. Good luck and have fun!`,
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
