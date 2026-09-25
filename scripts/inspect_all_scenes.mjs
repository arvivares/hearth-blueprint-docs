import puppeteer from '/root/.gemini/config/skills/hand-drawn-canvas-animation/scripts/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'path';

const ARTIFACTS_DIR = '/root/.gemini/antigravity-cli/brain/92f65d64-900b-4574-9eac-65c00bac0c1e';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-gpu'],
    defaultViewport: { width: 1366, height: 960, deviceScaleFactor: 2 },
  });

  const page = await browser.newPage();
  console.log('Navigating to https://peekrush.inmerzion.io ...');
  await page.goto('https://peekrush.inmerzion.io', { waitUntil: 'networkidle2' });

  await new Promise(r => setTimeout(r, 1200));

  // 1. Capture Full Hero Section
  const heroPath = path.join(ARTIFACTS_DIR, 'peekrush_hero_2col_verified.png');
  await page.screenshot({ path: heroPath });
  console.log(`Saved hero screenshot: ${heroPath}`);

  // 2. Capture Each Scene in Canvas
  const scenes = [
    { name: '01 · La Tele', file: 'peekrush_scene0_tv_v3.png', btnMatch: 'La Tele' },
    { name: '02 · Tu Móvil', file: 'peekrush_scene1_mobile_v3.png', btnMatch: 'Tu Móvil' },
    { name: '03 · Modo Solo', file: 'peekrush_scene2_solo_v3.png', btnMatch: 'Modo Solo' },
    { name: '04 · Multiplicador', file: 'peekrush_scene3_multiplier_v3.png', btnMatch: 'Multiplicador' },
    { name: '05 · Podio', file: 'peekrush_scene4_podium_v3.png', btnMatch: 'Podio' },
  ];

  for (const s of scenes) {
    console.log(`Selecting scene: ${s.name} ...`);
    await page.evaluate((match) => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent?.includes(match));
      if (btn) btn.click();
    }, s.btnMatch);

    await new Promise(r => setTimeout(r, 700));

    const canvasElement = await page.$('canvas');
    if (canvasElement) {
      const outPath = path.join(ARTIFACTS_DIR, s.file);
      await canvasElement.screenshot({ path: outPath });
      console.log(`Saved screenshot: ${outPath}`);
    }
  }

  await browser.close();
  console.log('All production screenshots captured successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
