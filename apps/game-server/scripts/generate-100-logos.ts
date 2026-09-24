import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import * as si from "simple-icons";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demoDir = path.resolve(__dirname, "../content/demo");
const imagesDir = path.join(demoDir, "images");
const publicLogosDir = path.resolve(__dirname, "../../../public/logos");
const localLogosDir = path.resolve(__dirname, "../../../public/logos");

fs.mkdirSync(imagesDir, { recursive: true });
fs.mkdirSync(publicLogosDir, { recursive: true });

interface BrandDef {
  id: string;
  answer: string;
  aliases: string[];
  category: string;
  difficulty: number;
  simpleIconKey?: string;
  localSvg?: string;
  customColor?: string;
}

// Lista curada de 100 marcas globales hiper-reconocibles
const BRANDS: BrandDef[] = [
  // 1-15: Las 15 clásicas de inicio (con soporte para SVGs locales multicolores donde aplique)
  { id: "brand-apple", answer: "Apple", aliases: ["Apple Inc", "Apple Computer"], category: "tecnología", difficulty: 1, simpleIconKey: "siApple", customColor: "#ffffff" },
  { id: "brand-nike", answer: "Nike", aliases: ["Nike Inc"], category: "deportes", difficulty: 1, simpleIconKey: "siNike", customColor: "#ffffff" },
  { id: "brand-google", answer: "Google", aliases: ["Alphabet"], category: "tecnología", difficulty: 1, localSvg: "google.svg", simpleIconKey: "siGoogle" },
  { id: "brand-mcdonalds", answer: "McDonald's", aliases: ["MacDonalds"], category: "alimentación", difficulty: 1, localSvg: "mcdonalds.svg", simpleIconKey: "siMcdonalds" },
  { id: "brand-coca-cola", answer: "Coca-Cola", aliases: ["Coke"], category: "bebidas", difficulty: 1, localSvg: "coca-cola.svg", simpleIconKey: "siCocacola" },
  { id: "brand-spotify", answer: "Spotify", aliases: [], category: "música", difficulty: 1, localSvg: "spotify.svg", simpleIconKey: "siSpotify", customColor: "#1ED760" },
  { id: "brand-amazon", answer: "Amazon", aliases: ["Amazon.com"], category: "comercio", difficulty: 1, localSvg: "amazon.svg" },
  { id: "brand-microsoft", answer: "Microsoft", aliases: ["MSFT"], category: "tecnología", difficulty: 1, localSvg: "microsoft.svg" },
  { id: "brand-starbucks", answer: "Starbucks", aliases: ["Starbucks Coffee"], category: "hostelería", difficulty: 2, localSvg: "starbucks.svg", simpleIconKey: "siStarbucks" },
  { id: "brand-netflix", answer: "Netflix", aliases: [], category: "entretenimiento", difficulty: 1, localSvg: "netflix.svg", simpleIconKey: "siNetflix" },
  { id: "brand-tesla", answer: "Tesla", aliases: ["Tesla Motors"], category: "automóviles", difficulty: 2, localSvg: "tesla.svg", simpleIconKey: "siTesla" },
  { id: "brand-adidas", answer: "Adidas", aliases: [], category: "deportes", difficulty: 1, simpleIconKey: "siAdidas", customColor: "#ffffff" },
  { id: "brand-pepsi", answer: "Pepsi", aliases: ["Pepsi-Cola"], category: "bebidas", difficulty: 1, localSvg: "pepsi.svg" },
  { id: "brand-youtube", answer: "YouTube", aliases: [], category: "vídeo", difficulty: 1, localSvg: "youtube.svg", simpleIconKey: "siYoutube" },
  { id: "brand-instagram", answer: "Instagram", aliases: ["Insta", "IG"], category: "redes sociales", difficulty: 1, localSvg: "instagram.svg", simpleIconKey: "siInstagram" },

  // 16-30: Redes Sociales, Comunicación y Streaming
  { id: "brand-meta", answer: "Meta", aliases: ["Facebook"], category: "redes sociales", difficulty: 1, simpleIconKey: "siMeta" },
  { id: "brand-x", answer: "X", aliases: ["Twitter"], category: "redes sociales", difficulty: 1, simpleIconKey: "siX", customColor: "#ffffff" },
  { id: "brand-whatsapp", answer: "WhatsApp", aliases: [], category: "comunicación", difficulty: 1, simpleIconKey: "siWhatsapp" },
  { id: "brand-tiktok", answer: "TikTok", aliases: [], category: "redes sociales", difficulty: 1, simpleIconKey: "siTiktok", customColor: "#ffffff" },
  { id: "brand-telegram", answer: "Telegram", aliases: [], category: "comunicación", difficulty: 1, simpleIconKey: "siTelegram" },
  { id: "brand-discord", answer: "Discord", aliases: [], category: "comunicación", difficulty: 1, simpleIconKey: "siDiscord" },
  { id: "brand-twitch", answer: "Twitch", aliases: [], category: "streaming", difficulty: 1, simpleIconKey: "siTwitch" },
  { id: "brand-snapchat", answer: "Snapchat", aliases: [], category: "redes sociales", difficulty: 1, simpleIconKey: "siSnapchat" },
  { id: "brand-reddit", answer: "Reddit", aliases: [], category: "redes sociales", difficulty: 1, simpleIconKey: "siReddit" },
  { id: "brand-pinterest", answer: "Pinterest", aliases: [], category: "redes sociales", difficulty: 2, simpleIconKey: "siPinterest" },
  { id: "brand-uber-eats", answer: "Uber Eats", aliases: ["Uber Food"], category: "alimentación", difficulty: 1, simpleIconKey: "siUbereats" },
  { id: "brand-zoom", answer: "Zoom", aliases: [], category: "software", difficulty: 1, simpleIconKey: "siZoom" },
  { id: "brand-dropbox", answer: "Dropbox", aliases: [], category: "software", difficulty: 2, simpleIconKey: "siDropbox" },
  { id: "brand-github", answer: "GitHub", aliases: [], category: "software", difficulty: 2, simpleIconKey: "siGithub", customColor: "#ffffff" },
  { id: "brand-gitlab", answer: "GitLab", aliases: [], category: "software", difficulty: 2, simpleIconKey: "siGitlab" },

  // 31-45: Automoción y Motor
  { id: "brand-bmw", answer: "BMW", aliases: [], category: "automóviles", difficulty: 1, simpleIconKey: "siBmw" },
  { id: "brand-audi", answer: "Audi", aliases: [], category: "automóviles", difficulty: 1, simpleIconKey: "siAudi", customColor: "#ffffff" },
  { id: "brand-ferrari", answer: "Ferrari", aliases: [], category: "automóviles", difficulty: 1, simpleIconKey: "siFerrari" },
  { id: "brand-porsche", answer: "Porsche", aliases: [], category: "automóviles", difficulty: 2, simpleIconKey: "siPorsche", customColor: "#ffffff" },
  { id: "brand-toyota", answer: "Toyota", aliases: [], category: "automóviles", difficulty: 1, simpleIconKey: "siToyota" },
  { id: "brand-ford", answer: "Ford", aliases: [], category: "automóviles", difficulty: 1, simpleIconKey: "siFord" },
  { id: "brand-honda", answer: "Honda", aliases: [], category: "automóviles", difficulty: 1, simpleIconKey: "siHonda" },
  { id: "brand-volkswagen", answer: "Volkswagen", aliases: ["VW"], category: "automóviles", difficulty: 1, simpleIconKey: "siVolkswagen" },
  { id: "brand-hyundai", answer: "Hyundai", aliases: [], category: "automóviles", difficulty: 2, simpleIconKey: "siHyundai" },
  { id: "brand-nissan", answer: "Nissan", aliases: [], category: "automóviles", difficulty: 1, simpleIconKey: "siNissan" },
  { id: "brand-mazda", answer: "Mazda", aliases: [], category: "automóviles", difficulty: 2, simpleIconKey: "siMazda", customColor: "#ffffff" },
  { id: "brand-renault", answer: "Renault", aliases: [], category: "automóviles", difficulty: 2, simpleIconKey: "siRenault", customColor: "#ffffff" },
  { id: "brand-peugeot", answer: "Peugeot", aliases: [], category: "automóviles", difficulty: 2, simpleIconKey: "siPeugeot", customColor: "#ffffff" },
  { id: "brand-volvo", answer: "Volvo", aliases: [], category: "automóviles", difficulty: 2, simpleIconKey: "siVolvo", customColor: "#ffffff" },
  { id: "brand-jeep", answer: "Jeep", aliases: [], category: "automóviles", difficulty: 2, simpleIconKey: "siJeep", customColor: "#ffffff" },
  { id: "brand-lamborghini", answer: "Lamborghini", aliases: [], category: "automóviles", difficulty: 2, simpleIconKey: "siLamborghini" },
  { id: "brand-chevrolet", answer: "Chevrolet", aliases: ["Chevy"], category: "automóviles", difficulty: 2, simpleIconKey: "siChevrolet" },
  { id: "brand-suzuki", answer: "Suzuki", aliases: [], category: "automóviles", difficulty: 2, simpleIconKey: "siSuzuki" },

  // 49-63: Electrónica, Computación y Hardware
  { id: "brand-samsung", answer: "Samsung", aliases: [], category: "electrónica", difficulty: 1, simpleIconKey: "siSamsung" },
  { id: "brand-sony", answer: "Sony", aliases: [], category: "electrónica", difficulty: 1, simpleIconKey: "siSony", customColor: "#ffffff" },
  { id: "brand-intel", answer: "Intel", aliases: [], category: "tecnología", difficulty: 1, simpleIconKey: "siIntel" },
  { id: "brand-nvidia", answer: "Nvidia", aliases: [], category: "tecnología", difficulty: 1, simpleIconKey: "siNvidia" },
  { id: "brand-amd", answer: "AMD", aliases: [], category: "tecnología", difficulty: 2, simpleIconKey: "siAmd" },
  { id: "brand-dell", answer: "Dell", aliases: [], category: "tecnología", difficulty: 1, simpleIconKey: "siDell" },
  { id: "brand-hp", answer: "HP", aliases: ["Hewlett Packard"], category: "tecnología", difficulty: 1, simpleIconKey: "siHp" },
  { id: "brand-lenovo", answer: "Lenovo", aliases: [], category: "tecnología", difficulty: 2, simpleIconKey: "siLenovo" },
  { id: "brand-lg", answer: "LG", aliases: ["Lucky Goldstar"], category: "electrónica", difficulty: 1, simpleIconKey: "siLg" },
  { id: "brand-panasonic", answer: "Panasonic", aliases: [], category: "electrónica", difficulty: 2, simpleIconKey: "siPanasonic", customColor: "#ffffff" },
  { id: "brand-asus", answer: "Asus", aliases: [], category: "tecnología", difficulty: 2, simpleIconKey: "siAsus", customColor: "#ffffff" },
  { id: "brand-acer", answer: "Acer", aliases: [], category: "tecnología", difficulty: 2, simpleIconKey: "siAcer" },
  { id: "brand-xiaomi", answer: "Xiaomi", aliases: ["Mi"], category: "electrónica", difficulty: 2, simpleIconKey: "siXiaomi" },
  { id: "brand-huawei", answer: "Huawei", aliases: [], category: "tecnología", difficulty: 2, simpleIconKey: "siHuawei" },
  { id: "brand-nokia", answer: "Nokia", aliases: [], category: "telecomunicaciones", difficulty: 2, simpleIconKey: "siNokia", customColor: "#ffffff" },
  { id: "brand-cisco", answer: "Cisco", aliases: [], category: "tecnología", difficulty: 2, simpleIconKey: "siCisco" },
  { id: "brand-siemens", answer: "Siemens", aliases: [], category: "tecnología", difficulty: 2, simpleIconKey: "siSiemens", customColor: "#00A3A6" },
  { id: "brand-bosch", answer: "Bosch", aliases: [], category: "tecnología", difficulty: 2, simpleIconKey: "siBosch" },

  // 67-80: Videojuegos y Entretenimiento
  { id: "brand-playstation", answer: "PlayStation", aliases: ["PS5", "PS4", "Sony PlayStation"], category: "videojuegos", difficulty: 1, simpleIconKey: "siPlaystation", customColor: "#ffffff" },
  { id: "brand-steam", answer: "Steam", aliases: ["Valve Steam"], category: "videojuegos", difficulty: 1, simpleIconKey: "siSteam", customColor: "#ffffff" },
  { id: "brand-epic-games", answer: "Epic Games", aliases: [], category: "videojuegos", difficulty: 2, simpleIconKey: "siEpicgames", customColor: "#ffffff" },
  { id: "brand-sega", answer: "Sega", aliases: [], category: "videojuegos", difficulty: 2, simpleIconKey: "siSega" },
  { id: "brand-atari", answer: "Atari", aliases: [], category: "videojuegos", difficulty: 3, simpleIconKey: "siAtari" },
  { id: "brand-ubisoft", answer: "Ubisoft", aliases: [], category: "videojuegos", difficulty: 2, simpleIconKey: "siUbisoft", customColor: "#ffffff" },
  { id: "brand-rockstar", answer: "Rockstar Games", aliases: ["Rockstar"], category: "videojuegos", difficulty: 1, simpleIconKey: "siRockstargames" },
  { id: "brand-unity", answer: "Unity", aliases: [], category: "videojuegos", difficulty: 2, simpleIconKey: "siUnity", customColor: "#ffffff" },
  { id: "brand-roblox", answer: "Roblox", aliases: [], category: "videojuegos", difficulty: 1, simpleIconKey: "siRoblox", customColor: "#ffffff" },

  // 76-88: Restauración, Alimentación y Bebidas
  { id: "brand-burger-king", answer: "Burger King", aliases: ["BK"], category: "alimentación", difficulty: 1, simpleIconKey: "siBurgerking" },
  { id: "brand-kfc", answer: "KFC", aliases: ["Kentucky Fried Chicken"], category: "alimentación", difficulty: 1, simpleIconKey: "siKfc" },
  { id: "brand-taco-bell", answer: "Taco Bell", aliases: [], category: "alimentación", difficulty: 2, simpleIconKey: "siTacobell" },
  { id: "brand-red-bull", answer: "Red Bull", aliases: [], category: "bebidas", difficulty: 1, simpleIconKey: "siRedbull" },
  { id: "brand-monster", answer: "Monster Energy", aliases: ["Monster"], category: "bebidas", difficulty: 1, simpleIconKey: "siMonster" },
  { id: "brand-deliveroo", answer: "Deliveroo", aliases: [], category: "alimentación", difficulty: 2, simpleIconKey: "siDeliveroo" },
  { id: "brand-glovo", answer: "Glovo", aliases: [], category: "alimentación", difficulty: 2, simpleIconKey: "siGlovo" },

  // 83-93: Moda, Calzado y Deportes
  { id: "brand-puma", answer: "Puma", aliases: [], category: "deportes", difficulty: 1, simpleIconKey: "siPuma", customColor: "#ffffff" },
  { id: "brand-under-armour", answer: "Under Armour", aliases: [], category: "deportes", difficulty: 2, simpleIconKey: "siUnderarmour", customColor: "#ffffff" },
  { id: "brand-reebok", answer: "Reebok", aliases: [], category: "deportes", difficulty: 2, simpleIconKey: "siReebok" },
  { id: "brand-new-balance", answer: "New Balance", aliases: ["NB"], category: "deportes", difficulty: 2, simpleIconKey: "siNewbalance" },
  { id: "brand-zara", answer: "Zara", aliases: ["Inditex"], category: "moda", difficulty: 1, simpleIconKey: "siZara", customColor: "#ffffff" },
  { id: "brand-hm", answer: "H&M", aliases: ["H and M"], category: "moda", difficulty: 1, simpleIconKey: "siHandm" },

  // 89-100: Servicios, Viajes, Finanzas y Comercio
  { id: "brand-uber", answer: "Uber", aliases: [], category: "transporte", difficulty: 1, simpleIconKey: "siUber", customColor: "#ffffff" },
  { id: "brand-airbnb", answer: "Airbnb", aliases: [], category: "turismo", difficulty: 1, simpleIconKey: "siAirbnb" },
  { id: "brand-booking", answer: "Booking", aliases: ["Booking.com"], category: "turismo", difficulty: 1, simpleIconKey: "siBookingdotcom" },
  { id: "brand-tripadvisor", answer: "Tripadvisor", aliases: [], category: "turismo", difficulty: 2, simpleIconKey: "siTripadvisor" },
  { id: "brand-visa", answer: "Visa", aliases: [], category: "finanzas", difficulty: 1, simpleIconKey: "siVisa", customColor: "#ffffff" },
  { id: "brand-mastercard", answer: "Mastercard", aliases: [], category: "finanzas", difficulty: 1, simpleIconKey: "siMastercard" },
  { id: "brand-paypal", answer: "PayPal", aliases: [], category: "finanzas", difficulty: 1, simpleIconKey: "siPaypal" },
  { id: "brand-stripe", answer: "Stripe", aliases: [], category: "finanzas", difficulty: 2, simpleIconKey: "siStripe" },
  { id: "brand-ebay", answer: "eBay", aliases: [], category: "comercio", difficulty: 1, simpleIconKey: "siEbay" },
  { id: "brand-aliexpress", answer: "AliExpress", aliases: ["Alibaba"], category: "comercio", difficulty: 2, simpleIconKey: "siAliexpress" },
  { id: "brand-shopify", answer: "Shopify", aliases: [], category: "comercio", difficulty: 2, simpleIconKey: "siShopify" },
  { id: "brand-ikea", answer: "IKEA", aliases: [], category: "hogar", difficulty: 1, simpleIconKey: "siIkea" },
  { id: "brand-tinder", answer: "Tinder", aliases: [], category: "redes sociales", difficulty: 1, simpleIconKey: "siTinder" },
  { id: "brand-duolingo", answer: "Duolingo", aliases: [], category: "educación", difficulty: 1, simpleIconKey: "siDuolingo" },
  { id: "brand-shazam", answer: "Shazam", aliases: [], category: "música", difficulty: 2, simpleIconKey: "siShazam" },
  { id: "brand-soundcloud", answer: "SoundCloud", aliases: [], category: "música", difficulty: 2, simpleIconKey: "siSoundcloud" },
  { id: "brand-deezer", answer: "Deezer", aliases: [], category: "música", difficulty: 2, simpleIconKey: "siDeezer", customColor: "#ffffff" },
];

console.log(`[curation] Curadas ${BRANDS.length} marcas para PeekRush.`);

if (BRANDS.length < 100) {
  console.error(`Error: se requieren al menos 100 marcas, se definieron ${BRANDS.length}`);
  process.exit(1);
}

// Mantener exactamente las primeras 100 marcas
const FINAL_100 = BRANDS.slice(0, 100);

async function renderBrandToPng(b: BrandDef): Promise<Buffer> {
  let svgContent: string;

  // 1. Si tenemos un SVG local multicolor o específico, usarlo con reemplazo de negros por blanco
  if (b.localSvg && fs.existsSync(path.join(localLogosDir, b.localSvg))) {
    let raw = fs.readFileSync(path.join(localLogosDir, b.localSvg), "utf8");
    // Convertir textos o rellenos negros a blanco para contraste en fondo negro
    raw = raw.replace(/#221f1f/gi, "#ffffff")
             .replace(/fill="#000000"/gi, 'fill="#ffffff"')
             .replace(/fill="#000"/gi, 'fill="#ffffff"')
             .replace(/fill="black"/gi, 'fill="#ffffff"')
             .replace(/style="fill:#000"/gi, 'style="fill:#ffffff"')
             .replace(/style="fill:#000000"/gi, 'style="fill:#ffffff"');
    svgContent = raw;
  } else if (b.simpleIconKey && (si as any)[b.simpleIconKey]) {
    const icon = (si as any)[b.simpleIconKey];
    let color = b.customColor;
    if (!color) {
      const isDark = icon.hex === "000000" || icon.hex === "111111" || parseInt(icon.hex, 16) < 0x252525;
      color = isDark ? "#ffffff" : `#${icon.hex}`;
    }
    svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 24 24" fill="${color}">
      ${icon.svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "")}
    </svg>`;
  } else {
    throw new Error(`Marca ${b.id} sin fuente de icono disponible`);
  }

  // Renderizar a 360x360 transparente dentro de 512x512 con fondo negro puro #000000
  const rendered = await sharp(Buffer.from(svgContent))
    .resize(360, 360, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const finalPng = await sharp({
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

  // Validación de luminosidad y contraste
  const stats = await sharp(finalPng).stats();
  const maxMean = Math.max(...stats.channels.map(c => c.mean));
  if (maxMean < 2) {
    console.warn(`[warning] El logo ${b.id} (${b.answer}) tiene muy poco contraste (maxMean: ${maxMean.toFixed(2)})`);
  }

  return finalPng;
}

const manifestItems = [];

for (const [idx, b] of FINAL_100.entries()) {
  const fileName = `${b.id}.png`;
  const pngBuffer = await renderBrandToPng(b);

  // Guardar en content/demo/images/
  fs.writeFileSync(path.join(imagesDir, fileName), pngBuffer);

  // Guardar en public/logos/
  fs.writeFileSync(path.join(publicLogosDir, fileName), pngBuffer);

  manifestItems.push({
    id: b.id,
    answer: b.answer,
    aliases: b.aliases,
    category: b.category,
    difficulty: b.difficulty,
    image: fileName,
    source: {
      author: b.answer,
      license: "Marca registrada / Fair Use",
      notes: `Logo oficial optimizado en PNG sobre fondo negro (#000000) con alto contraste.`
    }
  });

  if ((idx + 1) % 20 === 0 || idx + 1 === FINAL_100.length) {
    console.log(`✓ Procesadas ${idx + 1}/${FINAL_100.length} marcas...`);
  }
}

// Escribir el nuevo manifest.json
const manifestPath = path.join(demoDir, "manifest.json");
fs.writeFileSync(manifestPath, JSON.stringify({ pack: "marcas-reales-100", items: manifestItems }, null, 2) + "\n");
console.log(`\n🎉 Manifiesto de 100 marcas guardado con éxito en: ${manifestPath}`);
