# Mixquilt operations

## Architecture decision

Mixquilt ships as a static, local-first PWA. The application bundle is served by GitHub Pages; songs, takes and polished
audio stay in the browser's IndexedDB. Full-backup ZIP files are the supported transfer and recovery mechanism.

There is intentionally no application backend. Repository history does not contain a removed server implementation:
the product was designed around on-device synthesis, storage and export. Keeping that boundary avoids accounts, secret
management, remote audio retention, database migrations and a materially larger privacy/security surface.

Revisit this decision only when a product requirement needs a trusted shared system, such as cross-device sync,
collaboration, paid entitlements or server-side publishing. Before adding one, define authentication, deletion and
retention behavior, encryption, abuse controls, database backup/restore, observability and operating ownership.

## Web release checklist

1. Use Node 24 and install the lockfile exactly with `npm ci`.
2. Run the release gates:

       npm run test:unit
       npm run build
       npm run verify:production
       npm audit --audit-level=high
       npm audit --omit=dev --audit-level=high

3. Build with test hooks, start `npm run preview`, and run:

       npm run smoke
       npm run regressions
       npm run test:voices
       npm run test:finish

4. Review the smoke screenshots and exported WAV, PDF, MIDI and ZIP files.
5. Merge only after the `Verify application` check passes. A `main` push creates a second clean production build and
   deploys it through the protected `github-pages` environment.
6. Open the live app, create a short song, reload it, export a full backup and install the PWA once on a clean profile.

The production verifier rejects missing CSP controls, blob AudioWorklet restrictions, source maps, test hooks, broken
Pages routing and an inconsistent PWA scope. CI repeats the full gate weekly so browser or dependency drift is visible
even when no code is changing.

## Repository controls

An administrator should configure these GitHub settings:

- Pages source: **GitHub Actions**.
- A `main` ruleset requiring pull requests and the `Verify application` status check.
- Require resolved conversations, block force-pushes and branch deletion, and require one approval when another
  maintainer is available.
- Protect the `github-pages` environment; add required reviewers if production changes need explicit release approval.
- Keep Dependabot security updates enabled. `.github/dependabot.yml` groups weekly npm and Actions updates.

These settings live in GitHub, not in the repository, and must be applied by an owner with administration permission.

## User data and recovery

- Ask users to export **Song → Full backup (.zip)** before clearing site data, changing device or installing a major
  browser/OS update. JSON-only export does not include vocal recordings.
- Importing a full backup creates a new song ID and restores compatible vocal and polish files; it does not overwrite
  the current song.
- Browser private/incognito storage is not a durable location. Device backups do not consistently preserve browser
  IndexedDB, so a downloaded Mixquilt ZIP is the recovery source.
- Support should request the app version, browser/OS, reproduction steps and a JSON-only export when sufficient. Do not
  request private vocal recordings unless the user explicitly agrees and a secure transfer route exists.

## Incident and rollback

1. Confirm whether the issue is a deploy failure, stale service worker, data/recovery problem or browser-specific audio
   regression. Preserve affected exports and CI artifacts.
2. For a bad web release, revert the offending commit through a pull request. The resulting `main` deployment is the
   rollback; do not rewrite `main` or manually edit the Pages artifact.
3. For cache-only issues, verify the newly deployed service-worker version in a clean profile before advising users to
   reload. Clearing site data destroys local songs and must never be the first troubleshooting step.
4. For possible data loss, stop destructive troubleshooting, make a full backup if the app can still open, and reproduce
   against a copy.
5. Document impact, root cause, recovery and the test or release gate added to prevent recurrence.

## Native release checklist

The checked-in Capacitor shells use bundle ID `app.mixquilt.studio`, Android API 36 (minimum 24) and iOS 15 or newer.
Run `npm run cap:sync` before opening either project.

Android prerequisites:

- Android Studio, Android SDK/Build Tools 36 and a supported JDK (the project currently builds with JDK 21).
- Set a unique version code/name, create an owner-controlled Play signing key, and store signing secrets outside Git.
- Exercise playback, background/foreground recovery, microphone permission, recording, latency calibration, export,
  share/download behavior and backup restore on at least one physical API-24 device and one current Android device.
- Build a signed App Bundle, run Play pre-launch reports, complete Data safety/content-rating forms and use an internal
  testing track before production.

iOS prerequisites:

- macOS, current Xcode, an Apple Developer team, distribution signing and App Store Connect access.
- Set the marketing/build versions and signing team. The microphone purpose string is already in `Info.plist`.
- Repeat the Android functional matrix on a physical iPhone and iPad, including interruption by calls/audio routes,
  AirPods/Bluetooth, Files export/import and an offline relaunch.
- Archive and validate in Xcode, complete App Privacy/age-rating metadata, then use TestFlight before App Store release.

The native projects can be synchronized on Linux, but signed Android/iOS releases and real-device audio validation
cannot be completed without those SDKs, credentials and devices.
