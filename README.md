# Corridor Scout

Corridor Scout is an automated data-to-dashboard project for comparing recorded consumer-remittance quotations. Its analytical question is:

> Where do transfer costs vary most—and why?

The fixed analysis uses $200-equivalent Internet offers delivered within 3–5 days and compares one lowest-cost qualifying service per provider and corridor. The interactive explorer then lets a user change the corridor and operating constraints. It compares service offers—not companies in the abstract—and identifies offers that are efficient on the cost–speed trade-off.

## Automated pipeline

One command runs the complete workflow:

```bash
pnpm run data:refresh
```

The pipeline:

1. Downloads the World Bank workbook.
2. Validates the worksheet, required columns, and newest applicable period.
3. Filters transparent UK-origin quotations and standardises costs, methods, and speed.
4. Checks for incomplete tiers, duplicate IDs, and unexpected speed labels.
5. Calculates provider minima, corridor cost spreads, and fee-versus-FX gap diagnostics.
6. Publishes clean dashboard records, quality results, ranked corridors, and written findings to `public/corridor-data.json`.

A local workbook can be supplied for reproducible or offline runs:

```bash
python3 scripts/prepare_data.py /path/to/rpw_dataset.xlsx
```

## Data

The included dataset contains 394 offer-amount observations derived from 197 transparent service quotations for five providers and ten UK-origin corridors.

Source attribution: The World Bank, Remittance Prices Worldwide, available at http://remittanceprices.worldbank.org

- Period: 2025 Q3
- Origin: United Kingdom
- Providers: Wise, Remitly, WorldRemit, Western Union, and MoneyGram
- Destinations: Bangladesh, Ghana, India, Kenya, Pakistan, Philippines, South Africa, Tanzania, Thailand, and Uganda
- Data preparation: `scripts/prepare_data.py`
- Dashboard data: `public/corridor-data.json`

These are historical mystery-shopping quotations. They are not live prices, completed transactions, merchant payout terms, or measures of reliability.

## Run locally

Requires Node.js 22.13 or newer and Python with pandas/openpyxl if regenerating the data.

```bash
pnpm install
pnpm run dev
pnpm run build
pnpm run build:pages
```

The GitHub Pages build is written to `docs/` as a self-contained static site.

The workbook URL and source period can also be overridden through the script options. Run `python3 scripts/prepare_data.py --help` for details.
