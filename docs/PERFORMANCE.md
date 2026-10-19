# Mobile rendering measurements

This pass targets mobile rendering cost and idle battery use. Pixel 8 is the owner's test device; physical-device measurements are still required. Browser checks run on Chromium's software WebGL renderer, so their frame rates are not Pixel 8 performance claims.

## Rendering changes

- Home preview rendering is capped at 30 FPS; gameplay rendering is capped at 60 FPS, including on high-refresh displays. These are maximum budgets, not guaranteed frame rates.
- Menus and pauses stop scheduling WebGL frames after pending layout/render work settles. A scene or graphics change requests a new frame; closing the menu resumes animation. The inactive app stops scheduling frames, and visibility restoration retains the pause until the player resumes.
- Clouds and platform details share geometry. Palms, asteroids, dunes, and cacti use local batches so the renderer can still cull distant groups. Static scenery and vehicle subparts avoid recomposing unchanged local transforms every frame.
- Camera and particle helpers are reused, and vehicle syncing avoids temporary arrays each frame. Water uses simulation elapsed time, so it also freezes during pauses.
- Scenery instances and collision particles explicitly release their instance buffers when removed. Shared vehicle geometry remains cached for reuse.
- On phones, Auto uses a 1024-pixel shadow map and up to four city point lights. High retains 2048-pixel shadows and all eight lights; Battery saver disables shadows and limits city point lights to two. Visible lamp models remain present at every setting.
- Automatic reduction judges sustained gameplay frame intervals only. Home's 30 FPS budget and idle menu time do not trigger a quality downgrade.

## Historical before and after — 1.0.1

The same six worlds were sampled at a 390×844 viewport, device scale 1, Battery saver, default mixed-vehicle home tower, and the same software renderer. Each result is the median of five frames after initialization. Raw reports are in [performance-before.json](performance-before.json) and [performance-after.json](performance-after.json). The baseline is source commit `d824327`; the after report is the working build of 1.0.1 before its commit.

| World | Draw calls before | After | Reduction | Triangles before | After |
|---|---:|---:|---:|---:|---:|
| Forest | 68 | 54 | 20.6% | 90,926 | 92,438 |
| Night City | 63 | 52 | 17.5% | 84,180 | 84,180 |
| Outer Space | 64 | 51 | 20.3% | 64,572 | 64,608 |
| Snow Mountains | 62 | 52 | 16.1% | 73,074 | 73,914 |
| Desert | 84 | 61 | 27.4% | 70,564 | 76,180 |
| Beach | 58 | 49 | 15.5% | 63,730 | 65,410 |

Batching trades some fine-grained culling for fewer submissions: triangle counts rise slightly, most noticeably by about 8% in the desert. The scenery remains present. Draw-call savings do not translate directly into the same percentage increase in FPS or reduction in battery usage; those require device measurements. The separate menu/pause checks verify that the actual rendered-frame counter stays unchanged while idle.

To repeat against a production preview:

```bash
npm run build
npm run preview -- --port 4173 --strictPort
# In a second terminal:
node scripts/profile-rendering.mjs /tmp/stackline-rendering.json
```

Set `CHROMIUM_PATH` for a different Chromium installation or `STACKLINE_URL` for a different preview URL. Do not run other software WebGL sessions at the same time when comparing costs.

## Vehicle-detail measurements — 1.1.0

The original models now use curved body shells, sculpted wheel arches, clearcoat paint, tinted glass, tire tread, brake discs, and alloy rims. The [six-model report](vehicle-metrics-1.1.0.json) records 8–9 shared material batches and 16,472–18,472 triangles per vehicle. Templates and geometry remain cached across drops; nominal stacking dimensions and collision hulls are unchanged. Mirrors and trim extend beyond those approximate hulls.

The [vehicle-detail rendering report](performance-1.1.0.json) repeats the same 390×844, Battery saver, mixed home-tower scenario. It records the working 1.1.0 build based on `b1e1f6a`, before committing this update.

| World | Draw calls 1.0.1 | 1.1.0 | Triangles 1.0.1 | 1.1.0 |
|---|---:|---:|---:|---:|
| Forest | 54 | 54 | 92,438 | 115,446 |
| Night City | 52 | 52 | 84,180 | 107,188 |
| Outer Space | 51 | 51 | 64,608 | 87,616 |
| Snow Mountains | 52 | 52 | 73,914 | 96,922 |
| Desert | 61 | 61 | 76,180 | 99,188 |
| Beach | 49 | 49 | 65,410 | 88,418 |

Draw-call counts stay unchanged in this scenario. The added vehicle detail costs 23,008 additional triangles in the four-vehicle home tower. Clearcoat and tire bump shading also add GPU work that these counts do not measure. This is a fidelity/performance tradeoff, not an FPS improvement claim. Auto quality and the 30/60 FPS rendering budgets remain available; actual frame times, warmth, and battery usage require Pixel 8 testing.

Crash audio uses three original buffers prepared during loading in 1.2.0 and reused during play. Quiet resting contacts and duplicate events are filtered, so persistent physics contacts do not create continuous audio sources. Short music ducking lets impacts remain audible without permanently lowering the soundtrack volume. Version 1.2.0 preloads and decodes the bundled 240,812-byte Ogg score before enabling Play; no OfflineAudioContext score rendering runs on the Play tap. The score source and optional authoring script remain available.

## Pixel 8 checks before the next release

1. Sign the 1.3.0 AAB with the registered upload key, upload version code 6 to the same app's Internal testing track, and update through Google Play. Keep the existing install so save preservation can be checked.
2. Test Auto for at least ten minutes in Forest and Night City. Look for delayed taps, uneven camera motion, warmth, and audio interruptions. Compare Battery saver if the phone gets warm.
3. Open menus, pause, leave the app, and return. The run should stay paused and music should remain stopped until **Keep climbing**. Repeat after locking the phone.
4. Check a centered drop, a corner miss, a tall tower, and replay. Replay must clear the old tower and reset score and run coins.
5. On a fresh launch, tap Play without opening another menu. Check immediate music and sound on the very first collision. Drop several different vehicles and compare soft and hard crashes with music on/off. Turn **Sound effects** off and verify impacts stay silent after reopening.
6. Try a free choice and a paid choice in each selector. Cancel must cancel; Done must save and charge only once. Test insufficient coins.
7. Cancel Reset game and confirm nothing changes. Then, only on a test save, confirm reset and verify zero coins, free choices, default settings, and cleared records after reopening.
8. On Wi-Fi, finish three games and check one Google test interstitial before results; close it and replay. No ad should appear during play, pause, startup, or the first two results. Repeat offline: results must remain usable without waiting for an ad. Check sound after dismissal and after backgrounding the app during the ad.
9. Force-close and reopen. Verify vehicle, place, music preference, coins, and high score. Check offline launch after the native app has been installed.

The original game and this game have separate Play testing requirements. Starting or completing a different game's closed test does not establish production access for this package.
