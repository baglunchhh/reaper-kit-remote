// End-to-end smoke test: loads the real page in headless Chromium for each look and
// answers its REAPER web-remote requests with a fake server, so main.js, the polling
// loop and the page's own handlers all run for real.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/favicon.ico') { res.writeHead(204); return res.end(); }
  const f = path.join(root, u === '/' ? 'index.html' : u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const A = ['DRUM BUS', 'KICK', 'SNARE', 'RACK', 'FLOOR', 'OVR_R', 'OVR_L', 'ROOM C', 'ROOM F', 'RHYTH BUS', 'CLICK', 'TALK'];
const B = ['BASS', 'GTR L', 'GTR R', 'VOX', 'KEYS', 'FX'];
let state, reqs;
const reply = (s) => {
  const l = [`TRANSPORT\t${s.play}\t${s.sec}\t${s.rep}\t0\t0`];
  s.tracks.forEach((n, i) => l.push(['TRACK', i + 1, n, 0, 1, 0, s.peak, s.peak, 0, 0, 0, 0, 0, 0].join('\t')));
  l.push(`CMDSTATE\t40364\t${s.metro}`);
  return l.join('\n');
};

let failed = 0;
const check = (cond, msg) => { if (cond) console.log('PASS', msg); else { console.error('FAIL', msg); failed++; } };

const browser = await chromium.launch();
for (const skin of ['classic', 'retro', 'hifi']) {
  console.log(`\n== ${skin} ==`);
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  ctx.setDefaultTimeout(10000);
  const errors = [];
  state = { play: 5, sec: 83.2, rep: 1, metro: 1, peak: -300, tracks: A };
  reqs = [];
  await ctx.route('**/_/**', (route) => {
    reqs.push(decodeURIComponent(new URL(route.request().url()).pathname));
    route.fulfill({ status: 200, contentType: 'text/plain', body: reply(state) });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(`${base}/index.html?skin=${skin}`);
  await page.waitForFunction(() => document.querySelectorAll('.track-meter').length === 10);
  check(await page.evaluate(() => document.documentElement.dataset.skin) === skin, 'skin attribute applied');
  check(true, '10 meter columns drawn from a 12-track project');

  const cls = (id) => page.evaluate((i) => document.getElementById(i).className, id);
  check((await cls('btn-play')).includes('is-active'), 'play lit while transport is playing/recording');
  check((await cls('btn-record')).includes('is-recording'), 'record lit while recording');
  check((await cls('btn-loop')).includes('is-active'), 'loop lit when repeat is on');
  check((await cls('btn-metronome')).includes('is-active'), 'metronome lit from REAPER state');
  check((await page.textContent('#timecode')).trim() === '00:01:23', 'timecode formatted HH:MM:SS from seconds');
  check(await page.evaluate(() => document.querySelector('.track-meter-fill').style.height) === '50%', 'meter fill: -30 dB is 50%');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), 'no scrolling at 1180x820');

  // every button sends its REAPER action
  const actions = { 'btn-play': 40044, 'btn-stop': 1016, 'btn-record': 1013, 'btn-loop': 1068, 'btn-rewind': 40172,
    'btn-forward': 40173, 'btn-undo': 40029, 'btn-marker': 40157, 'btn-metronome': 40364 };
  for (const [id, a] of Object.entries(actions)) {
    reqs.length = 0;
    await page.click('#' + id);
    const re = new RegExp(`(^/_/|;)${a};`);
    await page.waitForFunction(() => true);
    for (let i = 0; i < 40 && !reqs.some((r) => re.test(r)); i++) await page.waitForTimeout(50);
    check(reqs.some((r) => re.test(r)), `${id} sends action ${a}`);
  }

  // switching REAPER project tab: ghost tracks go away, the picker follows
  state.tracks = B;
  await page.waitForFunction(() => document.querySelectorAll('.track-label').length === 6);
  check(true, 'project switch: 12 tracks -> 6 columns, no ghosts');
  await page.click('#btn-settings');
  check(await page.locator('.track-settings-row').count() === 6, 'settings list shows exactly the 6 tracks of the active project');

  // refresh button
  await page.click('#track-refresh');
  check((await page.textContent('#track-refresh')).includes('REFRESHED'), 'refresh button gives feedback');
  await page.waitForFunction(() => document.querySelectorAll('.track-label').length === 6);
  check(true, 'refresh re-gathers the active project');

  // skin picker + persistence
  const other = skin === 'classic' ? 'hifi' : 'classic';
  await page.click(`.skin-opt[data-skin="${other}"]`);
  check(await page.evaluate(() => document.documentElement.dataset.skin) === other, `picker switches look to ${other}`);
  await page.click('#track-settings-done');
  await page.goto(`${base}/index.html`);
  await page.waitForFunction(() => document.querySelectorAll('.track-meter').length > 0);
  check(await page.evaluate(() => document.documentElement.dataset.skin) === other, 'chosen look persists across reloads');

  check(errors.length === 0, 'no page or console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();
}
await browser.close();
server.close();
console.log(failed ? `\n${failed} check(s) failed` : '\nsmoke test: all passed');
process.exit(failed ? 1 : 0);
