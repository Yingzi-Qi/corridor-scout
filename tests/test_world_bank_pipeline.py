from __future__ import annotations

import json
import tempfile
import unittest
from datetime import datetime
from pathlib import Path

from openpyxl import Workbook

from pipeline.contracts import SourceMetadata
from pipeline.settings import REQUIRED_COLUMNS, SHEET_NAME
from pipeline.step_02_validate import validate_source
from pipeline.step_03_clean import clean_quotations
from pipeline.step_04_analyse import calculate_metrics
from pipeline.step_05_publish import publish_dashboard_data


def source_row(row_id: str, provider: str, total_cost: float) -> dict:
    values = {
        "id": row_id,
        "period": "2025_3Q",
        "source_code": "GBR",
        "destination_name": "India",
        "firm": provider,
        "firm_type": "MTO",
        "transparent": "yes",
        "payment instrument": "Bank transfer",
        "access point": "Internet",
        "pickup method": "Account",
        "speed actual": "3-5 days",
        "date": datetime(2025, 9, 1),
        "receiving network coverage": "National",
        "Standard Note": "",
        "inter lcu bank fx": 101.0,
    }
    for tier, amount in (("cc1", 120.0), ("cc2", 300.0)):
        values.update(
            {
                f"{tier} denomination amount": 200 if tier == "cc1" else 500,
                f"{tier} lcu amount": amount,
                f"{tier} lcu fee": amount * 0.01,
                f"{tier} total cost %": total_cost,
                f"{tier} fx margin": total_cost - 1.0,
                f"{tier} lcu fx rate": 100.0,
            }
        )
    return values


class WorldBankPipelineTests(unittest.TestCase):
    def test_workbook_to_published_json(self):
        headers = sorted(REQUIRED_COLUMNS)
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = SHEET_NAME
        sheet.append(headers)
        for values in (
            source_row("row-a", "Wise", 1.5),
            source_row("row-b", "Remitly", 3.0),
        ):
            sheet.append([values.get(header) for header in headers])

        with tempfile.TemporaryDirectory() as directory:
            workbook_path = Path(directory) / "source.xlsx"
            output_path = Path(directory) / "dashboard.json"
            workbook.save(workbook_path)

            validation = validate_source(workbook_path)
            offers, cleaning = clean_quotations(workbook_path, validation["selectedPeriod"])
            analysis = calculate_metrics(offers)
            published = publish_dashboard_data(
                offers,
                analysis,
                validation,
                cleaning,
                output_path,
                SourceMetadata("Test source", "https://example.com", "", "Test license"),
            )

            self.assertEqual(validation["schemaStatus"], "passed")
            self.assertEqual(len(offers), 4)
            self.assertEqual(offers[0]["sendCurrency"], "GBP")
            self.assertNotIn("sendAmountGbp", offers[0])
            self.assertEqual(published["metadata"]["providers"], ["Remitly", "Wise"])
            self.assertEqual(published["analysis"]["corridorRankings"][0]["destination"], "India")
            self.assertEqual(json.loads(output_path.read_text()), published)


if __name__ == "__main__":
    unittest.main()
