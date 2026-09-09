"""Step 03 — filter, clean, and standardise comparable quotations."""

from __future__ import annotations

from pathlib import Path

from .contracts import validate_canonical_offers
from .settings import DESTINATIONS, PROVIDERS, SPEED_DAYS, number, period_label
from .step_02_validate import open_validated_sheet


def clean_quotations(path: Path, selected_period: str) -> tuple[list[dict], dict]:
    """Return analysis-ready offer records and cleaning diagnostics."""
    workbook, sheet, column = open_validated_sheet(path)
    offers: list[dict] = []
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
                    "benchmarkAmount": number(row[column[f"{tier} denomination amount"]]),
                    "benchmarkCurrency": "USD",
                    "sendAmount": local_amount,
                    "sendCurrency": "GBP",
                    "feeAmount": fee,
                    "feePct": round(fee / local_amount * 100, 4),
                    "fxMarginPct": fx_margin_pct,
                    "totalCostPct": total_cost_pct,
                    "estimatedTotalCost": round(local_amount * total_cost_pct / 100, 2),
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
            item["destination"], item["benchmarkAmount"], item["provider"], item["totalCostPct"]
        )
    )
    validate_canonical_offers(offers)
    cleaning_report = {
        "eligibleSourceRows": eligible_rows,
        "publishedOfferRecords": len(offers),
        "incompleteTierRecordsDiscarded": incomplete_tiers,
        "duplicateOfferIds": 0,
        "unexpectedSpeedLabels": unexpected_speeds,
    }
    return offers, cleaning_report
