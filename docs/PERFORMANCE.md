# Mobile performance update — 1.0.1

This pass targets mobile rendering cost and idle battery use. Pixel 8 is the owner's test device; physical-device measurements are still required. Browser checks run on Chromium's software WebGL renderer, so their frame rates are not Pixel 8 performance claims.

## Rendering changes

- Home preview rendering is capped at 30 FPS; gameplay rendering is capped at 60 FPS, including on high-refresh displays. These are maximum budgets, not guaranteed frame rates.
- Menus and pauses stop scheduling WebGL frames after pending layout/render work settles. A scene or graphics change requests a new frame; closing the menu resumes animation. The inactive app stops scheduling frames, and visibility restoration retains the pause until the player resumes.
- Clouds and platform details share geometry. Palms, asteroids, dunes, and cacti use local batches so the renderer can still cull distant groups. Static scenery and vehicle subparts avoid recomposing unchanged local transforms every frame.
- Camera and particle helpers are reused, and vehicle syncing avoids temporary arrays each frame. Water uses simulation elapsed time, so it also freezes during pauses.
- Scenery instances and collision particles explicitly release their instance buffers when removed. Shared vehicle geometry remains cached for reuse.
- On phones, Auto uses a 1024-pixel shadow map and up to four city point lights. High retains 2048-pixel shadows and all eight lights; Battery saver disables shadows and limits city point lights to two. Visible lamp models remain present at every setting.
- Automatic reduction judges sustained gameplay frame intervals only. Home's 30 FPS budget and idle menu time do not trigger a quality downgrade.

## Before and after

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

## Pixel 8 checks before the next release

1. Sign the 1.0.1 AAB with the registered upload key, upload version code 2 to the same app's Internal testing track, and update through Google Play. Keep the existing install so save preservation can be checked.
2. Test Auto for at least ten minutes in Forest and Night City. Look for delayed taps, uneven camera motion, warmth, and audio interruptions. Compare Battery saver if the phone gets warm.
3. Open menus, pause, leave the app, and return. The run should stay paused and music should remain stopped until **Keep climbing**. Repeat after locking the phone.
4. Check a centered drop, a corner miss, a tall tower, and replay. Replay must clear the old tower and reset score and run coins.
5. Force-close and reopen. Verify vehicle, place, music preference, coins, and high score. Check offline launch after the native app has been installed.

The original game and this game have separate Play testing requirements. Starting or completing a different game's closed test does not establish production access for this package.
