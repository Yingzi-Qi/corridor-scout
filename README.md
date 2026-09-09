# Corridor Scout

[Live dashboard](https://yingzi-qi.github.io/corridor-scout/) · [World Bank source](https://remittanceprices.worldbank.org/data-download)

Corridor Scout turns a public remittance-pricing workbook into a validated, interactive comparison of provider costs across UK outbound corridors.

## Decision question

> Where do providers' lowest qualifying costs differ most, and is the gap driven mainly by fees or FX margins?

Fixed comparison: $200 equivalent, Internet access, delivery within 3–5 days, and one lowest-cost qualifying service per provider and corridor.

## Architecture

| Layer | Responsibility |
|---|---|
| `pipeline/step_01_download.py` | Download the configured workbook safely. |
| `pipeline/step_02_validate.py` | Validate the source schema and select a period. |
| `pipeline/step_03_clean.py` | Map World Bank rows into canonical offer records. |
| `pipeline/contracts.py` | Define and validate the reusable offer contract. |
| `pipeline/step_04_analyse.py` | Calculate provider minima, corridor spreads, and gap drivers. |
| `pipeline/step_05_publish.py` | Publish deterministic dashboard JSON. |
| `app/page.tsx` | Provide the interactive summary and detailed explorer. |

## Run locally

```bash
python3 -m pip install -r requirements.txt
pnpm install
python3 -m pipeline.run /path/to/workbook.xlsx
pnpm run dev
```

Omit the workbook path to download the configured source. Use `--period 2025_3Q` to select a specific period.

## Quality checks

```bash
pnpm run check
```

This runs the Python pipeline tests, verifies the published data, type-checks the dashboard, and creates the GitHub Pages build.

## Use another dataset

The analysis is reusable for another remittance-pricing dataset after a source adapter maps each row to the canonical fields in `pipeline/contracts.py`.

- Same World Bank schema: pass a different workbook path or `--download-url`.
- Different schema: replace the validation and cleaning adapter in Steps 02–03.
- Canonical offers: reuse Steps 04–05 without changing the ranking or publishing logic.

Currency amounts and codes are stored separately, so the canonical contract is not tied to GBP.

## Automation

GitHub Actions checks every change. A second workflow runs quarterly or on demand, refreshes the configured workbook, tests the result, rebuilds the dashboard, and publishes only when generated data changes.

The scheduled job reprocesses the configured URL. Use the manual `download_url` input or update `SOURCE_URL` when a new release has a different address.

## Limits

The dashboard uses historical consumer-remittance quotations. It does not show live prices, completed transfers, reliability, merchant payout terms, or causal explanations for provider pricing.
