# Operations

## Secrets
Secrets live in `/home/ubuntu/.hermes/profiles/clydius/.env`; do not commit them. Rotate any token/password pasted into chat after setup.

## Build verification
```bash
pnpm install
pnpm build
```

GitHub Pages deploys the `out/` static export with `.github/workflows/deploy-pages.yml`.

## Wiki use
Keep architecture, schema notes, recovery steps, and product decisions here so the repo remains clean and the app README stays user-facing.
