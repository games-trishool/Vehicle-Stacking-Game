# Test interstitials on Android

Version 1.4.0 (Android version code 7) includes the Capacitor AdMob plugin and Google's Mobile Ads SDK. The shipped IDs are Google's Android demo IDs:

- App: `ca-app-pub-3940256099942544~3347511713`, in `android/app/src/main/res/values/strings.xml`.
- Interstitial: `ca-app-pub-3940256099942544/1033173712`, in `src/admob.ts`.
- Both SDK initialization and ad requests explicitly enable test mode. Requests specify non-personalized test ads. This build cannot earn ad revenue.

## Install on your Pixel 8

Use the included `releases/Stack-Vechiles-1.4.0-unsigned.aab`: run `node scripts/sign-aab.mjs`, reuse your existing upload key, and upload the signed bundle to the same Play Console app's Internal testing track. Update through the tester link. The AAB cannot be installed directly as an APK. Normal updates preserve your saved progress.

For local Android Studio testing from the ZIP:

```powershell
npm ci
npm run android:sync
npm run android:open
```

Enable Developer options and USB debugging on the phone, connect it by USB, select it in Android Studio, and click Run. This uses Android's debug signing key; it cannot update a Play-signed installation of the same package. Use Play Internal testing to retain an existing Play installation and its progress.

`npm run dev` still runs the game in a browser, but Chrome, VS Code browser previews, and web shortcuts cannot display this native ad integration.

## Check the ad flow

1. Connect to the internet and open the Android app. No ad appears on startup. A test ad preloads in the background.
2. Play and lose two games. Their result screens appear normally. Pausing or abandoning a run does not increment the ad counter.
3. Lose the third game. After the short falling animation, a Google test interstitial should appear before results. Only a loaded ad is shown. Close it using the ad's own close control when available.
4. Results should appear with your saved score and coins. Tap One more climb: the fresh run and music should start normally. The next opportunities are completed games 6, 9, and so on.
5. Test offline. A previously cached ad may still show, but an unavailable ad must never hold up results. A missed opportunity is skipped; no late ad appears during the next game. Loading is retried at later starts and after dismissal.

The completed-game counter is saved separately under `stackline.ad-frequency.v1`, with values 0–2. Reopening does not restart the interval. Settings → Reset game resets this counter along with game progress. Back, replay, home, and keyboard input cannot start another run while an interstitial is open. All game audio is suspended during presentation and resumes through the next user action. Ad caches expire after 55 minutes.

## Before enabling revenue ads

Supply the app's own Android AdMob App ID and interstitial ad-unit ID for a live integration. Changing IDs alone is insufficient: this build deliberately forces test mode. A live version also needs the app's audience settings, the applicable Google UMP consent/privacy-options flow, and updated privacy/Data Safety and Contains ads declarations reflecting the SDK. Keep test devices enabled during development. No live advertising or store publishing is performed by this ZIP.

## Validation boundaries

Unit checks exercise the real frequency controller and native-event adapter, including games 3/6, persistence/reset, cache expiry, failures, and waiting for dismissal. The browser integration emulates the Capacitor native bridge while running real game physics and normal input. Android bundle compilation and bundletool validation check the actual native SDK integration. These checks do not establish that Google served an ad on a physical Pixel 8; use the device steps above for that check.
