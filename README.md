# Corridor Scout

Corridor Scout is an interactive dashboard for comparing recorded consumer-remittance quotations. It answers one deliberately narrow question:

> Among World Bank service offers recorded in Q3 2025, which was the lowest-cost way to send the $200- or $500-equivalent amount from the UK to a selected country, subject to funding method, receiving method, access channel, and delivery-time constraints?

The dashboard compares service offers—not companies in the abstract. It filters the eligible quotations, minimizes the World Bank total-cost percentage, and uses faster recorded delivery as the tie-breaker. It also identifies offers that are efficient on the cost–speed trade-off.

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
```

To regenerate `public/corridor-data.json`, download the World Bank RPW workbook and run:

```bash
python scripts/prepare_data.py /path/to/rpw_dataset.xlsx
```
