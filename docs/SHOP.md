# Google Play currency shop

The Android application ID is `com.trishool.stackline`. Create these consumable one-time products in Play Console. Activate each product and its buy option in the regions where you sell it. The shop displays the localized price returned by Play for each available offer.

| Product ID | Coins | Diamonds | India price |
| --- | ---: | ---: | ---: |
| stackline_coins_100 | 100 | 5 | INR 29 |
| stackline_coins_200 | 200 | 10 | INR 49 |
| stackline_coins_500 | 500 | 25 | INR 99 |
| stackline_coins_1000 | 1,000 | 60 | INR 149 |

Create `stackline_all_access` as a **non-consumable**, one-time product priced at INR 699 in India. It unlocks every selectable vehicle and place. The app acknowledges the verified pass and restores it when Google Play returns the ownership record. Resetting game progress keeps the pass.

Set `VITE_GOOGLE_PLAY_LICENSE_KEY` to this app's Base64 **public licensing key** in the build environment. Run `npm run android:sync` before building the Android package. Use a new version code when uploading an update to Play. Install the Play-distributed build through the internal testing track and complete a purchase with a license tester. Check cancellation, pending payment, and reopening the game after approval.

The game verifies the signed purchase on the device, writes the balances and purchase token together, and then asks Play to consume the purchase. Tokens prevent duplicate delivery when Play retries. Wallet balances use the existing device save. Clearing app data or reinstalling can erase spent or delivered currency. Cross-device balances, server verification and refund reconciliation require an account-backed wallet.

The first row grants 25 coins and 1 diamond after a completed rewarded ad. Localhost uses a labeled demo ad. Android uses the project's configured AdMob test unit.
