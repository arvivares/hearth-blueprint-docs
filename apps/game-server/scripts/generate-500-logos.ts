import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import * as si from "simple-icons";
import { normalizeAnswer } from "../src/rules/normalize";
import { crossValidate, ManifestItem } from "../src/content/validate";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demoDir = path.resolve(__dirname, "../content/demo");
const imagesDir = path.join(demoDir, "images");
const publicLogosDir = path.resolve(__dirname, "../../../public/logos");

fs.mkdirSync(imagesDir, { recursive: true });
fs.mkdirSync(publicLogosDir, { recursive: true });

const iconBySlug = new Map(
  Object.values(si)
    .filter((x: any) => x && x.slug)
    .map((x: any) => [x.slug, x]),
);

// 1. Cargar las 100 marcas ya verificadas existentes
const currentManifestPath = path.join(demoDir, "manifest.json");
const currentManifest = JSON.parse(fs.readFileSync(currentManifestPath, "utf8"));
const items: ManifestItem[] = [...currentManifest.items];
const usedIds = new Set(items.map((i) => i.id));
const usedNormalized = new Set<string>();

for (const it of items) {
  usedNormalized.add(normalizeAnswer(it.answer));
  for (const a of it.aliases) usedNormalized.add(normalizeAnswer(a));
}

console.log(`[setup] Iniciando con ${items.length} marcas existentes...`);

// 2. Lista de slugs de marcas comerciales globales reales
const curatedSlugs = [
  // --- AEROLÍNEAS Y TRANSPORTE AÉREO ---
  "airfrance", "aircanada", "airchina", "airindia", "aeromexico", "airasia",
  "americanairlines", "ana", "britishairways", "delta", "easyjet", "emirates", "etihadairways",
  "iberia", "japanairlines", "jetblue", "klm", "lufthansa", "norwegian",
  "qantas", "qatarairways", "ryanair", "singaporeairlines", "southwestairlines",
  "turkishairlines", "unitedairlines", "virginatlantic", "wizzair",
  "chinaeasternairlines", "chinasouthernairlines", "cathaypacific", "aeroflot",
  "airserbia", "airtransat", "akasaair",

  // --- AUTOMOCIÓN, MOTOCICLETAS Y MOVILIDAD ---
  "astonmartin", "bentley", "bugatti", "mclaren", "maserati", "subaru", "citroen", "opel",
  "seat", "skoda", "rollsroyce", "dacia", "infiniti", "polestar", "smart", "iveco", "scania",
  "man", "ducati", "acura", "koenigsegg", "chrysler", "cadillac", "mini", "mitsubishi",
  "suzuki", "ktm", "yamahamotorcorporation", "harleydavidson", "kawasaki", "triumph",
  "vespa", "piaggio", "aprilia", "husqvarna", "vauxhall", "rover",
  "lyft", "grab", "waze", "blablacar",

  // --- HOTELES, VIAJES Y TURISMO ---
  "hilton", "marriott", "trivago", "expedia", "bookingdotcom", "tripadvisor",

  // --- AEROESPACIAL E INDUSTRIA ---
  "boeing", "airbus", "virgin", "abb", "3m", "irobot",

  // --- RESTAURACIÓN, COMIDA Y BEBIDAS ---
  "carlsjr", "justeat", "doordash", "postmates", "foodpanda", "zomato",
  "aldinord", "aldisud", "shell",

  // --- MODA, CALZADO Y ACCESORIOS ---
  "anta", "peakdesign",

  // --- HARDWARE, ELECTRÓNICA Y DISPOSITIVOS ---
  "beats", "beatsbydre", "bose", "sennheiser", "jbl", "sonos", "motorola", "oneplus", "oppo",
  "vivo", "blackberry", "htc", "tplink", "netgear", "ubiquiti", "synology", "qnap",
  "corsair", "steelseries", "kingstontechnology", "seagate", "hyperx", "garmin", "fitbit",
  "razer", "msi", "qualcomm", "broadcom", "wacom", "nzxt", "epson", "fujifilm",
  "fujitsu", "alcatel", "alienware", "evga", "gigabyte", "asrock", "zotac", "sapphire",
  "elgato", "klipsch", "marshall", "harmankardon", "akg", "bangolufsen", "pioneer",
  "viewsonic", "boat", "creality", "elegoo", "havells",

  // --- AUDIO PROFESIONAL E INSTRUMENTOS MUSICALES ---
  "fender", "gibson", "roland", "korg", "moog", "arturia", "novation", "akai",
  "nativeinstruments", "focusrite", "shure", "audiotechnica", "beyerdynamic", "rode",
  "presonus", "behringer", "mackie",

  // --- VIDEOJUEGOS, CONSOLAS Y ESTUDIOS ---
  "ea", "riotgames", "valve", "squareenix", "konami", "activision", "supercell", "cdprojekt",
  "gogdotcom", "itchdotio", "battledotnet", "unrealengine", "curseforge", "gamemaker", "2k",
  "steamdeck", "leagueoflegends", "esl", "faceit", "remedyentertainment",
  "artstation", "pixiv", "sketchfab", "turbosquid", "modrinth", "opencritic", "igdb",
  "steamdb", "protondb", "anilist", "kitsu",

  // --- STREAMING, MÚSICA, PODCASTS Y ENTRETENIMIENTO ---
  "dcentertainment", "imdb", "rottentomatoes", "letterboxd", "vimeo", "dailymotion", "shazam",
  "soundcloud", "deezer", "tidal", "audible", "lastdotfm", "bandcamp", "mixcloud", "genius",
  "myanimelist", "beatport", "spreaker", "iheartradio", "goodreads", "vimeolivestream",
  "animalplanet", "antena3", "plex", "dlive",

  // --- NOTICIAS, MEDIOS Y TELEVISIÓN ---
  "cnn", "nbc", "cbs", "fox", "bbc", "theguardian", "newyorktimes", "techcrunch", "buzzfeed",
  "ign", "polygon", "metacritic", "theweatherchannel", "nationalgeographic", "discovery",
  "history", "time", "gamespot", "kotaku", "eurogamer", "pcgamer", "bloomberg", "forbes",
  "wired", "mashable", "theverge",

  // --- DEPORTES Y LIGAS ---
  "nba", "mlb", "nhl", "fifa", "wwe", "ufc", "premierleague", "dazn", "espn", "eurosport",

  // --- NAVEGADORES WEB Y PRIVACIDAD ---
  "duckduckgo", "brave", "opera", "vivaldi", "torproject", "mozilla", "firefox", "safari",
  "googlechrome", "microsoftedge", "internetexplorer",

  // --- CIBERSEGURIDAD, VPNS Y SEGURIDAD ---
  "nordvpn", "expressvpn", "surfshark", "proton", "protonmail", "protonvpn",
  "bitwarden", "1password", "lastpass", "dashlane", "avira", "malwarebytes", "kaspersky",
  "bitdefender", "adblock", "adblockplus", "adguard", "privateinternetaccess", "mullvad",
  "crowdstrike", "snyk", "hackerone", "bugcrowd",

  // --- REDES SOCIALES, MENSAJERÍA Y COMUNIDAD ---
  "threads", "bluesky", "mastodon", "signal", "line", "wechat", "viber", "tumblr",
  "quora", "medium", "zoom", "teamspeak", "bereal", "wattpad", "disqus", "bilibili",
  "weibo", "lineageos", "fandom", "vk", "maildotru",

  // --- COMERCIO, RETAIL Y PLATAFORMAS ---
  "seatgeek", "opensea", "bigcommerce", "etsy", "rakuten", "mercadolibre",
  "ticketmaster", "eventbrite", "kickstarter", "patreon", "fiverr", "dribbble", "behance",
  "freepik", "giphy", "unsplash", "pixabay", "pexels", "deviantart", "flickr",

  // --- BANCA, FINTECH Y PAGOS ---
  "americanexpress", "revolut", "wise", "westernunion", "square", "klarna", "venmo",
  "cashapp", "coinbase", "binance", "deutschebank", "barclays", "hsbc", "monzo", "n26",
  "alipay", "mercadopago", "paysafe", "kraken", "adyen", "afterpay", "zelle", "nubank", "pagseguro",

  // --- SAAS, CLOUD, PRODUCTIVIDAD Y HERRAMIENTAS ---
  "salesforce", "zendesk", "hubspot", "atlassian", "jira", "confluence", "trello",
  "notion", "asana", "airtable", "clickup", "miro", "lucid", "loom", "grammarly",
  "coursera", "udemy", "edx", "khanacademy", "duolingo", "stackoverflow", "wikipedia",
  "wordpress", "squarespace", "wix", "mailchimp", "blender", "autodesk", "teamviewer",
  "namecheap", "godaddy", "mega", "cloudflare", "digitalocean", "heroku", "firebase",
  "supabase", "canva", "evernote", "basecamp", "hootsuite", "buffer", "anydesk",
  "deepl", "webflow", "intercom", "livechat", "typeform", "surveymonkey", "bitly",
  "ovh", "hetzner", "vultr", "scaleway", "ionos", "woocommerce", "prestashop",
  "jetbrains", "sublimetext", "gitkraken", "sourcetree",
  "huggingface", "kaggle", "elevenlabs", "replit", "codesandbox", "stackblitz",
  "datadog", "newrelic", "dynatrace", "sentry", "grafana", "prometheus", "hashicorp",
  "render", "railway", "flydotio", "glitch", "instapaper", "inoreader", "digg", "slashdot", "ycombinator",

  // --- APPS, FITNESS, DATING & LIFESTYLE ---
  "tinder", "badoo", "okcupid", "strava", "komoot", "alltrails", "tomtom", "here",
  "mapbox", "flightaware", "tradingview", "coinmarketcap", "davinciresolve", "coreldraw",
  "protools", "audacity", "sketch", "framer", "codecademy", "quizlet", "substack",
  "producthunt", "flipboard", "feedly", "coda", "obsidian", "roamresearch",
  "vlcmediaplayer", "bittorrent", "winamp", "kodi", "worldhealthorganization"
];

function cleanAnswer(title: string): string {
  return title
    .replace(/\s+(Inc\.|Inc|Corp\.|Corp|Corporation|Co\.|Co|LLC|Ltd\.|Ltd|GmbH|S\.A\.|SA|S\.L\.|SL)$/i, "")
    .trim();
}

function getCategory(title: string, source: string = ""): string {
  const t = (title + " " + source).toLowerCase();
  if (/airline|airways|\bair\b|flight|hotel|resort|travel|tour|booking|cruise|agoda|expedia|trivago|iata|icao/.test(t)) return "turismo";
  if (/motor|auto\b|cars?\b|racing|vehicle|porsche|ferrari|lamborghini|audi|bmw|toyota|ford|nissan|honda|chevrolet|volvo|scania|iveco|ducati|aston|bentley|bugatti|mclaren|maserati|subaru|citroen|opel|seat|skoda|rolls|dacia|infiniti|polestar|smart|cadillac|chrysler|suzuki|ktm|harley|yamaha|kawasaki|triumph|vespa|piaggio|aprilia|vauxhall|rover|lyft|grab|waze|blablacar/.test(t)) return "automóviles";
  if (/food|restaurant|burger|pizza|bakery|snack|bread|candy|chocolate|cookie|chipotle|kfc|subway|nestle|haribo|carls|justeat|doordash|foodpanda|zomato/.test(t)) return "alimentación";
  if (/drink|beer|brewery|wine|spirits|coffee|cola|tea|beverage|heineken|corona|vodka|whiskey|gin|rum/.test(t)) return "bebidas";
  if (/apparel|clothing|wear|fashion|luxury|shoes|boots|watch|watches|jewelry|eyewear|anta|peakdesign/.test(t)) return "moda";
  if (/sport|sports|fitness|athletics|running|golf|tennis|gym|nba|mlb|nhl|fifa|wwe|ufc|premierleague|dazn|espn|eurosport/.test(t)) return "deportes";
  if (/game|games|gaming|playstation|xbox|nintendo|arcade|esports|ubisoft|capcom|sega|steam|valve|ea|riot|activision|blizzard|konami|square|supercell|cdprojekt|unreal|curseforge|gamemaker|artstation|sketchfab|turbosquid|modrinth|opencritic|igdb|steamdb|protondb/.test(t)) return "videojuegos";
  if (/music|audio|sound|cinema|movie|film|records|entertainment|media|tv|radio|broadcasting|netflix|spotify|disney|warner|imdb|rottentomatoes|letterboxd|vimeo|dailymotion|shazam|soundcloud|deezer|tidal|audible|lastfm|bandcamp|mixcloud|genius|beatport|spreaker|iheartradio|goodreads|animalplanet|antena3|plex|cnn|nbc|cbs|fox|bbc|guardian|newyorktimes|techcrunch|buzzfeed|theweatherchannel|nationalgeographic|discovery|history|time|bloomberg|forbes|wired|theverge/.test(t)) return "entretenimiento";
  if (/social|chat|messenger|community|threads|bluesky|mastodon|signal|line|wechat|viber|tumblr|quora|medium|zoom|teamspeak|bereal|wattpad|disqus|bilibili|weibo|fandom|vk|mailru/.test(t)) return "redes sociales";
  if (/bank|banking|pay|payment|finance|financial|crypto|credit|invest|capital|wealth|insurance|visa|mastercard|paypal|americanexpress|revolut|wise|westernunion|square|klarna|venmo|cashapp|coinbase|binance|deutschebank|barclays|hsbc|monzo|n26|alipay|mercadopago|paysafe|kraken|adyen|afterpay|zelle|nubank|pagseguro|tradingview|coinmarketcap/.test(t)) return "finanzas";
  if (/store|shop|market|supermarket|retail|mall|commerce|ikea|walmart|target|carrefour|ebay|aliexpress|seatgeek|opensea|bigcommerce|etsy|rakuten|mercadolibre|ticketmaster|eventbrite|kickstarter|patreon|fiverr|dribbble|behance|freepik|giphy|unsplash|pixabay|pexels|deviantart|flickr|aldinord|aldisud|shell/.test(t)) return "comercio";
  if (/camera|electronics|mobile|phone|display|semiconductor|hardware|beats|bose|sennheiser|jbl|sonos|motorola|oneplus|oppo|vivo|blackberry|htc|tplink|netgear|ubiquiti|synology|qnap|corsair|steelseries|kingston|seagate|hyperx|garmin|fitbit|razer|msi|qualcomm|broadcom|wacom|nzxt|epson|fujifilm|fujitsu|alcatel|alienware|evga|gigabyte|asrock|zotac|sapphire|elgato|klipsch|marshall|harmankardon|akg|bangolufsen|pioneer|viewsonic|boat|creality|elegoo|havells|fender|gibson|roland|korg|moog|arturia|novation|akai|nativeinstruments|focusrite|shure|audiotechnica|beyerdynamic|rode|presonus|behringer|mackie/.test(t)) return "electrónica";
  if (/delivery|courier|cargo|freight|logistics|express|mail|post|fedex|dhl|ups|boeing|airbus|virgin|abb|3m|irobot/.test(t)) return "transporte";
  return "tecnología";
}

for (const s of curatedSlugs) {
  if (items.length >= 500) break;
  const icon = iconBySlug.get(s);
  if (!icon) continue;
  const id = `brand-${icon.slug}`;
  if (usedIds.has(id)) continue;
  const ans = cleanAnswer(icon.title);
  const norm = normalizeAnswer(ans);
  if (!norm || usedNormalized.has(norm)) continue;

  usedIds.add(id);
  usedNormalized.add(norm);
  items.push({
    id,
    answer: ans,
    aliases: [],
    category: getCategory(ans, icon.source),
    difficulty: (items.length % 3) + 1,
    image: `${id}.png`,
    source: {
      author: ans,
      license: "Marca registrada / Fair Use",
      url: icon.source,
      notes: "Logo oficial optimizado en PNG sobre fondo negro (#000000) con alto contraste."
    }
  });
}

console.log(`[curation] Catálogo total alcanzado: ${items.length} marcas.`);
if (items.length !== 500) {
  console.error(`✗ Error: Se esperaban 500 marcas, pero hay ${items.length}`);
  process.exit(1);
}

// Validar que no haya colisiones
const validationErrors = crossValidate(items);
if (validationErrors.length > 0) {
  console.error("✗ Errores de validación en el catálogo de 500:", validationErrors);
  process.exit(1);
}
console.log("✓ Validación cruzada de 500 marcas superada sin errores (0 colisiones).");

// Renderizado a PNG (512x512 sobre fondo negro)
async function renderLogo(id: string, ans: string): Promise<Buffer> {
  const existingPath = path.join(imagesDir, `${id}.png`);
  if (fs.existsSync(existingPath)) {
    return fs.readFileSync(existingPath);
  }

  const slug = id.replace("brand-", "");
  const icon = iconBySlug.get(slug) || iconBySlug.get(slug.replace(/-/g, ""));

  if (!icon) {
    throw new Error(`Marca ${id} (${ans}) no encontrada en simple-icons`);
  }

  const rawHex = icon.hex;
  const isDark = rawHex === "000000" || rawHex === "111111" || parseInt(rawHex, 16) < 0x282828;
  const color = isDark ? "#ffffff" : `#${rawHex}`;

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 24 24" fill="${color}">
    <path d="${icon.path}"/>
  </svg>`;

  const rendered = await sharp(Buffer.from(svgContent))
    .resize(360, 360, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  return await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 3,
      background: { r: 0, g: 0, b: 0 }
    }
  })
    .composite([{ input: rendered, gravity: "center" }])
    .png()
    .toBuffer();
}

console.log("[render] Generando 500 PNGs en fondo negro...");
for (let i = 0; i < items.length; i++) {
  const it = items[i];
  const pngBuf = await renderLogo(it.id, it.answer);

  fs.writeFileSync(path.join(imagesDir, it.image), pngBuf);
  fs.writeFileSync(path.join(publicLogosDir, it.image), pngBuf);

  if ((i + 1) % 50 === 0 || i + 1 === items.length) {
    console.log(`✓ Procesadas ${i + 1}/${items.length} imágenes...`);
  }
}

// Guardar manifest.json
fs.writeFileSync(currentManifestPath, JSON.stringify({ pack: "marcas-reales-500", items }, null, 2) + "\n");
console.log(`✓ Manifiesto guardado en ${currentManifestPath} (${items.length} marcas).`);

// Exportar brands.ts para la app cliente web y /demo
const clientBrands = items.map((it) => ({
  id: it.id,
  name: it.answer,
  category: it.category.charAt(0).toUpperCase() + it.category.slice(1),
  image: `/logos/${it.image}`,
  aliases: it.aliases,
}));

const brandsTsPath = path.resolve(__dirname, "../../../src/game/brands.ts");
const brandsTsCode = `export interface RealBrand {
  id: string;
  name: string;
  category: string;
  image: string;
  aliases: string[];
}

export const ALL_BRANDS: RealBrand[] = ${JSON.stringify(clientBrands, null, 2)};
`;
fs.writeFileSync(brandsTsPath, brandsTsCode);
console.log(`✓ Catálogo cliente generado en ${brandsTsPath} (${clientBrands.length} marcas).`);
