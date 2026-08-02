# Building the Android app (APK)

The project is packaged with [Capacitor](https://capacitorjs.com). The Android
shell loads the live published site (`https://myacademysolutions.lovable.app`),
so result fetching, PDF and Excel generation keep working exactly as on the web.

## One-time setup on your computer

1. Push the project to GitHub (Lovable → GitHub → Connect project), then
   `git clone` it and run `npm install`.
2. Install [Android Studio](https://developer.android.com/studio) (includes the
   Android SDK + JDK).

## Create and run the Android project

```bash
npx cap add android
npx cap sync android
npx cap open android
```

Android Studio opens. Press **Run** to launch on a device/emulator.

## Build an installable APK

In Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
The file lands in `android/app/build/outputs/apk/debug/app-debug.apk`.

For the Play Store use **Build → Generate Signed Bundle / APK → Android App Bundle**.

## After changing the app

Publish in Lovable — the Android app picks up changes automatically because it
loads the live site. Only run `npx cap sync android` again after changing
`capacitor.config.ts`, icons, or native plugins.

## App icon

Replace the icons in `android/app/src/main/res/mipmap-*` (Android Studio:
right-click `res` → New → Image Asset) using `src/assets/academy-logo.png`.

## Signed release build for the Play Store

APKs cannot be built inside Lovable (no Android SDK / JDK, and your signing key
must never leave your control). Two supported ways:

### A. Automated via GitHub Actions (recommended)

`.github/workflows/android-release.yml` builds and signs both the APK and the
AAB (Play Store wants the `.aab`).

1. Create your keystore once and back it up — every future Play Store update
   must be signed with the same key:
   ```bash
   keytool -genkey -v -keystore my-academy.jks -keyalg RSA -keysize 2048 \
     -validity 10000 -alias my-academy
   base64 -w0 my-academy.jks
   ```
2. In GitHub → Settings → Secrets and variables → Actions, add:
   `ANDROID_KEYSTORE_BASE64` (the base64 output), `ANDROID_KEYSTORE_PASSWORD`,
   `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
3. Run the workflow: Actions → "Android Release (signed)" → Run workflow
   (or push a `v1.0.0` tag).
4. Download the `android-release` artifact — it contains
   `my-academy-solutions-release.apk` and `my-academy-solutions-release.aab`.

### B. Locally in Android Studio

`Build → Generate Signed Bundle / APK → Android App Bundle`, select your
keystore, choose the `release` variant.

### Before publishing on Play Store

- Bump `versionCode` / `versionName` in `android/app/build.gradle` for each release.
- Add app icons (`res/mipmap-*`) and a 512x512 Play Store icon.
- Play Console requires a privacy policy URL and a data-safety declaration.
