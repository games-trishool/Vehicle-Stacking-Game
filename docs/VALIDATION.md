# Validation

The prepared cloud machine builds and runs the game. Production assets are entirely local.

- `npm run build`: strict TypeScript compilation and Vite production bundling passed.
- `npm test`: 6 progression tests passed, including reward multipliers, coin spending, persistence, corrupt saves, and high-score retention.
- All 5 browser tests passed. Browser checks use actual Chromium with software WebGL. They exercise the six live environments, fixed-vehicle selection, saved world and settings, garage purchases and insufficient coins, a 390px mobile layout, and browser errors.
- The physics browser test performs three centered drops through normal keyboard input, observes points and earned coins, checks pause/resume, then drops off-center to end and save the run. It reads diagnostic positions to time input; it does not alter physics bodies, scores, or simulation time. It uses the space world and a mobile viewport to make the software renderer practical.
- Replay cleanup checks count vehicle models in the actual scene, including any untracked models. After a failed tower, “One more climb” starts with exactly the base and held vehicles, zero score and run coins, and full stability. Separate checks restart and return home through the pause menu while a vehicle is falling, then verify that home contains only its four preview vehicles. The regression was reproduced before the fix: restart left three models instead of two.
- Initial Android build validation: debug compilation succeeded with Java 21, API 35, and Gradle 8.11.1. The resulting APK is `android/app/build/outputs/apk/debug/app-debug.apk` (approximately 4.4 MB). Rebuild and sync to include subsequent source changes.
- For that initial build, Android `apksigner` verification passed (v1 and v2 signatures). All 24 bundled web asset files were checked against the production `dist` files with SHA-256 and matched exactly.

This verifies builds and browser functionality, not Android device frame rates or Google Play acceptance. Physical-device testing, production signing, current store/API policy review, production art, and an online leaderboard backend remain release work. Rankings in this version are explicitly local.

The saved environment instructions must be reviewed and published in environment settings to create a reusable snapshot. Saving a draft does not publish it, and fresh-task restoration has not been tested.
