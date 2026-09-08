"""Step 05 — package quality results, metrics, and offers for the dashboard."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from .settings import (
    DESTINATIONS,
    METHODOLOGY_URL,
    PROVIDERS,
    SOURCE_PAGE_URL,
    period_label,
)
def publish_dashboard_data(
    offers: list[dict],
    analysis: dict,
    validation: dict,
    cleaning_report: dict,
    output: Path,
    source_mode: str,
) -> dict:
    """Write one self-contained JSON file consumed by the dashboard."""
    duplicate_ids = cleaning_report["duplicateOfferIds"]
    unexpected_speeds = cleaning_report["unexpectedSpeedLabels"]
    quality = {
        "status": "passed" if duplicate_ids == 0 and unexpected_speeds == 0 else "review",
        "sourceRowsScanned": validation["sourceRowsScanned"],
        **cleaning_report,
    }
    selected_period = validation["selectedPeriod"]
    payload = {
        "metadata": {
            "title": "World Bank Remittance Prices Worldwide",
            "sourceUrl": SOURCE_PAGE_URL,
            "methodologyUrl": METHODOLOGY_URL,
            "license": "CC BY 4.0",
            "period": period_label(selected_period),
            "sourcePeriodCode": selected_period,
            "origin": "United Kingdom",
            "scope": "Five providers across ten common UK-origin corridors",
            "recordCount": len(offers),
            "sourceRecordCount": cleaning_report["eligibleSourceRows"],
            "providers": sorted(PROVIDERS),
            "destinations": sorted(DESTINATIONS),
            "pipelineRunAt": datetime.now(timezone.utc).isoformat(),
            "sourceMode": source_mode,
        },
        "dataQuality": quality,
        "analysis": analysis,
        "offers": offers,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    return payload
