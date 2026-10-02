# Development notes: REAPER iPad Kit Remote

Paste this into a new chat. It is a glanceable drum-tracking remote for REAPER, shown on an iPad at the kit. It is not a mixer. User: <owner> (GitHub), Windows 11, REAPER portable-style install at `C:\Reaper`.

## 0. How the user likes to work
- **Ask clarifying questions ONE AT A TIME**, never as a list (saved in memory as `feedback_one_question_at_a_time`).
- Ask before risky or visible actions (public repos, deploys that replace their working page). A first deploy was explicitly confirmed. After that, additive redeploys were fine.
- They like screenshots to judge looks, and they give design direction by pasting reference photos.
- Don't guess REAPER action IDs. The user confirmed 40029 (undo) and 40157 (insert marker) from their own Action List.
- Git: no identity is configured and the rule is never to touch git config. Commit with env vars: `GIT_AUTHOR_NAME/EMAIL`, `GIT_COMMITTER_NAME/EMAIL` (<owner> / <email>).

## 1. Environment and deployment
- Project dir: `<project folder>`. Live web root: `<REAPER resource path>\reaper_www_root`.
- `REAPER.ini` already enables the web surface: `csurf_0=HTTP 0 8080 '' 'index.html' 0 ''`. The PC's LAN IP is <your-PC-LAN-IP>. Firewall already allows REAPER on the Public profile, and the network is Public.
- iPad URL: `http://<your-PC-LAN-IP>:8080/` (the classic page) or `/skins.html` (the multi-skin page). It also needs `main.js`, `fonts/RobotoCondensed-Variable.woff2` and `Background-Wood.jpg` (only the RADIO skin loads it).
- Before the user's first deploy, the existing custom pages (kitview, song_switcher, 2 X-Raym lyrics pages) were backed up to `reaper_www_root_backup`.
- Pages must be served over HTTP by REAPER. They do NOT work from `file://`, since `main.js` XHR and localStorage break.
- DHCP reservation for .99 is unconfirmed on the router. The user was told to verify it.

## 2. Files
| File | Role |
|---|---|
| `index.html` | ORIGINAL black page, live default. Untouched since the metronome and hidden-track work. |
| `index-skins.html` | **Source of truth going forward.** All three skins plus the refresh feature. Deployed as `reaper_www_root\skins.html`. |
| `index-retro.html` | Superseded early radio build. Safe to delete. |
| `main.js` | Verbatim copy of REAPER's `Plugins\reaper_www_root\main.js`. Never modify it. |
| `spec-export.jsx` | Illustrator ExtendScript: named items to JSON (percent geometry, fill/stroke hex, text/font). |
| `Background-Wood.jpg` | Wood-and-leather texture, cropped to the 1180:820 aspect ratio. |
| `Background-1/2.jpg` | Rejected graphite textures. |
| `HANDOFF.md` | This file. |
| `ShareableKitRemote/` | Cleaned copy for sharing (a git repo). It has NO skins yet. |
- GitHub: private repo `<owner>/reaper-kit-remote`, one commit. It needs updating with the skins page and a README note.
- The generator scripts (build_skins.py, hifi.css) lived in a temp scratchpad and are gone. **Edit `index-skins.html` directly.**
- After the retire-wood request, the scoped CSS is organized as: base (geometry), `html[data-skin="classic"]`, `html[data-skin="retro"]`, `html[data-skin="hifi"]`, then a final shared block for `#track-refresh`.

## 3. Architecture
- Fixed 1180x820 `.stage`, scaled to fit via JS `fitStage()`. It uses `visualViewport`, listens for orientation changes, and the viewport uses `100dvw/dvh`. The viewport meta tag locks zoom. This fixed the iPad Safari scrolling bug.
- `#content` wrapper shifted `left:1.225%` to center the asymmetric Illustrator layout (8.39% left margin vs 10.84% right). Verified to within 1px.
- All layout is in % of the stage, taken from the Illustrator spec export.
- Meter columns are JS-generated. They are 10 slots across 8.39% to 89.07%, with 0.68% gutters, and they reflow to fill the width when fewer tracks are chosen.
- Skin selection is `<html data-skin="classic|retro|hifi">`, set before first paint. `?skin=x` wins and is saved. Otherwise localStorage `kitRemoteSkin`, then classic. Switch via the gear icon, then the LOOK row.
- The one markup set uses `currentColor` SVG icons, and skins just set `color`.
- Regression guard: the classic skin was pixel-diffed against the original page (max diff 0). Repeat that diff after touching shared CSS.

## 4. REAPER protocol and wiring (all verified)
- Single poll: `wwr_req_recur('TRANSPORT;TRACK;GET/40364', 100)`.
- `TRANSPORT`: tok[1] playstate, tok[2] seconds, tok[3] repeat. Play is `playstate&1`, record is `playstate&4`. The timecode is formatted by me from tok[2] as HH:MM:SS, because tok[4] follows the project's ruler format (measures.beats).
- `TRACK`: tok[1] number (0 is master, skipped), tok[2] name, tok[7] meter pos in dB*10. Meter range is -60 to 0 dB.
- `CMDSTATE` for 40364 gives the metronome state.
- Action IDs: play/stop toggle **40044**, stop **1016**, record **1013**, repeat **1068**, previous marker/start **40172**, next marker/end **40173**, undo **40029**, insert marker **40157**, metronome **40364**. These are universal built-ins, so no re-derivation is needed on other machines.
- Behavior: play, record, loop and metronome keep a persistent REAPER-confirmed state. Stop flashes on a confirmed transition to stopped. Rewind, forward, marker and undo flash on tap.
- No protocol command gives the project name, and there is no FX parameter read/write in the default web remote.

## 5. Track list logic
- `knownTracks` mirrors the active project. Each `TRACK` reply lists every track, so the page prunes any it doesn't see, which handles project-tab switches automatically.
- `VISIBLE_TRACKS` is the saved selection (max 10), under localStorage `kitRemoteVisibleTracks`. `visibleList()` is that selection limited to tracks that exist. If none exist, it falls back to the project's first 10 without overwriting the saved choice.
- The first time any tracks are seen with no saved choice, it defaults to the first 10.
- Tapping a row first normalizes the selection against what's displayed.
- **REFRESH FROM CURRENT PROJECT button** (latest work): clears `knownTracks` and the saved selection, calls `wwr_req('TRACK')`, and the next reply repopulates with the first 10. The label shows "REFRESHED ✓" for 1.4s. The panel re-renders live if the project changes while it is open. The unnamed-track label is "(unnamed)". Tested with simulated replies. Not yet tested with real REAPER tabs.
- **Where we left off:** refresh was implemented and deployed to `skins.html`. It still needs a real-REAPER check with two project tabs and a look at the iPad. The user said we are close to the usage limit.

## 6. UI style notes: the three skins
**Shared tokens**
- Font: Roboto Condensed variable WOFF2, weights 100-900, self-hosted, no CDN. The Gotham files exist in the Illustrator package folder but are desktop-licensed, so they stay unused until web licensing is checked.
- Transport row: loop, wide record (184x88), play, stop, a gap, then rewind, marker, forward, undo. Header: CLICK!!! metronome on the left (wide thin pill) and timecode on the right.
- Settings: gear icon at the top-right corner of the stage, opening a modal with LOOK picker, REFRESH button, show/hide toggles, then DONE.
- Name labels uppercase with ellipsis. A second line "TRACK N" always shows the real REAPER track number.

**CLASSIC (default, black)**
- `#000` background, fill-none outline buttons with a 5px stroke, 23px corner radius on squares and 20px on the pill.
- Colors: loop `#353637`, record `#ee3b40`, play `#39b54a`, stop `#cbdb2a`, rewind and forward `#60cdf6`, marker `#00aeef`, undo `#f172ac`, metronome `#f5a623`.
- Persistent states fill solid with a black glyph. Momentary flash lasts 350ms. Loop active uses the record red.
- Meters: 2px `#808080` outline, with a fill gradient of green `#39b54a` to yellow `#cbdb2a` at 70% to red `#ee3b40` at 90%.
- The fill's `background-size` is fixed at `100% 395px`, so the color zones stay at fixed dB levels. A previous bug rescaled them with the fill height.

**RADIO (retro, maroon and brass)**
- Palette: ink `#2b170f`, maroon `#5a2323` / `#3a1515`, brass `#c9a227`, cream `#f3e6bd`.
- Wood texture with only a 20% scrim. A maroon faceplate (6%/2.6%, 85.6%x91.8%) has a brass border, a perforated grille strip and brass corner screws.
- Transport buttons are cream **piano keys** with a 2px ink border, a 7px hard drop-shadow, and a 6px translate-down press. Persistent keys stay pressed and fill with the function color. Flash is gold `#e9c24d`.
- Meters are cream dial windows with a brass border and ink-colored scale ticks (major every 10 dB, minor every 5 dB, drawn with repeating gradients). The channel is recessed, and a red needle line `#d8372f` with a cream outline rides the top of the level.
- Maroon engraved plaques hold the names, brass for `TRACK N`. Timecode sits in a cream dial window with ink digits. CLICK!!! is a dark maroon pill that lights amber.

**HI-FI (silver faceplate, blue-green glow)** (inspired by the user's vintage receiver photos; the brand wordmark is deliberately not used)
- Brushed aluminum faceplate (stacked repeating gradients), chrome corner screws, walnut side cheeks on the stage, and script text "Model KR-8", "KIT REMOTE", "Tracking Console".
- The `#grille` element is reused as one large black glass meter window with a triple chrome bezel (`--chrome-ring`).
- Buttons are **chrome knurled knobs**. The knurl is `repeating-conic-gradient`, the face is a `conic-gradient` in `::before`, and a dark lit face in `::after` fades in. Glyph is `#15181a` engraved. Active gives a dark face, a glow ring and a glyph glow. Glow colors: loop and record red `#ff4136`, play teal `#3df5b8`, all others cyan `#56e4ff`. Record is a chrome pill. Flash is a 420ms glow fade.
- Meters are lit channels. The fill runs teal `#12c9b8` to cyan `#3fe0e8` (to 70%), amber `#ffb02e` (to 90%), then red `#ff3b30`, with a cyan glow and cyan ticks. The needle is orange `#ffb36b` with a glow.
- Timecode: glowing cyan digits `#8ff0ff` in black glass. CLICK!!! is a dark lamp that glows orange when on. Labels are engraved black text on the silver strip.
- Settings panel: dark glass with cyan accents.

## 7. Backlog and V2
- **Verify on the real iPad**: `skins.html`, scroll/zoom behavior, wood glare under stage lights, and the refresh button with actual project tabs.
- Promote `index-skins.html` to the live `index.html` (default CLASSIC). The user was asked and has not answered. Keep `index.html` as a backup first.
- ~~Update the GitHub/shareable package~~ DONE: the repo is public, has the skins page, README with screenshots, MIT license and credits, and CI.
- **DISCONNECTED banner** and **sticky clip-warning light** were deferred to V2 by the user. REAPER gives no clip flag, so latch a threshold of at least 0 dB in JS.
- **Project name**: no protocol support. Options are manual edit, or a small Lua script writing ExtState that the page reads via `GET/EXTSTATE`. The spot was repurposed for the metronome.
- Open ideas: remember the track selection per project (e.g. keyed by a track-name signature), a second reserved transport slot (the gap between stop and rewind), a background texture decision, and a Gotham web license.
- Don't assume `wood` skin exists. It was removed. A saved `wood` value falls back to classic.

## 8. Tooling gotchas
- The Claude browser preview can't load sibling files from `file://`. Serve the project with `python -m http.server 8765 --bind 127.0.0.1` run as a background command, then stop it afterwards.
- Headless Brave `--screenshot` hung, so use the preview pane instead.
- Writing large Python via a bash heredoc broke on quoting. Write the script to a file with the Write tool, then run it.
- Always set `resize_window` to 1180x820 for screenshots and reset it to `desktop` afterwards.

## 9. Repo, CI and licensing (added after section 8)
- The repo is **public** (MIT). Its commit history uses GitHub's private noreply address; the history was rewritten once to remove an incorrect email, so never use a personal email for commits.
- **CI** (`.github/workflows/ci.yml`, Node 20, Playwright 1.49.1) runs on every push and pull request:
  - `test/static-checks.mjs`: scripts parse, assets exist, no external resources, all looks present, and a privacy scan (LAN IPs, user paths, emails).
  - `test/smoke.mjs`: headless Chromium plus a fake REAPER server via request interception; covers lit states, timecode, meters, all nine action IDs, project-tab switching, refresh, look switching and persistence, no scrolling, and no console errors.
  - Last verified run: 86 checks passed, 0 failed.
  - Gap: no real REAPER and no iPad Safari coverage.
- Note for the tests: columns are drawn on the first poll reply and meter levels arrive one poll tick (about 100 ms) later, so tests must wait for fill heights.
- Licensing: MIT for project code; credits section in the README covers `main.js` (Cockos, unmodified), Roboto Condensed (Apache 2.0, Google), the wood texture (the owner states it is a free composite) and a trademark notice.
- Known CI warning (not a failure): GitHub reports Node 20 as deprecated for `actions/checkout@v4` and `actions/setup-node@v4`; bump the action versions when convenient.
- To run locally (needs Node 20+): `npm install`, `npx playwright install chromium`, `npm test`.

## 10. Releases (added after section 9)
- **v1.0.0** is published (zip plus `.sha256`). It was built by hand from a Windows working copy, so its text files have CRLF line endings. Functionally identical to the workflow's output, which uses LF. Re-release as v1.0.1 if clean LF text files matter.
- **Automated releases**: `.github/workflows/release.yml` runs when a `v*` tag is pushed. It runs the static checks and the smoke test, builds `reaper-kit-remote-<version>.zip` and a `.sha256` via `scripts/package-release.sh`, and publishes a GitHub Release with generated notes. A failing test blocks the release.
- To release: `git tag v1.x.y && git push origin v1.x.y`. A manual run of the workflow (Actions tab) builds the zip and uploads it as an artifact without publishing; this was verified (static checks, smoke test and packaging all passed; the publish step was skipped).
- The zip layout is `reaper_www_root/` (copy its contents into REAPER's folder), `INSTALL.txt` (from `scripts/INSTALL.txt`, version filled in, CRLF), `LICENSE`, `extras/spec-export.jsx`.
- The README has a "Download the latest release" link at the top and a "Releasing" section.
