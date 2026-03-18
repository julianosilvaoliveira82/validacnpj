Cloudflare Pages deploy package

Required structure:
- index.html at project root
- functions/api/cnpj.js at project root

Before deploy:
1. In Cloudflare Pages project settings, either:
   - set Root directory blank / repository root, and keep these files at repo root
   - OR if your repo contains this package inside a subfolder, set that subfolder as the Root directory
2. Add environment variable:
   RECEITAWS_TOKEN=...
