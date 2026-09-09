"""Canonical records shared by source adapters, analysis, and publishing."""

from __future__ import annotations

from dataclasses import dataclass
from math import isfinite


CANONICAL_OFFER_FIELDS = {
    "id",
    "sourceRowId",
    "period",
    "origin",
    "destination",
    "provider",
    "providerType",
    "fundingMethod",
    "accessPoint",
    "receiveMethod",
    "speed",
    "speedDays",
    "benchmarkAmount",
    "benchmarkCurrency",
    "sendAmount",
    "sendCurrency",
    "feeAmount",
    "feePct",
    "fxMarginPct",
    "totalCostPct",
    "estimatedTotalCost",
    "providerFxRate",
    "interbankFxRate",
    "collectionDate",
    "coverage",
    "note",
}

NUMERIC_FIELDS = {
    "speedDays",
    "benchmarkAmount",
    "sendAmount",
    "feeAmount",
    "feePct",
    "fxMarginPct",
    "totalCostPct",
    "estimatedTotalCost",
}


@dataclass(frozen=True)
class AnalysisScope:
    benchmark_amount: float = 200
    benchmark_currency: str = "USD"
    access_point: str = "Internet"
    max_speed_days: float = 5

    def label(self) -> str:
        symbol = {"GBP": "£", "USD": "$", "EUR": "€"}.get(
            self.benchmark_currency, f"{self.benchmark_currency} "
        )
        amount = f"{self.benchmark_amount:g}"
        access = "Online" if self.access_point == "Internet" else self.access_point
        speed = (
            "Within 3–5 days"
            if self.max_speed_days == 5
            else f"Within {self.max_speed_days:g} days"
        )
        return f"{symbol}{amount} equivalent · {access} · {speed}"


@dataclass(frozen=True)
class SourceMetadata:
    title: str
    source_url: str
    methodology_url: str
    license: str


def validate_canonical_offers(offers: list[dict]) -> None:
    """Fail before analysis when an adapter emits incomplete or invalid records."""
    if not offers:
        raise ValueError("The source adapter produced no offer records")

    ids: set[str] = set()
    for index, offer in enumerate(offers, start=1):
        missing = CANONICAL_OFFER_FIELDS - set(offer)
        if missing:
            raise ValueError(
                f"Canonical offer {index} is missing: {', '.join(sorted(missing))}"
            )
        if offer["id"] in ids:
            raise ValueError(f"Duplicate canonical offer id: {offer['id']}")
        ids.add(offer["id"])

        for field in NUMERIC_FIELDS:
            value = offer[field]
            if not isinstance(value, (int, float)) or not isfinite(value):
                raise ValueError(f"Canonical offer {offer['id']} has invalid {field}")

        if offer["sendAmount"] <= 0:
            raise ValueError(f"Canonical offer {offer['id']} has an invalid send amount")
        for field in ("benchmarkCurrency", "sendCurrency"):
            if not isinstance(offer[field], str) or len(offer[field]) != 3:
                raise ValueError(f"Canonical offer {offer['id']} has invalid {field}")
