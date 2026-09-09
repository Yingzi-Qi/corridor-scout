"""Step 05 — package quality results, metrics, and offers for the dashboard."""

from __future__ import annotations

import json
from pathlib import Path

from .contracts import SourceMetadata, validate_canonical_offers
from .settings import period_label


def publish_dashboard_data(
    offers: list[dict],
    analysis: dict,
    validation: dict,
    cleaning_report: dict,
    output: Path,
    source: SourceMetadata,
) -> dict:
    """Write one self-contained JSON file consumed by the dashboard."""
    validate_canonical_offers(offers)
    duplicate_ids = cleaning_report["duplicateOfferIds"]
    unexpected_speeds = cleaning_report["unexpectedSpeedLabels"]
    quality = {
        "status": "passed" if duplicate_ids == 0 and unexpected_speeds == 0 else "review",
        "sourceRowsScanned": validation["sourceRowsScanned"],
        **cleaning_report,
    }
    selected_period = validation["selectedPeriod"]
    providers = sorted({offer["provider"] for offer in offers})
    destinations = sorted({offer["destination"] for offer in offers})
    payload = {
        "metadata": {
            "title": source.title,
            "sourceUrl": source.source_url,
            "methodologyUrl": source.methodology_url,
            "license": source.license,
            "period": period_label(selected_period),
            "sourcePeriodCode": selected_period,
            "origin": offers[0]["origin"],
            "scope": f"{len(providers)} providers across {len(destinations)} corridors",
            "recordCount": len(offers),
            "sourceRecordCount": cleaning_report["eligibleSourceRows"],
            "providers": providers,
            "destinations": destinations,
        },
        "dataQuality": quality,
        "analysis": analysis,
        "offers": offers,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    return payload
