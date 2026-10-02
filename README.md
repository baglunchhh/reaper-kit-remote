# REAPER Kit Remote

A glanceable tracking remote for REAPER, meant for a tablet mounted at a drum
kit: transport controls, a metronome toggle, and live per-track meters/names.
Not a mixer — no EQ, panning, or FX control.

## Setup

1. **Enable REAPER's web control surface** (if not already on):
   Options → Preferences → Control/OSC/Web → Add → "Web browser interface".
   Pick a port (8080 is the usual default) and set the default page to `index.html`.

2. **Copy these files** into your REAPER resource path's `reaper_www_root` folder:
   - Windows: `%APPDATA%\REAPER\reaper_www_root\`
   - Mac: `~/Library/Application Support/REAPER/reaper_www_root/`
   - (Find your resource path via REAPER's Options menu → "Show REAPER resource path in explorer/finder")

   Copy: `index.html`, `main.js`, and the whole `fonts/` folder.

3. **Find your computer's LAN IP** (so your tablet can reach it over WiFi):
   - Windows: `ipconfig` in a terminal, look for IPv4 Address
   - Mac: System Settings → Network

4. On your tablet, same WiFi network, open Safari/Chrome to:
   `http://<your-computer's-IP>:8080/`

5. **Add to Home Screen** (iOS Safari: Share → Add to Home Screen) so it launches
   full-screen without browser chrome eating into the display.

## It just works out of the box

Every transport action wired in this page (play, stop, record, loop/repeat,
marker navigation, undo, metronome) uses REAPER's **built-in, universal action
IDs** — the same on every REAPER install, every OS, every version. Nothing to
re-derive or reconfigure there.

## Customizing

- **Colors**: all defined as CSS variables at the top of `index.html`'s
  `<style>` block (`--col-record`, `--col-play`, etc). Change the hex values.
- **Which tracks show**: tap the small gear icon in the top-right corner of
  the page. It lists whatever tracks actually exist in your current REAPER
  session (live, real names) and lets you pick up to 10 to display. Your
  choice is remembered on that device/browser via local storage — no code
  edits needed session to session.
- **Layout/corner radii/fonts**: also in the `<style>` block, reasonably
  commented.
- **Insert-marker action**: currently set to `40157` ("Markers: Insert marker
  at current position"), REAPER's standard one. If you use a different
  marker-insert action, change the `marker` value in the `ACTIONS` object
  near the bottom of `index.html`.

## Building your own visual design from scratch

If you want a completely different look rather than reusing this one:

1. Design your layout as an Illustrator mockup, naming every layer/group/text
   frame exactly as you want it referenced (e.g. `transport-play`, `track-1-meter`).
2. Run `spec-export.jsx` (File → Scripts → Other Script... in Illustrator) on
   your `.ai` file. It walks every named layer/group/text frame on the first
   artboard and exports a JSON file with each one's position (as % of the
   artboard), fill/stroke color, and text/font info — next to your `.ai` file.
3. Use that JSON as your build spec to hand-author the HTML/CSS, the same way
   this page was built.

This only gets you geometry and color — gradients, icons, and interaction
states (pressed/active/flashing) still need to be built by hand in CSS/JS.

## Known limitations (not built yet)

- No "disconnected from REAPER" banner if the connection drops.
- No clip-warning indicator on the meters (REAPER's web protocol gives a
  peak-level number, but no sticky clip latch — you'd need to build that
  thresholding yourself in the meter-update JS).
- No authentication on REAPER's web server — anyone on the same WiFi network
  who knows the URL can control transport, not just view it. Fine for a home
  studio or practice space; don't port-forward this to the open internet.
