# Artifact Vault

Self-hosted, offline-first gallery for curated standalone HTML artifacts.

## Local use

```sh
mise install
pnpm --config.trust-policy=none install
export INGEST_TOKEN=change-me
pnpm --config.trust-policy=none dev
```

`workbox-build@7.4.1` has transitive packages rejected by this machine's strict pnpm provenance policy. The explicit per-command override is required here and in the Docker build; it does not alter global pnpm configuration.

In another terminal:

```sh
export VAULT_URL=http://localhost:3000
export VAULT_TOKEN=change-me
node cli/vault.mjs push ~/Downloads/artifact.html --title "Example" --tags demo,keeper --source chatgpt
node cli/vault.mjs list
node cli/vault.mjs bucket a1b2c3d4 understanding
node cli/vault.mjs rm a1b2c3d4
```

## Deployment

Build with the included Dockerfile. Set `INGEST_TOKEN` as a Coolify secret and mount persistent storage at `/app/data`. Serve the service through the existing Cloudflare Tunnel. The gallery is public; use Cloudflare Access if artifact contents should be private.

Downloaded artifacts run in a sandboxed iframe without a same-origin identity. Direct artifact responses also receive a CSP sandbox header.
