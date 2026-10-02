# REAPER Kit Remote

[![CI](https://github.com/baglunchhh/reaper-kit-remote/actions/workflows/ci.yml/badge.svg)](https://github.com/baglunchhh/reaper-kit-remote/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A glanceable tracking remote for REAPER, built for a tablet mounted at a drum kit. Big transport keys, a metronome toggle, a live timecode and per-track level meters, readable from about three feet away. It is **not a mixer**: no EQ, panning or FX control.

It is a single static web page that talks to REAPER's built-in web server. There is no install, no build step and no extension.

## Looks

Three switchable looks (tap the gear icon, then **LOOK**). Your choice is remembered on that device.

| CLASSIC (default) | RADIO | HI-FI |
|---|---|---|
| ![Classic](docs/screenshots/classic.png) | ![Radio](docs/screenshots/radio.png) | ![Hi-fi](docs/screenshots/hifi-active.png) |
| Black, high-contrast outline buttons | Vintage radio: maroon faceplate, brass trim, cream piano keys and dial-window meters, on wood | Silver brushed-aluminum faceplate, chrome knurled knobs, black glass windows lit blue-green |

HI-FI idle (nothing lit) and the settings panel in each look:

| HI-FI idle | Settings: Classic | Settings: Radio | Settings: Hi-fi |
|---|---|---|---|
| ![](docs/screenshots/hifi-idle.png) | ![](docs/screenshots/settings-classic.png) | ![](docs/screenshots/settings-radio.png) | ![](docs/screenshots/settings-hifi.png) |

(Screenshots use simulated meter data.)

## What it does

**Transport**
- Play/stop toggle, a dedicated Stop, Record, and a Loop (repeat) toggle.
- Jump to the previous or next marker (or the start or end of the project).
- Insert a marker at the current position, and Undo.
- Persistent states (play, record, loop, metronome) light up from REAPER's *confirmed* state, so they stay correct even if something else (keyboard, footswitch) changes transport.
- One-shot buttons (stop, rewind, forward, marker, undo) flash on press.

**Display**
- Live timecode, formatted as HH:MM:SS from the raw position, so it ignores the project's ruler format.
- A metronome toggle ("CLICK!!!") that reflects REAPER's actual on/off state.
- Up to 10 vertical level meters with live track names. The colour zones sit at fixed dB levels (-60 to 0 dB, with the upper zones marking the loud end), and a level line rides the top of each meter.
- Track labels always show the **real REAPER track number**, so they match your mixer.

**Track picker (gear icon)**
- Lists every track in the *currently active* project, with real names, and lets you choose up to 10 to display. The columns reflow to fill the width.
- Switching project tabs in REAPER updates the list automatically, and tracks the current project doesn't have are dropped.
- **Refresh from current project** button: a hard reset that forgets everything gathered so far and re-reads the active project.
- Your selection is stored in the browser (localStorage), so no code edits are needed between sessions.

**Layout**
- Fixed 1180x820 stage that scales to fit any screen with no scrolling. Meta tags allow "Add to Home Screen" for a full-screen launch on iPad.
- All fonts are self-hosted (Roboto Condensed, variable WOFF2). Nothing is loaded from the internet.

## Setup

1. **Enable REAPER's web control surface** (if not already on): Options → Preferences → Control/OSC/Web → Add → "Web browser interface". Pick a port (8080 is the usual) and set the default page to `index.html`.
2. **Copy these into your REAPER resource path's `reaper_www_root` folder** (Options → "Show REAPER resource path in explorer/finder"):
   - `index.html`, `main.js`, the `fonts/` folder, and `Background-Wood.jpg` (only the RADIO look uses it).
3. **Find your computer's LAN IP** (`ipconfig` on Windows, System Settings → Network on Mac).
4. On the tablet, same WiFi, open `http://<your-computer's-IP>:8080/`.
5. iOS: Share → **Add to Home Screen** to launch full-screen.

All the actions it triggers (play/stop, stop, record, repeat, previous/next marker, undo, insert marker, metronome) are **REAPER built-in action IDs**, identical on every REAPER install. Nothing to reconfigure.

## Customizing

- **Colors and look**: each look has its own scoped block in the `<style>` section (`html[data-skin="classic"]`, `"retro"`, `"hifi"`); colors are CSS variables at the top of each block.
- **Default look**: `classic`; change the fallback in the small script at the top of `<head>`. A `?skin=retro` (or `hifi`, `classic`) in the URL also selects and saves a look.
- **Insert-marker action**: `ACTIONS.marker` near the bottom of `index.html` (`40157`, "Markers: Insert marker at current position").
- **Max tracks shown**: `MAX_VISIBLE` (default 10; the layout was designed for up to 10 columns).

## Repository contents

| Path | What |
|---|---|
| `index.html` | The whole page, including all three looks |
| `main.js` | REAPER's own web-remote helper, unmodified |
| `fonts/` | Roboto Condensed variable WOFF2 (open source) |
| `Background-Wood.jpg` | Wood texture for the RADIO look |
| `spec-export.jsx` | Illustrator ExtendScript that exports named layers, groups and text frames to JSON (percent geometry, fill/stroke hex, text and font) |
| `docs/design/` | The Illustrator mockup exports and the spec JSON the layout was built from |
| `docs/screenshots/` | Screenshots used above |
| `docs/DEVELOPMENT_NOTES.md` | Architecture, protocol notes, style specs for each look, and the backlog |
| `test/` | Static checks and a headless-browser smoke test (run by CI) |
| `.github/workflows/ci.yml` | GitHub Actions workflow that runs both test suites on every push and pull request |
| `package.json` | Dev-only: pins Playwright for the tests. The page itself has no dependencies |
| `LICENSE` | MIT |

## Development and tests

The page is plain HTML/CSS/JS with no build step, so edit `index.html` directly. CI runs on every push and pull request. To run the same checks locally (needs Node 20+):

```
npm install
npx playwright install chromium
npm test
```

- **Static checks** (`test/static-checks.mjs`): every script parses; every referenced font, image and script exists; nothing is loaded from the internet; all three looks are present; and a privacy scan finds no LAN IP addresses, user-specific file paths or real email addresses in committed text files.
- **Smoke test** (`test/smoke.mjs`): loads the real page in headless Chromium for each look, answering its REAPER requests with a fake REAPER server so `main.js` and the polling loop genuinely run. It checks the lit states (play, record, loop, metronome), the timecode, the meter fill, that all nine buttons send the right REAPER action IDs, project-tab switching, the refresh button, look switching and persistence, no scrolling, and no console errors.

Not covered: real REAPER, and iPad Safari rendering.

## Building your own design

1. Design the layout in Illustrator and name each layer, group and text frame as you want it referenced (for example `transport-play`, `track-1-meter`). Give text frames an explicit name, because Illustrator shows an unnamed text frame's contents in the Layers panel without actually naming it.
2. Run `spec-export.jsx` (File → Scripts → Other Script...). It writes a JSON file next to your `.ai` with each item's position (percent of the artboard), fill/stroke colour and text/font info. Gradients, spot colours and corner radii are not exported.
3. Use that JSON as the spec for hand-written HTML/CSS.

## Known limitations

- No "disconnected from REAPER" banner yet.
- No clip-warning light. REAPER's web protocol gives a level but no clip flag, so it would need to be latched in JavaScript.
- No project name display: the web protocol doesn't expose one.
- No authentication on REAPER's web server: anyone on the same network who knows the URL can control transport. Fine for a home studio. Don't port-forward it to the internet.
- The HI-FI and RADIO looks use shadows and gradients heavily and have only been checked in a desktop preview with simulated data, not yet on a physical iPad.

## License and credits

This project's own code, docs and tooling are released under the [MIT License](LICENSE) (Copyright (c) 2026 baglunch). Third-party pieces keep their own terms:

- **`main.js`**: REAPER's web-remote helper, provided with REAPER by Cockos Incorporated and included unmodified for convenience. It is not covered by this project's license. You can also copy it from your own REAPER install (`Plugins/reaper_www_root/main.js`).
- **Roboto Condensed** (`fonts/`): Copyright 2011 Google Inc., licensed under the [Apache License 2.0](http://www.apache.org/licenses/LICENSE-2.0).
- **`Background-Wood.jpg`**: a composited texture assembled from free-to-use sources, used by the RADIO look. Swap in your own image if you like.
- **Design inspiration**: the looks are inspired by vintage radio and hi-fi gear. No manufacturer logos or wordmarks are used.
- **Trademarks**: REAPER is a trademark of Cockos Incorporated. This project is unofficial and not affiliated with or endorsed by Cockos.
