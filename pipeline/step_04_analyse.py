"""Step 04 — calculate provider minima and cross-corridor metrics."""

from __future__ import annotations

from collections import Counter

from .contracts import AnalysisScope, validate_canonical_offers


def best_by_provider(offers: list[dict]) -> list[dict]:
    """Keep each provider's lowest-cost offer; break ties with recorded speed."""
    best: dict[str, dict] = {}
    for offer in offers:
        current = best.get(offer["provider"])
        if current is None or (
            offer["totalCostPct"], offer["speedDays"]
        ) < (current["totalCostPct"], current["speedDays"]):
            best[offer["provider"]] = offer
    return sorted(
        best.values(), key=lambda item: (item["totalCostPct"], item["speedDays"])
    )


def classify_gap_driver(fee_gap: float, fx_gap: float, tolerance: float = 0.25) -> str:
    """Classify the larger observed component without making a causal claim."""
    if abs(abs(fee_gap) - abs(fx_gap)) < tolerance:
        return "Mixed"
    return "Fee difference" if abs(fee_gap) > abs(fx_gap) else "FX-margin difference"


def money_label(amount: float, currency: str) -> str:
    symbol = {"GBP": "£", "USD": "$", "EUR": "€"}.get(currency)
    return f"{symbol or currency + ' '}{amount:.2f}"


def calculate_metrics(offers: list[dict], scope: AnalysisScope | None = None) -> dict:
    """Answer the fixed cross-corridor question and write concise findings."""
    validate_canonical_offers(offers)
    scope = scope or AnalysisScope()
    comparable = [
        offer
        for offer in offers
        if offer["benchmarkAmount"] == scope.benchmark_amount
        and offer["benchmarkCurrency"] == scope.benchmark_currency
        and offer["accessPoint"] == scope.access_point
        and offer["speedDays"] <= scope.max_speed_days
    ]
    rankings = []
    for destination in sorted({offer["destination"] for offer in comparable}):
        provider_minima = best_by_provider(
            [offer for offer in comparable if offer["destination"] == destination]
        )
        if len(provider_minima) < 2:
            continue
        currencies = {offer["sendCurrency"] for offer in provider_minima}
        if len(currencies) != 1:
            raise ValueError(f"Corridor {destination} mixes send currencies")
        lowest, highest = provider_minima[0], provider_minima[-1]
        fee_gap = round(highest["feePct"] - lowest["feePct"], 2)
        fx_gap = round(highest["fxMarginPct"] - lowest["fxMarginPct"], 2)
        rankings.append(
            {
                "destination": destination,
                "providerCount": len(provider_minima),
                "lowestProvider": lowest["provider"],
                "lowestCostPct": lowest["totalCostPct"],
                "highestProvider": highest["provider"],
                "highestCostPct": highest["totalCostPct"],
                "spreadPctPoints": round(highest["totalCostPct"] - lowest["totalCostPct"], 2),
                "spreadAmount": round(
                    highest["estimatedTotalCost"] - lowest["estimatedTotalCost"], 2
                ),
                "sendCurrency": lowest["sendCurrency"],
                "feeGapPctPoints": fee_gap,
                "fxGapPctPoints": fx_gap,
                "primaryGapDriver": classify_gap_driver(fee_gap, fx_gap),
            }
        )

    if not rankings:
        raise ValueError("No corridors contain at least two comparable providers")

    rankings.sort(key=lambda item: item["spreadPctPoints"], reverse=True)
    widest, narrowest = rankings[0], rankings[-1]
    common_driver = Counter(
        item["primaryGapDriver"] for item in rankings
    ).most_common(1)[0][0]
    origins = {offer["origin"] for offer in comparable}
    origin = next(iter(origins)) if len(origins) == 1 else "Multiple origins"
    return {
        "scope": f"{origin} to {len(rankings)} countries · {scope.label()}",
        "filters": {
            "benchmarkAmount": scope.benchmark_amount,
            "benchmarkCurrency": scope.benchmark_currency,
            "accessPoint": scope.access_point,
            "maxSpeedDays": scope.max_speed_days,
        },
        "corridorRankings": rankings,
        "findings": [
            (
                f"{widest['destination']} had the widest recorded provider spread: "
                f"{widest['spreadPctPoints']:.2f} percentage points, or about "
                f"{money_label(widest['spreadAmount'], widest['sendCurrency'])} "
                f"on the comparable send amount."
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
