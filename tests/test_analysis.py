from __future__ import annotations

import unittest

from pipeline.contracts import validate_canonical_offers
from pipeline.step_04_analyse import (
    best_by_provider,
    calculate_metrics,
    classify_gap_driver,
)


def offer(
    offer_id: str,
    destination: str,
    provider: str,
    total_cost: float,
    fee_pct: float,
    fx_margin: float,
    speed_days: float = 5,
) -> dict:
    send_amount = 120.0
    return {
        "id": offer_id,
        "sourceRowId": offer_id,
        "period": "Q3 2025",
        "origin": "United Kingdom",
        "destination": destination,
        "provider": provider,
        "providerType": "Test provider",
        "fundingMethod": "Bank transfer",
        "accessPoint": "Internet",
        "receiveMethod": "Account",
        "speed": "3-5 days",
        "speedDays": speed_days,
        "benchmarkAmount": 200.0,
        "benchmarkCurrency": "USD",
        "sendAmount": send_amount,
        "sendCurrency": "GBP",
        "feeAmount": round(send_amount * fee_pct / 100, 2),
        "feePct": fee_pct,
        "fxMarginPct": fx_margin,
        "totalCostPct": total_cost,
        "estimatedTotalCost": round(send_amount * total_cost / 100, 2),
        "providerFxRate": 100.0,
        "interbankFxRate": 101.0,
        "collectionDate": "2025-09-01",
        "coverage": "National",
        "note": "",
    }


class AnalysisTests(unittest.TestCase):
    def test_provider_minimum_uses_speed_as_tie_breaker(self):
        offers = [
            offer("slow", "Alpha", "Provider A", 2.0, 1.0, 1.0, 5),
            offer("fast", "Alpha", "Provider A", 2.0, 1.0, 1.0, 1),
            offer("other", "Alpha", "Provider B", 3.0, 1.5, 1.5, 2),
        ]

        selected = best_by_provider(offers)

        self.assertEqual([item["id"] for item in selected], ["fast", "other"])

    def test_metrics_rank_corridors_and_classify_gap_driver(self):
        offers = [
            offer("a-low", "Alpha", "Provider A", 1.0, 0.25, 0.75),
            offer("a-high", "Alpha", "Provider B", 4.0, 2.25, 1.75),
            offer("b-low", "Beta", "Provider A", 1.0, 0.2, 0.8),
            offer("b-high", "Beta", "Provider B", 6.0, 1.2, 4.8),
        ]

        analysis = calculate_metrics(offers)
        rankings = analysis["corridorRankings"]

        self.assertEqual([item["destination"] for item in rankings], ["Beta", "Alpha"])
        self.assertEqual(analysis["filters"]["benchmarkCurrency"], "USD")
        self.assertEqual(rankings[0]["primaryGapDriver"], "FX-margin difference")
        self.assertEqual(rankings[1]["primaryGapDriver"], "Fee difference")
        self.assertEqual(classify_gap_driver(1.0, 0.8), "Mixed")

    def test_contract_rejects_missing_fields_and_duplicate_ids(self):
        valid = offer("one", "Alpha", "Provider A", 1.0, 0.5, 0.5)
        missing = dict(valid)
        missing.pop("destination")

        with self.assertRaisesRegex(ValueError, "missing: destination"):
            validate_canonical_offers([missing])
        with self.assertRaisesRegex(ValueError, "Duplicate canonical offer id"):
            validate_canonical_offers([valid, dict(valid)])


if __name__ == "__main__":
    unittest.main()
