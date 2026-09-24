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

// 1. Cargar las 500 marcas ya verificadas existentes
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

// Lista de slugs prioritarios para las siguientes marcas globales
const prioritySlugs = [
  // Automoción & Transporte
  "generalmotors", "toyota", "honda", "nissan", "ford", "hyundai", "kia", "bmw", "audi",
  "volkswagen", "volvo", "mazda", "subaru", "suzuki", "mitsubishi", "peugeot", "renault",
  "citroen", "fiat", "opel", "seat", "skoda", "dacia", "infiniti", "lexus", "acura",
  "cadillac", "buick", "gmc", "chrysler", "dodge", "ram", "jeep", "maserati", "ferrari",
  "lamborghini", "porsche", "bentley", "rollsroyce", "astonmartin", "bugatti", "mclaren",
  "koenigsegg", "polestar", "genesis", "smart", "mini", "jaguar", "landrover", "scania",
  "man", "iveco", "daf", "harleydavidson", "ducati", "ktm", "kawasaki", "triumph",
  "vespa", "piaggio", "aprilia", "husqvarna", "kymco", "hero", "bajaj", "tvs",
  "sixt", "hertz", "avis", "europcar", "enterprise", "budget", "blablacar", "cabify",
  "bolt", "uber", "lyft", "grab", "waze", "boeing", "airbus",
  // Aerolíneas
  "delta", "americanairlines", "unitedairlines", "southwestairlines", "alaskaairlines",
  "jetblue", "spiritairlines", "flyfrontier", "hawaiianairlines", "aircanada", "westjet",
  "aeromexico", "volaris", "copaairlines", "avianca", "latamairlines", "gol", "azul",
  "britishairways", "easyjet", "virginatlantic", "ryanair", "aerlingus", "lufthansa",
  "swiss", "austrianairlines", "eurowings", "brusselsairlines", "airfrance", "klm",
  "transavia", "iberia", "vueling", "aireuropa", "tapairportugal", "sas", "norwegian",
  "finnair", "icelandair", "wizzair", "lotpolishairlines", "turkishairlines", "pegasusairlines",
  "aeroflot", "emirates", "etihadairways", "qatarairways", "flydubai", "saudia", "gulfair",
  "omanair", "singaporeairlines", "scoot", "malaysiaairlines", "airasia", "garudaindonesia",
  "thaiairways", "vietnamairlines", "philippineairlines", "qantas", "jetstar", "virginaustralia",
  "airnewzealand", "airchina", "chinaeasternairlines", "chinasouthernairlines", "hainanairlines",
  "cathaypacific", "japanairlines", "ana", "koreanair", "asianaairlines", "airindia", "indigo",
  // Hoteles & Turismo
  "marriott", "hilton", "hyatt", "ihg", "accor", "wyndham", "radisson", "fourseasons",
  "trivago", "expedia", "bookingdotcom", "agoda", "kayak", "skyscanner", "tripadvisor", "hostelworld",
  // Alimentación, Bebidas & Restauración
  "mcdonalds", "burgerking", "kfc", "pizzahut", "dominos", "papajohns", "subway", "starbucks",
  "costacoffee", "dunkin", "timhortons", "chipotle", "tacobell", "popeyes", "carlsjr", "arbys",
  "dairyqueen", "sonicdrivein", "jackinthebox", "fiveguys", "shakeshack", "pandaexpress",
  "nandos", "pretamanger", "cocacola", "pepsi", "drpepper", "mountaindew", "sprite", "fanta",
  "sevenup", "schweppes", "redbull", "monsterenergy", "gatorade", "powerade", "heineken",
  "budweiser", "corona", "stellaartois", "guinness", "carlsberg", "amstel", "peroni",
  "sanmiguel", "mahou", "estrellagalicia", "bacardi", "smirnoff", "absolut", "jackdaniels",
  "johnniewalker", "chivasregal", "jameson", "baileys", "jagermeister", "campari", "aperol",
  "martini", "nestle", "danone", "kelloggs", "generalmills", "kraftheinz", "mondelez",
  "ferrero", "lindt", "haribo", "chupachups", "mars", "snickers", "twix", "mms", "oreo",
  "pringles", "doritos", "lays", "cheetos", "ruffles", "barilla",
  // Retail & Comercio
  "walmart", "target", "costco", "carrefour", "lidl", "aldi", "aldinord", "aldisud", "auchan",
  "tesco", "sainsburys", "asda", "mercadona", "dia", "eroski", "elcorteingles", "leroymerlin",
  "decathlon", "mediamarkt", "fnac", "ikea", "amazon", "ebay", "aliexpress", "alibaba",
  "temu", "shein", "shopee", "lazada", "rakuten", "mercadolibre", "etsy", "zalando", "asos",
  // Electrónica, Audio & Hardware
  "sony", "samsung", "lg", "panasonic", "philips", "toshiba", "sharp", "hitachi", "nec",
  "fujitsu", "epson", "brother", "canon", "nikon", "olympus", "leica", "polaroid", "anker",
  "belkin", "irobot", "dyson", "braun", "delonghi", "whirlpool", "electrolux", "haier",
  "hisense", "tcl", "denon", "marantz", "onkyo", "yamahacorporation", "casio", "citizen",
  "seiko", "fossil", "swatch", "tissot", "bose", "jbl", "beats", "sennheiser", "sonos",
  "garmin", "fitbit", "gopro", "marshall", "harmankardon", "akg", "bangolufsen", "pioneer",
  // Moda & Lujo
  "nike", "adidas", "puma", "reebok", "underarmour", "newbalance", "asics", "mizuno",
  "salomon", "hoka", "skechers", "vans", "converse", "fila", "champion", "columbia",
  "thenorthface", "patagonia", "timberland", "drmartens", "clarks", "crocs", "levis",
  "diesel", "calvinklein", "tommyhilfiger", "ralphlauren", "lacoste", "hugoboss",
  "abercrombie", "gap", "uniqlo", "zara", "pullandbear", "massimodutti", "bershka",
  "stradivarius", "hm", "mango", "primark", "benetton", "desigual", "gucci", "prada",
  "chanel", "hermes", "dior", "balenciaga", "fendi", "valentino", "versace", "armani",
  "burberry", "cartier", "tiffanyandco", "rolex", "omega", "tagheuer", "breitling",
  "rayban", "oakley",
  // Telecomunicaciones
  "verizon", "att", "tmobile", "vodafone", "orange", "telefonica", "movistar", "o2", "ee",
  "deutschetelekom", "bt", "virginmedia", "sky", "sfr", "free", "iliad", "tim", "swisscom",
  "kpn", "proximus", "telia", "nttdocomo", "softbank", "airtel", "jio", "telstra",
  // Videojuegos & Entretenimiento
  "nintendo", "playstation", "xbox", "steam", "epicgames", "ea", "electronicarts",
  "ubisoft", "activision", "blizzard", "bethesda", "rockstargames", "2k", "squareenix",
  "capcom", "konami", "bandainamco", "sega", "atari", "cdprojekt", "valve", "riotgames",
  "supercell", "mojang", "disney", "warnerbros", "paramount", "universal", "netflix",
  "hulu", "hbo", "peacock", "crunchyroll", "plutotv", "roku", "bbc", "cnn", "nbc", "cbs",
  "fox", "bloomberg", "reuters", "theguardian", "newyorktimes", "time", "forbes", "wired",
  "nationalgeographic", "discovery", "ign", "spotify", "apple", "google", "microsoft"
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

// Añadir primero los prioritarios si están disponibles
for (const s of prioritySlugs) {
  if (items.length >= 1000) break;
  const icon = iconBySlug.get(s);
  if (!icon) continue;
  const cleanSlug = icon.slug.replace(/_/g, "-");
  const id = `brand-${cleanSlug}`;
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

// Completar hasta 1000 con empresas comerciales reales con web oficial
const devRegex = /(compiler|linter|parser|framework|library|plugin|sdk|api|middleware|driver|bundler|syntax|orm|database|kernel|schema|protocol|engine|runtime|toolkit|action|workflow|specification|theme|template|algorithm|extension|hook|component|boilerplate|starter|scaffold)/i;

const blacklistSlugs = new Set([
  'react', 'vuedotjs', 'angular', 'svelte', 'solid', 'nextdotjs', 'nuxt', 'express',
  'fastify', 'nestjs', 'django', 'flask', 'rubyonrails', 'laravel', 'spring', 'springboot',
  'dotnet', 'cplusplus', 'csharp', 'c', 'python', 'javascript', 'typescript', 'go', 'rust',
  'php', 'ruby', 'java', 'kotlin', 'swift', 'scala', 'elixir', 'clojure', 'dart', 'r',
  'html5', 'css3', 'sass', 'less', 'postcss', 'tailwindcss', 'bootstrap', 'bulma',
  'webpack', 'vite', 'rollupdotjs', 'esbuild', 'turborepo', 'babel', 'swc', 'eslint',
  'prettier', 'stylelint', 'jest', 'vitest', 'cypress', 'playwright', 'puppeteer', 'selenium',
  'mocha', 'jasmine', 'pytest', 'junit5', 'git', 'githubactions', 'gitlab', 'jenkins',
  'circleci', 'travisci', 'docker', 'kubernetes', 'helm', 'ansible', 'terraform', 'puppet',
  'chef', 'vagrant', 'consul', 'vault', 'nomad', 'rabbitmq', 'apachekafka', 'redis',
  'postgresql', 'mysql', 'mariadb', 'sqlite', 'mongodb', 'couchbase', 'cassandra',
  'elasticsearch', 'opensearch', 'neo4j', 'influxdb', 'graphql', 'rest', 'json', 'yaml',
  'xml', 'markdown', 'npm', 'yarn', 'pnpm', 'pip', 'cargo', 'gem', 'composer', 'nuget',
  'homebrew', 'linux', 'ubuntu', 'debian', 'archlinux', 'fedora', 'centos', 'redhat',
  'alpinelinux', 'kalilinux', 'gnubash', 'zsh', 'fishshell', 'powershell', 'apache',
  'nginx', 'caddy', 'traefik', 'envoyproxy', 'haproxy', 'postman', 'insomnia', 'wireshark',
  'virtualbox', 'vmware', 'qemu', 'wine', 'neovim', 'vim', 'emacs', 'visualstudiocode'
]);

const allIcons = Object.values(si).filter((x: any) => x && x.slug);

for (const icon of allIcons as any[]) {
  if (items.length >= 1000) break;
  if (blacklistSlugs.has(icon.slug)) continue;
  const s = (icon.source || "").toLowerCase();
  const t = icon.title;
  if (!s.startsWith("http")) continue;
  if (s.includes("github.com") || s.includes("gitlab.com") || s.includes("npmjs.com") || s.includes("pypi.org") || s.includes("packagist.org")) continue;
  if (icon.slug.endsWith("js") || icon.slug.endsWith("ts") || icon.slug.endsWith("css") || icon.slug.endsWith("dotjs")) continue;
  if (devRegex.test(t)) continue;

  const cleanSlug = icon.slug.replace(/_/g, "-");
  const id = `brand-${cleanSlug}`;
  if (usedIds.has(id)) continue;
  const ans = cleanAnswer(t);
  if (ans.length < 2 || ans.length > 35) continue;
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
if (items.length !== 1000) {
  console.error(`✗ Error: Se esperaban 1000 marcas, pero hay ${items.length}`);
  process.exit(1);
}

// Validar que no haya colisiones
const validationErrors = crossValidate(items);
if (validationErrors.length > 0) {
  console.error("✗ Errores de validación en el catálogo de 1000:", validationErrors);
  process.exit(1);
}
console.log("✓ Validación cruzada de 1000 marcas superada sin errores (0 colisiones).");

// Renderizado a PNG (512x512 sobre fondo negro)
async function renderLogo(id: string, ans: string): Promise<Buffer> {
  const existingPath = path.join(imagesDir, `${id}.png`);
  if (fs.existsSync(existingPath)) {
    return fs.readFileSync(existingPath);
  }

  const slug = id.replace("brand-", "");
  const icon =
    iconBySlug.get(slug) ||
    iconBySlug.get(slug.replace(/-/g, "_")) ||
    iconBySlug.get(slug.replace(/-/g, ""));

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

console.log("[render] Generando o verificando 1000 PNGs en fondo negro...");
for (let i = 0; i < items.length; i++) {
  const it = items[i];
  const pngBuf = await renderLogo(it.id, it.answer);

  fs.writeFileSync(path.join(imagesDir, it.image), pngBuf);
  fs.writeFileSync(path.join(publicLogosDir, it.image), pngBuf);

  if ((i + 1) % 100 === 0 || i + 1 === items.length) {
    console.log(`✓ Procesadas ${i + 1}/${items.length} imágenes...`);
  }
}

// Guardar manifest.json
fs.writeFileSync(currentManifestPath, JSON.stringify({ pack: "marcas-reales-1000", items }, null, 2) + "\n");
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
