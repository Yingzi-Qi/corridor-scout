"""Run all five pipeline steps in order."""

from __future__ import annotations

import argparse
from pathlib import Path

from .contracts import SourceMetadata
from .settings import (
    METHODOLOGY_URL,
    SOURCE_LICENSE,
    SOURCE_PAGE_URL,
    SOURCE_TITLE,
    SOURCE_URL,
)
from .step_01_download import download_source
from .step_02_validate import validate_source
from .step_03_clean import clean_quotations
from .step_04_analyse import calculate_metrics
from .step_05_publish import publish_dashboard_data


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run the complete Corridor Scout data-to-dashboard pipeline."
    )
    parser.add_argument(
        "workbook",
        nargs="?",
        type=Path,
        help="Optional local workbook. If omitted, the World Bank file is downloaded.",
    )
    parser.add_argument("--output", type=Path, default=Path("public/corridor-data.json"))
    parser.add_argument("--raw-cache", type=Path, default=Path("data/raw/rpw_dataset.xlsx"))
    parser.add_argument("--download-url", default=SOURCE_URL)
    parser.add_argument("--period", help="Optional source period such as 2025_3Q")
    args = parser.parse_args()

    source_path = args.workbook
    print("01 Download source workbook")
    if source_path is None:
        source_path = download_source(args.download_url, args.raw_cache)
    else:
        print(f"   Using local source: {source_path}")

    print("02 Validate schema and latest period")
    validation = validate_source(source_path, args.period)

    print("03 Clean and standardise quotations")
    offers, cleaning_report = clean_quotations(source_path, validation["selectedPeriod"])

    print("04 Calculate provider and corridor metrics")
    analysis = calculate_metrics(offers)

    print("05 Publish dashboard data and findings")
    publish_dashboard_data(
        offers,
        analysis,
        validation,
        cleaning_report,
        args.output,
        SourceMetadata(
            title=SOURCE_TITLE,
            source_url=SOURCE_PAGE_URL,
            methodology_url=METHODOLOGY_URL,
            license=SOURCE_LICENSE,
        ),
    )
    print(
        f"Pipeline passed: {cleaning_report['eligibleSourceRows']} source quotations -> "
        f"{len(offers)} offer records; analysis covers "
        f"{len(analysis['corridorRankings'])} corridors."
    )
    print(f"Published {args.output}")


if __name__ == "__main__":
    main()
