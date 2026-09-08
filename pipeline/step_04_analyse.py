"""Step 04 — calculate provider minima and cross-corridor metrics."""

from __future__ import annotations

from collections import Counter

from .settings import DESTINATIONS


def best_by_provider(offers: list[dict]) -> list[dict]:
    """Keep each provider's lowest-cost offer; break ties with recorded speed."""
    best: dict[str, dict] = {}
    for offer in offers:
        current = best.get(offer["provider"])
        if current is None or (
            offer["totalCostPct"], offer["speedDays"]
        ) < (current["totalCostPct"], current["speedDays"]):
            best[offer["provider"]] = offer
    return sorted(best.values(), key=lambda item: (item["totalCostPct"], item["speedDays"]))


def calculate_metrics(offers: list[dict]) -> dict:
    """Answer the fixed cross-corridor question and write concise findings."""
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
    widest, narrowest = rankings[0], rankings[-1]
    common_driver = Counter(item["primaryGapDriver"] for item in rankings).most_common(1)[0][0]
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
