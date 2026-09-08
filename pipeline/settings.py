"""Shared source, scope, and normalisation settings."""

from __future__ import annotations

import re


# INPUT DATA SOURCE
# -----------------
# Default: World Bank Remittance Prices Worldwide Excel workbook.
#
# To use another release with the SAME workbook structure, either replace
# SOURCE_URL below or pass `--download-url <URL>` when running the pipeline.
#
# A completely different dataset will need a small adapter:
# - update SHEET_NAME and REQUIRED_COLUMNS here;
# - map its columns to the standard offer fields in step_03_clean.py.
# Steps 04 and 05 can then be reused without changes.
SOURCE_URL = (
    "https://datacatalogfiles.worldbank.org/ddh-published/0037898/DR0095523/"
    "rpw_dataset_2011_2025_q3.xlsx"
)
SOURCE_PAGE_URL = "https://remittanceprices.worldbank.org/data-download"
METHODOLOGY_URL = "https://remittanceprices.worldbank.org/methodology"
SHEET_NAME = "Dataset (from Q2 2016)"

PROVIDERS = {"Wise", "Remitly", "WorldRemit", "Western Union", "MoneyGram"}
DESTINATIONS = {
    "Bangladesh",
    "Ghana",
    "India",
    "Kenya",
    "Pakistan",
    "Philippines",
    "South Africa",
    "Tanzania",
    "Thailand",
    "Uganda",
}
SPEED_DAYS = {
    "Less than one hour": 0.04,
    "Same day": 0.5,
    "Next day": 1,
    "2 days": 2,
    "3-5 days": 5,
    "6 days or more": 6,
}

REQUIRED_COLUMNS = {
    "id",
    "period",
    "source_code",
    "destination_name",
    "firm",
    "firm_type",
    "transparent",
    "payment instrument",
    "access point",
    "pickup method",
    "speed actual",
    "date",
    "receiving network coverage",
    "Standard Note",
    "inter lcu bank fx",
}
for tier in ("cc1", "cc2"):
    REQUIRED_COLUMNS.update(
        {
            f"{tier} denomination amount",
            f"{tier} lcu amount",
            f"{tier} lcu fee",
            f"{tier} total cost %",
            f"{tier} fx margin",
            f"{tier} lcu fx rate",
        }
    )


def number(value):
    """Return a normalised number, or None for missing workbook cells."""
    return round(float(value), 6) if value not in (None, "", "..") else None


def period_key(value: str) -> tuple[int, int]:
    """Convert a World Bank period such as 2025_3Q into a sortable key."""
    match = re.fullmatch(r"(\d{4})_(\d)Q", str(value))
    return (int(match.group(1)), int(match.group(2))) if match else (0, 0)


def period_label(value: str) -> str:
    """Convert 2025_3Q into the display label Q3 2025."""
    year, quarter = period_key(value)
    return f"Q{quarter} {year}" if year else value
