# Artifact Vault

Self-hosted, offline-first gallery for curated standalone HTML artifacts.

## Local use

```sh
mise install
pnpm install
export INGEST_TOKEN=change-me
pnpm dev
```

In another terminal:

```sh
export VAULT_URL=http://localhost:6000
export INGEST_TOKEN=change-me
node cli/vault.mjs push ~/Downloads/artifact.html --title "Example" --tags demo,keeper --source chatgpt
node cli/vault.mjs list
node cli/vault.mjs bucket a1b2c3d4 understanding
node cli/vault.mjs rm a1b2c3d4
```

## Coolify deployment

Push this repository to the Git provider configured in Coolify, then authenticate the CLI against the self-hosted instance:

```sh
coolify context add -d homelab https://coolify.example.com "<api-token>"
coolify --context homelab project list
coolify --context homelab server list
coolify --context homelab github list
```

Create the Dockerfile application with the UUIDs returned above. Use `app create github` for a repository connected through the Coolify GitHub App:

```sh
coolify --context homelab app create github \
  --project-uuid "<project-uuid>" \
  --server-uuid "<server-uuid>" \
  --github-app-uuid "<github-app-uuid>" \
  --git-repository "<owner>/artifact-vault" \
  --git-branch master \
  --build-pack dockerfile \
  --ports-exposes 6000 \
  --health-check-enabled \
  --health-check-path / \
  --name artifact-vault \
  --instant-deploy
```

For a public repository, substitute `app create public`, use its full repository URL in `--git-repository`, and omit `--github-app-uuid`.

After creation, persist the vault and set the runtime-only ingest secret. The volume must mount at `/app/data`.

```sh
export APP_UUID="<application-uuid>"
export INGEST_TOKEN="$(openssl rand -hex 32)"
coolify --context homelab app storage create "$APP_UUID" --type persistent --name artifact-vault-data --mount-path /app/data
coolify --context homelab app env create "$APP_UUID" --key INGEST_TOKEN --value "$INGEST_TOKEN" --runtime --build-time=false --is-literal
coolify --context homelab app start "$APP_UUID" --force
coolify --context homelab app deployments logs "$APP_UUID" --follow
```

Configure the existing Cloudflare Tunnel hostname to target the application on port `6000`. Set the same public URL and ingest token locally as `VAULT_URL` and `INGEST_TOKEN`, then verify with `node cli/vault.mjs list`. The gallery is public; protect the tunnel hostname with Cloudflare Access if artifacts are private.

Downloaded artifacts run in a sandboxed iframe without a same-origin identity. Direct artifact responses also receive a CSP sandbox header.
