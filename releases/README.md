# Android App Bundle

`Stack-Vechiles-1.3.0-unsigned.aab` includes native Android AdMob test interstitials after completed games 3, 6, 9, and so on. Google demo IDs and test mode are enabled; no revenue ads are served. Ads preload without blocking gameplay; unavailable ads are skipped, and results/replay wait for dismissal. The browser version remains ad-free. See [the Android ad test instructions](../docs/ADMOB.md). The bundle is **unsigned**: sign it with the existing upload key before using Play Console Internal testing.

- Application ID: `com.trishool.stackline`
- Version: `1.3.0` / version code `6`
- Minimum Android API: `23`; target Android API: `35`

Check Play Console's current target API requirement before submission. This bundle does not certify compliance with current store policies. If this package has already been uploaded, subsequent releases must use a higher version code and the registered upload key.

## Sign on your PC

Download and extract the source ZIP, then open its folder in VS Code. Install Android Studio (which includes a JDK) or JDK 21. Run:

```powershell
node scripts/sign-aab.mjs
```

No `npm install` or Android SDK build is required for this signing step. If Java tools are not detected, set `JAVA_HOME` to your JDK directory, or to Android Studio's `jbr` directory, and reopen the terminal.

The helper asks whether to use an existing upload keystore or create a new one. If it finds the key previously created in your user folder, reusing it is the default. **For an update to the app already registered in Play Console, use its registered upload key and the same password.** For a new app you can create a new upload key. Passwords are hidden and passed to Java tools through child-process environment variables, never command-line password values or saved files. Your private key stays on your PC. New keys default to `.stack-vechiles-signing/upload-keystore.p12` in your user folder, outside this repository. Back up that file and its password securely.

The signed result is `releases/Stack-Vechiles-1.3.0-signed.aab`. The helper verifies its signature. Upload **that signed file** as a new release in the same Play Console app's Internal testing track. The package ID and local save format are unchanged, so normal in-place updates retain saved progress. It does not upload or publish automatically.

For a different input or output filename:

```powershell
node scripts/sign-aab.mjs "path/to/unsigned.aab" "path/to/signed.aab"
```

Existing keystores and signed output files are never overwritten. The AAB cannot be installed directly as an APK; use Play's testing track to install it.

To rebuild after source changes, run `npm run android:sync`, then Gradle `bundleRelease` (or `python3 scripts/build-android-cloud.py bundleRelease` in the prepared cloud environment), and sign the newly built bundle again. The prebuilt file in this directory is a snapshot, not automatically updated by future builds.
