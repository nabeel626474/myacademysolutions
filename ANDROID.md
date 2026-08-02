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
