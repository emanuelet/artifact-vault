# Artifact Vault Capacitor Companion

Status: accepted for implementation

## Decisions

- Add the Android Capacitor app as the `mobile/` workspace in this repository.
- Use a separate `VAULT_READ_TOKEN` for mobile reads. It must not authorize mutations.
- Store files in `Directory.Data` and mirror the remote manifest, pruning files removed from the server on a successful sync.
- Remove the existing Workbox/PWA offline implementation. Keep the web gallery as an online, passkey-gated interface.

## Server

1. Add a constant-time read-token verifier in `src/lib/auth.ts`.
2. Require the read token for `GET /api/manifest` and `GET /artifacts/:id.html`.
3. Let requests with a valid read token bypass the passkey request hook. Browser reads remain passkey-gated.
4. Add CORS support for Capacitor Android's `http://localhost` origin and its `Authorization` request header.
5. Cover unauthorized reads, read-token success, read-token mutation rejection, and passkey interaction in server tests.

## PWA Removal

1. Delete Workbox generation and generated service-worker files.
2. Remove service-worker regeneration from startup and artifact mutations.
3. Remove PWA metadata and service-worker registration from the gallery.
4. Update documentation to make Android the supported offline client.

## Mobile Workspace

1. Create `mobile/` as a Vite + TypeScript + Capacitor v8 package with Filesystem and Preferences.
2. Add `storage.ts` for directory creation, local manifest/file operations, and sync metadata.
3. Add `api.ts` for configured authenticated reads and strict response handling.
4. Add `sync.ts` to download missing files, mirror remote deletions, and commit the local manifest only after all operations succeed.
5. Add settings, sync-status, gallery, and viewer screens. The viewer must use `Capacitor.convertFileSrc()` and a sandboxed iframe.
6. Generate and commit the Android project; build and install through `cap sync android`.

## Verification

1. Run server tests and mobile unit tests.
2. Build the web bundle and run Capacitor sync.
3. On device: sync online, enable airplane mode, stop the vault, relaunch, and verify all synced artifacts still render.
4. Delete an artifact server-side, sync again, and verify its local copy is removed.
