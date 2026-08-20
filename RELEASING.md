# Releasing

Cleanmeter ships a Windows installer and an in-app auto-updater. Releases are
built by the `build.yml` GitHub Actions workflow on a Windows runner.

## Cut a release

1. Bump the version in all five places that carry it, e.g. `2.2.4` → `2.2.5`:
   `tauri-app/src-tauri/tauri.conf.json`, `tauri-app/package.json`,
   `tauri-app/package-lock.json` (both root entries),
   `tauri-app/src-tauri/Cargo.toml`, and the `cleanmeter` package entry in
   `tauri-app/src-tauri/Cargo.lock`. A missed lockfile makes `npm ci` or
   `cargo build --locked` disagree with its manifest in CI.
2. Commit, then tag and push:
   ```
   git tag v2.2.5
   git push origin v2.2.5
   ```
3. CI builds and signs the bundles and creates a **draft** GitHub release
   containing the installer, `latest.json`, and the update signatures.
4. Review the draft, then **publish** it. The auto-updater reads the latest
   *published* release, so updates reach users only once you publish.

## Verify auto-update (Windows)

The install flow can only be validated on Windows:

1. Install the previous version (e.g. `2.2.4`).
2. Publish a newer release (e.g. `2.2.5`) as above.
3. Launch the older install → the update badge should appear → **Update now** →
   it downloads, verifies the signature, installs, and relaunches into the new
   version.

## Updater signing key

- The Ed25519 **public** key is committed in `tauri.conf.json`
  (`plugins.updater.pubkey`).
- The **private** key and its password are stored as the repository Actions
  secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
- Keep a secure backup of the private key. If it is lost, already-released
  versions can no longer receive verified updates and the key must be rotated
  (which requires every user to reinstall).
