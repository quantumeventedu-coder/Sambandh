# Sambandh Setu — native app (iOS / Android) via Capacitor

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


---

# Sambandh Setu — store builds, deep links and push (added 22 Nov 2026)

The website, the Android app and the iOS app are **one product on one backend**:
the native shell loads `https://www.sambandh.online`, and every client talks to the
same API (`/api/*`, also served as `/api/v1/*` for the apps). Accounts, chats,
journeys, Setu Guide memory and settings are therefore identical on every device.

## A. App bootstrap endpoint
`GET /api/v1/meta` returns the API version, the minimum supported app versions
(`MIN_ANDROID_VERSION`, `MIN_IOS_VERSION` env vars) and feature switches. Use it on
launch to show "please update" when the installed version is below the minimum.

## B. Push notifications (Android + iOS through Firebase Cloud Messaging)
1. `npm install @capacitor/push-notifications @capacitor/app && npx cap sync`
2. Firebase console → create the project → add the Android app (`com.sambandh.app`,
   download `google-services.json` into `android/app/`) and the iOS app (upload your
   APNs auth key under Cloud Messaging).
3. Server: set `FCM_SERVICE_ACCOUNT_JSON` (the service-account JSON as one value) in
   Vercel. Without it, push is a silent no-op.
4. Nothing else to code: `public/setu.js` (`setuNativeInit`) asks for permission,
   registers the token with `POST /api/v1/devices`, and opens the right screen when a
   notification is tapped. Every in-app notification is also pushed to the phone.

## C. Deep links — Android App Links and iOS Universal Links
Public profile links (`https://www.sambandh.online/u/<username>`) and app links open
straight in the app when it is installed.

Server (Vercel env vars):
- `ANDROID_CERT_SHA256` — the SHA-256 fingerprint(s) of your release signing key
  (Play Console → App integrity), comma-separated. Serves `/.well-known/assetlinks.json`.
- `ANDROID_PACKAGE` — defaults to `com.sambandh.app`.
- `APPLE_TEAM_ID` (and `IOS_BUNDLE_ID`, default `com.sambandh.app`). Serves
  `/.well-known/apple-app-site-association`.

Android — `android/app/src/main/AndroidManifest.xml`, inside the main activity:
```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="https" android:host="www.sambandh.online" android:pathPrefix="/u/" />
  <data android:scheme="https" android:host="www.sambandh.online" android:pathPrefix="/app" />
</intent-filter>
```
iOS — Xcode → Signing & Capabilities → **Associated Domains** → `applinks:www.sambandh.online`.

## D. Building for the stores
- **Google Play:** `npx cap open android` → Build → Generate Signed Bundle (AAB) →
  upload to Play Console (internal testing first). Declare background location and
  the data-safety form honestly (location, photos, messages, identity verification).
- **iOS App Store:** `npx cap open ios` → Product → Archive → upload with Xcode →
  TestFlight → review. Fill in the privacy nutrition labels to match the data-safety form.
- **Other Android stores** (Samsung Galaxy Store, Amazon, etc.) accept the same signed
  APK/AAB; App Links need each store build to be signed with a key listed in
  `ANDROID_CERT_SHA256`.
- Keep `appId` as `com.sambandh.app` unless no build has ever been published —
  changing it later creates a separate app in both stores.
