import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dataUrl = new URL("../public/corridor-data.json", import.meta.url);

test("published dashboard data is complete and internally consistent", async () => {
  const data = JSON.parse(await readFile(dataUrl, "utf8"));
  const rankings = data.analysis.corridorRankings;

  assert.equal(data.dataQuality.status, "passed");
  assert.equal(rankings.length, 10);
  assert.equal(new Set(data.offers.map((offer) => offer.id)).size, data.offers.length);
  assert.equal(data.analysis.filters.benchmarkCurrency, "USD");
  assert.ok(data.offers.every((offer) => offer.sendCurrency === "GBP"));

  for (let index = 0; index < rankings.length; index += 1) {
    const corridor = rankings[index];
    assert.ok(corridor.providerCount >= 2);
    assert.equal(
      corridor.spreadPctPoints,
      Number((corridor.highestCostPct - corridor.lowestCostPct).toFixed(2)),
    );
    if (index > 0) {
      assert.ok(rankings[index - 1].spreadPctPoints >= corridor.spreadPctPoints);
    }
  }
});
