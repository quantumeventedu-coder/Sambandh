# Sambandh — native app (iOS / Android) via Capacitor

This wraps the **existing** Sambandh web app into a real native app so it can do the one
thing a browser can't: **background / "Always" location** (update location even when the app
is closed). Nothing in the web codebase is rewritten — the native shell loads the live app
(`https://sambandh.online`, set in `capacitor.config.json`) and adds native plugins.

The web app already contains the bridge (`public/app.js` → `startNativeBackgroundLocation`,
`askBackgroundLocationConsent`): it is a **no-op in a browser** and activates automatically
inside the native app after the user opts in.

> **Legal, not optional:** background location requires **explicit, specific, revocable
> consent** (DPDP/GDPR) and a real user-facing purpose, or Apple/Google will reject the app.
> The consent screen + server record (`POST /api/me/bg-location-consent`) are already wired.

---

## 0. Prerequisites
- Node 18+, the repo checked out.
- **iOS:** a Mac with **Xcode**, an Apple Developer account.
- **Android:** **Android Studio** + SDK, a Google Play Developer account.

## 1. Install Capacitor + the background-geolocation plugin (run at the repo root)
```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android \
            @capacitor-community/background-geolocation
```
`capacitor.config.json` already exists at the repo root (appId `com.sambandh.app`, it points
the native shell at `https://sambandh.online`).

## 2. Add the native platforms
```bash
npx cap add ios
npx cap add android
npx cap sync
```
This generates `ios/` and `android/` native projects (do NOT commit build artifacts).

## 3. iOS permissions — `ios/App/App/Info.plist`
Add:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Sambandh uses your location to show accurate distance to matches.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Allow "Always" so Sambandh can keep your distance to matches accurate and power safety features even when the app is closed. Your exact location is never shown to others.</string>
<key>UIBackgroundModes</key>
<array>
  <string>location</string>
</array>
```

## 4. Android permissions — `android/app/src/main/AndroidManifest.xml`
Inside `<manifest>` (above `<application>`):
```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
```
The `@capacitor-community/background-geolocation` plugin registers its own foreground service;
follow its README for the `<service>` entry if the version you install requires it.

## 5. Run
```bash
npx cap open ios       # → build/run in Xcode on a device (background location needs a real device)
npx cap open android   # → build/run in Android Studio
```

## 6. How the location bridge behaves
- **Web / PWA:** `startNativeBackgroundLocation()` returns immediately — foreground-only watch
  (unchanged). No "always" permission exists on the web.
- **Native, before consent:** the app shows the consent screen (`Allow always` / `Not now`).
- **Native, after consent:** `BackgroundGeolocation.addWatcher(...)` streams location (incl.
  when the app is closed) and posts it to `/api/me/location` — the same endpoint the web uses,
  so the admin map / distance / trail all work identically, now with background coverage.
- **Turn off:** `revokeBackgroundLocation()` clears consent, stops the watcher, and records the
  revocation server-side.

## 7. App-store submission notes
- Justify background location with the **real feature** (accurate distance + safety), show the
  in-app consent screen, and add a Location section to your **privacy policy** + store listing.
- A pure remote-URL wrapper can be rejected as "minimal functionality" — the **native
  background-location capability is the substantive native feature** that justifies the app.
  (Alternative: set `webDir` to a bundled build instead of the remote `server.url` for a more
  "native" package; then point the web app's API calls at an absolute `https://sambandh.online/api`
  base when running natively.)
