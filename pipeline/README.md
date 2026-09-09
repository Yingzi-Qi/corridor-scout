# Data pipeline

## Flow

| Step | Module | Output |
|---|---|---|
| 01 | `step_01_download.py` | Local XLSX source file. |
| 02 | `step_02_validate.py` | Validated schema, row count, and selected period. |
| 03 | `step_03_clean.py` | Canonical offer records and cleaning diagnostics. |
| 04 | `step_04_analyse.py` | Provider minima, corridor rankings, and findings. |
| 05 | `step_05_publish.py` | Deterministic dashboard JSON. |

`run.py` connects the steps. `settings.py` contains the World Bank source adapter configuration. `contracts.py` defines the source-independent boundary.

## Input source

The default adapter reads the World Bank Remittance Prices Worldwide workbook.

```bash
python3 -m pipeline.run
python3 -m pipeline.run /path/to/workbook.xlsx
python3 -m pipeline.run --download-url "https://example.com/workbook.xlsx"
python3 -m pipeline.run --period 2025_3Q
```

A same-schema release works directly. A different source needs two concise adapter changes:

1. Validate its schema and period in Step 02.
2. Map its rows to the fields in `contracts.py` in Step 03.

Steps 04–05 then work without source-specific provider or destination lists.

## Canonical contract

Each offer contains identifiers, corridor and provider fields, delivery conditions, benchmark and send currencies, fee and FX components, total cost, collection date, and source traceability.

The contract rejects missing fields, duplicate IDs, invalid numbers, invalid currency codes, and non-positive send amounts before analysis. Negative recorded total costs remain valid because promotional FX rates can produce them in the source.

## Tests

```bash
python3 -m unittest discover -s tests -p 'test_*.py'
```

The tests cover adapter-to-JSON integration, provider selection, ranking, gap classification, and contract failures.
