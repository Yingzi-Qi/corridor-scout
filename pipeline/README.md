# Five-step data pipeline

Each numbered module corresponds directly to a step displayed on the dashboard.

| Step | Code | Responsibility |
|---|---|---|
| 01 | `step_01_download.py` | Downloads the configured World Bank workbook. |
| 02 | `step_02_validate.py` | Checks the worksheet and required columns, then selects the newest applicable period. |
| 03 | `step_03_clean.py` | Filters transparent UK quotations and standardises the two benchmark amounts into comparable records. |
| 04 | `step_04_analyse.py` | Selects each provider's lowest-cost qualifying offer and calculates corridor spreads and cost drivers. |
| 05 | `step_05_publish.py` | Writes the clean records, quality report, rankings, and findings to the dashboard JSON file. |

`settings.py` contains the declared scope and reusable transformations. `run.py` connects the five steps and prints progress as it runs.

## Input data source

The default input is the World Bank Remittance Prices Worldwide Excel workbook. The source URL is clearly marked under `# INPUT DATA SOURCE` in `settings.py`.

To use another release with the same World Bank structure:

```bash
python3 -m pipeline.run --download-url "https://example.com/new-rpw-workbook.xlsx"
```

You can also supply a local workbook:

```bash
python3 -m pipeline.run /path/to/workbook.xlsx
```

This pipeline is **tailored to the World Bank workbook schema**; it does not clean every possible source automatically. A different dataset requires an adapter in Steps 02 and 03 to validate its fields and translate them into the pipeline's standard offer structure. Once that translation is made, the analysis and publishing logic in Steps 04 and 05 can be reused.

## Run the complete pipeline

From the repository root:

```bash
pnpm run data:refresh
```

For a reproducible offline run with an already-downloaded workbook:

```bash
python3 -m pipeline.run /path/to/rpw_dataset.xlsx
```

The older `scripts/prepare_data.py` entry point remains as a small compatibility wrapper.
