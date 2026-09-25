import puppeteer from '/root/.gemini/config/skills/hand-drawn-canvas-animation/scripts/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'path';

const ARTIFACTS_DIR = '/root/.gemini/antigravity-cli/brain/92f65d64-900b-4574-9eac-65c00bac0c1e';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-gpu'],
    defaultViewport: { width: 1366, height: 850, deviceScaleFactor: 2 },
  });

  const page = await browser.newPage();
  console.log('Navigating to https://peekrush.inmerzion.io ...');
  await page.goto('https://peekrush.inmerzion.io', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));

  // 1. Capture Idle Hero (Clean, without pill, without boxes in boxes)
  const heroIdlePath = path.join(ARTIFACTS_DIR, 'peekrush_hero_minimal_idle.png');
  await page.screenshot({ path: heroIdlePath });
  console.log(`Saved idle hero screenshot: ${heroIdlePath}`);

  // 2. Click play to see real-time subtitles and running player
  const playBtn = await page.$('button[aria-label="Reproducir"]');
  if (playBtn) {
    await playBtn.click();
    console.log('Clicked play button...');
    await new Promise(r => setTimeout(r, 4000)); // wait 4s into playback
  }

  // 3. Capture Hero Playing with Real-time Subtitles
  const heroPlayingPath = path.join(ARTIFACTS_DIR, 'peekrush_hero_minimal_playing.png');
  await page.screenshot({ path: heroPlayingPath });
  console.log(`Saved playing hero screenshot: ${heroPlayingPath}`);

  await browser.close();
  console.log('All inspections completed successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
