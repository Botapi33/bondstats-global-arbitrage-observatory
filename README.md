# BondStats Global Arbitrage Observatory

Public data-engine repository for the BondStats Global Arbitrage Observatory.

The current engine compares official ECB and Bank of Canada FX reference observations and publishes a friction-aware pricing-consistency snapshot for the public BondStats interface.

Because these observations are not synchronized and do not contain executable bid/ask quotes, the engine deliberately classifies them as reference diagnostics rather than executable arbitrage signals.

## Public output

The workflow publishes:

- `public/data/global-arbitrage-observatory.json`
- `src/data/global-arbitrage-observatory.json`

to the main `Botapi33/bondstats-site` repository.

## GitHub Actions

Add the repository secret:

`BONDSTATS_SITE_TOKEN`

with write access to `Botapi33/bondstats-site`.

Then run **BondStats Arbitrage Observatory** manually once, or let the scheduled workflow update it automatically.

## Local commands

```bash
npm test
npm run build
npm run validate
```
