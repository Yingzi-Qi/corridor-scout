#!/usr/bin/env python3
"""Download, validate, clean, analyse, and publish Corridor Scout data."""

from __future__ import annotations

import argparse
import json
import re
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from openpyxl import load_workbook


SOURCE_URL = (
    "https://datacatalogfiles.worldbank.org/ddh-published/0037898/DR0095523/"
    "rpw_dataset_2011_2025_q3.xlsx"
)
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
for _tier in ("cc1", "cc2"):
    REQUIRED_COLUMNS.update(
        {
            f"{_tier} denomination amount",
            f"{_tier} lcu amount",
            f"{_tier} lcu fee",
            f"{_tier} total cost %",
            f"{_tier} fx margin",
            f"{_tier} lcu fx rate",
        }
    )


def number(value):
    return round(float(value), 6) if value not in (None, "", "..") else None


def period_key(value: str) -> tuple[int, int]:
    match = re.fullmatch(r"(\d{4})_(\d)Q", str(value))
    return (int(match.group(1)), int(match.group(2))) if match else (0, 0)


def period_label(value: str) -> str:
    year, quarter = period_key(value)
    return f"Q{quarter} {year}" if year else value


def download_workbook(url: str, destination: Path) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "Corridor-Scout/1.0"})
    with urllib.request.urlopen(request, timeout=90) as response:
        destination.write_bytes(response.read())
    return destination


def sheet_and_columns(path: Path):
    workbook = load_workbook(path, read_only=True, data_only=True)
    if SHEET_NAME not in workbook.sheetnames:
        raise ValueError(f"Required worksheet missing: {SHEET_NAME}")
    sheet = workbook[SHEET_NAME]
    headers = next(sheet.iter_rows(values_only=True))
    column = {value: index for index, value in enumerate(headers) if value}
    missing = sorted(REQUIRED_COLUMNS - set(column))
    if missing:
        raise ValueError(f"Required columns missing: {', '.join(missing)}")
    return workbook, sheet, column


def best_by_provider(offers: list[dict]) -> list[dict]:
    best: dict[str, dict] = {}
    for offer in offers:
        current = best.get(offer["provider"])
        if current is None or (
            offer["totalCostPct"], offer["speedDays"]
        ) < (current["totalCostPct"], current["speedDays"]):
            best[offer["provider"]] = offer
    return sorted(best.values(), key=lambda item: (item["totalCostPct"], item["speedDays"]))


def build_analysis(offers: list[dict]) -> dict:
    comparable = [
        offer
        for offer in offers
        if offer["benchmarkUsd"] == 200
        and offer["accessPoint"] == "Internet"
        and offer["speedDays"] <= 5
    ]
    rankings = []
    for destination in sorted(DESTINATIONS):
        provider_minima = best_by_provider(
            [offer for offer in comparable if offer["destination"] == destination]
        )
        if len(provider_minima) < 2:
            continue
        lowest, highest = provider_minima[0], provider_minima[-1]
        fee_gap = round(highest["feePct"] - lowest["feePct"], 2)
        fx_gap = round(highest["fxMarginPct"] - lowest["fxMarginPct"], 2)
        if abs(abs(fee_gap) - abs(fx_gap)) < 0.25:
            driver = "Mixed"
        elif abs(fee_gap) > abs(fx_gap):
            driver = "Fee difference"
        else:
            driver = "FX-margin difference"
        rankings.append(
            {
                "destination": destination,
                "providerCount": len(provider_minima),
                "lowestProvider": lowest["provider"],
                "lowestCostPct": lowest["totalCostPct"],
                "highestProvider": highest["provider"],
                "highestCostPct": highest["totalCostPct"],
                "spreadPctPoints": round(highest["totalCostPct"] - lowest["totalCostPct"], 2),
                "spreadGbp": round(
                    highest["estimatedTotalCostGbp"] - lowest["estimatedTotalCostGbp"], 2
                ),
                "feeGapPctPoints": fee_gap,
                "fxGapPctPoints": fx_gap,
                "primaryGapDriver": driver,
            }
        )
    rankings.sort(key=lambda item: item["spreadPctPoints"], reverse=True)
    widest = rankings[0]
    narrowest = rankings[-1]
    driver_counts = Counter(item["primaryGapDriver"] for item in rankings)
    common_driver = driver_counts.most_common(1)[0][0]
    return {
        "question": "Where do transfer costs vary most—and why?",
        "scope": "UK to 10 countries · $200 equivalent · Online · Within 3–5 days",
        "pipelineSteps": [
            "Download source workbook",
            "Validate schema and latest period",
            "Clean and standardise quotations",
            "Calculate provider and corridor metrics",
            "Publish dashboard data and findings",
        ],
        "corridorRankings": rankings,
        "findings": [
            (
                f"{widest['destination']} had the widest recorded provider spread: "
                f"{widest['spreadPctPoints']:.2f} percentage points, or about "
                f"£{widest['spreadGbp']:.2f} on the comparable send amount."
            ),
            (
                f"{narrowest['destination']} had the narrowest recorded spread among "
                f"corridors with at least two comparable providers: "
                f"{narrowest['spreadPctPoints']:.2f} percentage points."
            ),
            (
                f"The most common classified source of the provider gap was "
                f"{common_driver.lower()}; this is a diagnostic signal, not a causal claim."
            ),
        ],
    }


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
    parser.add_argument(
        "--output", type=Path, default=Path("public/corridor-data.json")
    )
    parser.add_argument(
        "--raw-cache", type=Path, default=Path("data/raw/rpw_dataset.xlsx")
    )
    parser.add_argument("--download-url", default=SOURCE_URL)
    parser.add_argument("--period", help="Optional source period such as 2025_3Q")
    args = parser.parse_args()

    source_path = args.workbook
    downloaded = source_path is None
    if source_path is None:
        print("Downloading the World Bank workbook...")
        source_path = download_workbook(args.download_url, args.raw_cache)

    workbook, sheet, column = sheet_and_columns(source_path)
    periods = set()
    input_rows = 0
    for row in sheet.iter_rows(min_row=2, values_only=True):
        input_rows += 1
        if (
            row[column["source_code"]] == "GBR"
            and row[column["firm"]] in PROVIDERS
            and row[column["destination_name"]] in DESTINATIONS
        ):
            periods.add(str(row[column["period"]]))
    workbook.close()
    if not periods:
        raise ValueError("No UK records matched the configured providers and destinations")
    selected_period = args.period or max(periods, key=period_key)
    if selected_period not in periods:
        raise ValueError(f"Requested period is unavailable: {selected_period}")

    workbook, sheet, column = sheet_and_columns(source_path)
    offers = []
    eligible_rows = 0
    incomplete_tiers = 0
    unexpected_speeds = 0
    for row in sheet.iter_rows(min_row=2, values_only=True):
        if not (
            str(row[column["period"]]) == selected_period
            and row[column["source_code"]] == "GBR"
            and row[column["firm"]] in PROVIDERS
            and row[column["destination_name"]] in DESTINATIONS
            and str(row[column["transparent"]]).lower() == "yes"
        ):
            continue
        eligible_rows += 1
        speed = row[column["speed actual"]]
        if speed not in SPEED_DAYS:
            unexpected_speeds += 1

        for tier in ("cc1", "cc2"):
            local_amount = number(row[column[f"{tier} lcu amount"]])
            fee = number(row[column[f"{tier} lcu fee"]])
            total_cost_pct = number(row[column[f"{tier} total cost %"]])
            fx_margin_pct = number(row[column[f"{tier} fx margin"]])
            if None in (local_amount, fee, total_cost_pct, fx_margin_pct):
                incomplete_tiers += 1
                continue
            offers.append(
                {
                    "id": f"{row[column['id']]}-{tier}",
                    "sourceRowId": str(row[column["id"]]),
                    "period": period_label(selected_period),
                    "origin": "United Kingdom",
                    "destination": row[column["destination_name"]],
                    "provider": row[column["firm"]],
                    "providerType": row[column["firm_type"]],
                    "fundingMethod": row[column["payment instrument"]],
                    "accessPoint": row[column["access point"]],
                    "receiveMethod": row[column["pickup method"]],
                    "speed": speed,
                    "speedDays": SPEED_DAYS.get(speed, 99),
                    "benchmarkUsd": number(row[column[f"{tier} denomination amount"]]),
                    "sendAmountGbp": local_amount,
                    "feeGbp": fee,
                    "feePct": round(fee / local_amount * 100, 4),
                    "fxMarginPct": fx_margin_pct,
                    "totalCostPct": total_cost_pct,
                    "estimatedTotalCostGbp": round(local_amount * total_cost_pct / 100, 2),
                    "providerFxRate": number(row[column[f"{tier} lcu fx rate"]]),
                    "interbankFxRate": number(row[column["inter lcu bank fx"]]),
                    "collectionDate": (
                        row[column["date"]].date().isoformat()
                        if hasattr(row[column["date"]], "date")
                        else str(row[column["date"]])
                    ),
                    "coverage": row[column["receiving network coverage"]],
                    "note": row[column["Standard Note"]] or "",
                }
            )
    workbook.close()
    offers.sort(
        key=lambda item: (
            item["destination"], item["benchmarkUsd"], item["provider"], item["totalCostPct"]
        )
    )
    duplicate_ids = len(offers) - len({offer["id"] for offer in offers})
    quality = {
        "status": "passed" if duplicate_ids == 0 and unexpected_speeds == 0 else "review",
        "sourceRowsScanned": input_rows,
        "eligibleSourceRows": eligible_rows,
        "publishedOfferRecords": len(offers),
        "incompleteTierRecordsDiscarded": incomplete_tiers,
        "duplicateOfferIds": duplicate_ids,
        "unexpectedSpeedLabels": unexpected_speeds,
    }
    payload = {
        "metadata": {
            "title": "World Bank Remittance Prices Worldwide",
            "sourceUrl": "https://remittanceprices.worldbank.org/data-download",
            "methodologyUrl": "https://remittanceprices.worldbank.org/methodology",
            "license": "CC BY 4.0",
            "period": period_label(selected_period),
            "sourcePeriodCode": selected_period,
            "origin": "United Kingdom",
            "scope": "Five providers across ten common UK-origin corridors",
            "recordCount": len(offers),
            "sourceRecordCount": eligible_rows,
            "providers": sorted(PROVIDERS),
            "destinations": sorted(DESTINATIONS),
            "pipelineRunAt": datetime.now(timezone.utc).isoformat(),
            "sourceMode": "downloaded" if downloaded else "local workbook",
        },
        "dataQuality": quality,
        "analysis": build_analysis(offers),
        "offers": offers,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    print(
        f"Pipeline passed: {eligible_rows} source quotations -> {len(offers)} offer records; "
        f"analysis covers {len(payload['analysis']['corridorRankings'])} corridors."
    )
    print(f"Published {args.output}")


if __name__ == "__main__":
    main()
