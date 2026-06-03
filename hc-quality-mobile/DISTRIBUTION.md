# HC Quality Mobile — Distribution Guide

## Overview

Distribution is automated via GitHub Actions (`.github/workflows/mobile-android.yml`).
Every push to `main` touching `hc-quality-mobile/**` triggers a signed release build
and uploads the APK to Firebase App Distribution for internal testers.

Manual distribution is a one-command operation: `npm run build:android:release`.

---

## Prerequisites

### Android

| Requirement | Version              | Notes                                         |
| ----------- | -------------------- | --------------------------------------------- |
| JDK         | 17 (Temurin)         | `java -version` must show 17                  |
| Android SDK | API 34               | Via Android Studio SDK Manager                |
| Gradle      | 8.x                  | Managed by gradle wrapper — no manual install |
| Keystore    | `hcquality.keystore` | See generation steps below                    |

### iOS

| Requirement             | Notes                                            |
| ----------------------- | ------------------------------------------------ |
| macOS                   | Required — Xcode will not run on Linux/Windows   |
| Xcode                   | 15+                                              |
| Apple Developer account | For provisioning profiles + signing certificates |
| CocoaPods               | `sudo gem install cocoapods`                     |

---

## Generate the Android Keystore

Run once and store the output securely (1Password / vault). Never commit the `.keystore` file.

```bash
keytool -genkey -v \
  -keystore hcquality.keystore \
  -alias hcquality \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=HC Quality, OU=Mobile, O=HC Quality Labclin, L=Sao Paulo, ST=SP, C=BR"
```

When prompted, choose strong passwords (16+ chars). Record:

- Store password
- Key alias (`hcquality`)
- Key password

Then encode for GitHub Secrets:

```bash
base64 -i hcquality.keystore | pbcopy   # macOS — copies to clipboard
# or on Linux:
base64 hcquality.keystore
```

---

## GitHub Secrets Required

Add these in **Settings → Secrets and variables → Actions** on the repository:

| Secret name                | Value                                                                           |
| -------------------------- | ------------------------------------------------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`  | Base64-encoded content of `hcquality.keystore`                                  |
| `ANDROID_KEY_ALIAS`        | `hcquality` (or the alias you chose)                                            |
| `ANDROID_STORE_PASSWORD`   | Keystore store password                                                         |
| `ANDROID_KEY_PASSWORD`     | Key password                                                                    |
| `FIREBASE_ANDROID_APP_ID`  | Android App ID from Firebase console (e.g. `1:123456:android:abc`)              |
| `FIREBASE_SERVICE_ACCOUNT` | JSON content of a GCP service account with Firebase App Distribution Admin role |

### Getting FIREBASE_ANDROID_APP_ID

Firebase Console → Project settings → Your apps → Android app → App ID.

### Getting FIREBASE_SERVICE_ACCOUNT

```bash
# In GCP Console or via gcloud CLI:
gcloud iam service-accounts create firebase-distribution \
  --display-name "Firebase App Distribution CI"

gcloud projects add-iam-policy-binding hmatologia2 \
  --member="serviceAccount:firebase-distribution@hmatologia2.iam.gserviceaccount.com" \
  --role="roles/firebaseappdistro.admin"

gcloud iam service-accounts keys create firebase-sa-key.json \
  --iam-account="firebase-distribution@hmatologia2.iam.gserviceaccount.com"
```

Paste the full content of `firebase-sa-key.json` as the secret value.

---

## Local Build

### Android release APK

```bash
# From hc-quality-mobile/
ANDROID_KEYSTORE_FILE=android/app/hcquality.keystore \
ANDROID_KEY_ALIAS=hcquality \
ANDROID_STORE_PASSWORD=<your-store-password> \
ANDROID_KEY_PASSWORD=<your-key-password> \
npm run build:android:release
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

### Android release AAB (for Play Store)

```bash
ANDROID_KEYSTORE_FILE=android/app/hcquality.keystore \
ANDROID_KEY_ALIAS=hcquality \
ANDROID_STORE_PASSWORD=<your-store-password> \
ANDROID_KEY_PASSWORD=<your-key-password> \
npm run build:android:bundle
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

---

## iOS Distribution

iOS distribution requires macOS + Xcode + an Apple Developer account ($99/yr).
The steps below use Xcode Archive (no fastlane dependency for now).

### Prerequisites

```bash
cd hc-quality-mobile/ios
pod install
```

### Build for distribution

1. Open `ios/hcQualityMobile.xcworkspace` in Xcode.
2. Select the **hcQualityMobile** scheme and a **Generic iOS Device** destination.
3. Product → Archive.
4. In the Organizer, select the archive → Distribute App.
5. Choose **TestFlight & App Store** or **Ad Hoc** depending on the track.
6. Select your distribution certificate + provisioning profile.
7. Export the IPA.

### Upload to TestFlight (automated, requires fastlane)

```bash
gem install fastlane
cd hc-quality-mobile/ios
fastlane pilot upload --ipa ../build/hcquality.ipa \
  --username drogafarto@gmail.com \
  --app_identifier com.hcquality.mobile \
  --skip_waiting_for_build_processing
```

A Fastfile and Appfile should be added to `ios/fastlane/` when iOS distribution
is ready for automation (Phase 3.x milestone).

---

## CI Workflow

The workflow at `.github/workflows/mobile-android.yml`:

- Triggers on every push to `main` affecting `hc-quality-mobile/**`
- Can be triggered manually via **Actions → Run workflow** with a track selector
- Guards against running when the native Android project hasn't been generated yet
- Caches Gradle dependencies for faster builds (~3 min warm vs ~8 min cold)
- Uploads the signed APK as a GitHub artifact (30-day retention) **and** to Firebase App Distribution

### Generating the native Android project

If `android/app/build.gradle` does not exist yet, the native layer needs to be
generated. After confirming RN version compatibility:

```bash
cd hc-quality-mobile
npx react-native@0.75.3 init hcQualityMobile --version 0.75.3 --skip-install
# Then merge the generated android/ into this project, keeping signing config from
# android/app/build.gradle in this repo as the authoritative signing block.
```

---

## Security Notes

- The keystore is **never committed** to the repository. `.gitignore` must include `*.keystore`.
- CI injects credentials via encrypted secrets — they are never echoed in logs.
- The `FIREBASE_SERVICE_ACCOUNT` secret grants only `firebaseappdistro.admin` — it cannot deploy rules, write Firestore, or access production data.
- Per RDC 978 §5.3 + DICQ 4.4: distribution artifacts are versioned by `github.sha` for full traceability.
