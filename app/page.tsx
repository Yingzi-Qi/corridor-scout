"use client";

import { useEffect, useMemo, useState } from "react";

type Offer = {
  id: string;
  sourceRowId: string;
  period: string;
  origin: string;
  destination: string;
  provider: string;
  providerType: string;
  fundingMethod: string;
  accessPoint: string;
  receiveMethod: string;
  speed: string;
  speedDays: number;
  benchmarkUsd: number;
  sendAmountGbp: number;
  feeGbp: number;
  feePct: number;
  fxMarginPct: number;
  totalCostPct: number;
  estimatedTotalCostGbp: number;
  providerFxRate: number;
  interbankFxRate: number;
  collectionDate: string;
  coverage: string;
  note: string;
};

type Dataset = {
  metadata: {
    title: string;
    sourceUrl: string;
    methodologyUrl: string;
    license: string;
    period: string;
    origin: string;
    scope: string;
    recordCount: number;
    sourceRecordCount: number;
    providers: string[];
    destinations: string[];
  };
  dataQuality: {
    status: string;
    sourceRowsScanned: number;
    eligibleSourceRows: number;
    publishedOfferRecords: number;
    incompleteTierRecordsDiscarded: number;
    duplicateOfferIds: number;
    unexpectedSpeedLabels: number;
  };
  analysis: {
    question: string;
    scope: string;
    pipelineSteps: string[];
    findings: string[];
    corridorRankings: Array<{
      destination: string;
      providerCount: number;
      lowestProvider: string;
      lowestCostPct: number;
      highestProvider: string;
      highestCostPct: number;
      spreadPctPoints: number;
      spreadGbp: number;
      feeGapPctPoints: number;
      fxGapPctPoints: number;
      primaryGapDriver: string;
    }>;
  };
  offers: Offer[];
};

const SPEED_OPTIONS = [
  { label: "Under one hour", value: 0.04 },
  { label: "Same day", value: 0.5 },
  { label: "By next day", value: 1 },
  { label: "Within 2 days", value: 2 },
  { label: "Within 3–5 days", value: 5 },
  { label: "Any recorded speed", value: 99 },
];

const PROVIDER_CLASS: Record<string, string> = {
  Wise: "wise",
  Remitly: "remitly",
  WorldRemit: "worldremit",
  "Western Union": "western-union",
  MoneyGram: "moneygram",
};

const SPEED_POSITION: Record<string, number> = {
  "Less than one hour": 4,
  "Same day": 22,
  "Next day": 40,
  "2 days": 58,
  "3-5 days": 76,
  "6 days or more": 94,
};

const DRIVER_FILTERS = [
  { label: "All", value: "All" },
  { label: "FX margin", value: "FX-margin difference" },
  { label: "Fees", value: "Fee difference" },
  { label: "Mixed", value: "Mixed" },
];

function driverLabel(driver: string) {
  if (driver === "FX-margin difference") return "FX margin";
  if (driver === "Fee difference") return "Fees";
  return "Mixed";
}

function driverClass(driver: string) {
  if (driver === "FX-margin difference") return "driver-fx";
  if (driver === "Fee difference") return "driver-fee";
  return "driver-mixed";
}

function currency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(value);
}

function percent(value: number) {
  return `${value.toFixed(2)}%`;
}

function bestOfferPerProvider(offers: Offer[]) {
  const best = new Map<string, Offer>();
  offers.forEach((offer) => {
    const current = best.get(offer.provider);
    if (
      !current ||
      offer.totalCostPct < current.totalCostPct ||
      (offer.totalCostPct === current.totalCostPct && offer.speedDays < current.speedDays)
    ) {
      best.set(offer.provider, offer);
    }
  });
  return [...best.values()].sort(
    (a, b) => a.totalCostPct - b.totalCostPct || a.speedDays - b.speedDays,
  );
}

function isParetoEfficient(offer: Offer, offers: Offer[]) {
  return !offers.some(
    (candidate) =>
      candidate.id !== offer.id &&
      candidate.totalCostPct <= offer.totalCostPct &&
      candidate.speedDays <= offer.speedDays &&
      (candidate.totalCostPct < offer.totalCostPct || candidate.speedDays < offer.speedDays),
  );
}

export default function Home() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [destination, setDestination] = useState("India");
  const [benchmark, setBenchmark] = useState(200);
  const [funding, setFunding] = useState("All");
  const [receiving, setReceiving] = useState("All");
  const [access, setAccess] = useState("Internet");
  const [maxSpeed, setMaxSpeed] = useState(5);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [driverFilter, setDriverFilter] = useState("All");

  useEffect(() => {
    fetch("corridor-data.json")
      .then((response) => response.json())
      .then((data: Dataset) => setDataset(data));
  }, []);

  const baseOffers = useMemo(() => {
    if (!dataset) return [];
    return dataset.offers.filter(
      (offer) => offer.destination === destination && offer.benchmarkUsd === benchmark,
    );
  }, [dataset, destination, benchmark]);

  const fundingOptions = useMemo(
    () => [...new Set(baseOffers.map((offer) => offer.fundingMethod))].sort(),
    [baseOffers],
  );
  const receivingOptions = useMemo(
    () => [...new Set(baseOffers.map((offer) => offer.receiveMethod))].sort(),
    [baseOffers],
  );
  const accessOptions = useMemo(
    () => [...new Set(baseOffers.map((offer) => offer.accessPoint))].sort(),
    [baseOffers],
  );

  const qualifyingOffers = useMemo(
    () =>
      baseOffers.filter(
        (offer) =>
          (funding === "All" || offer.fundingMethod === funding) &&
          (receiving === "All" || offer.receiveMethod === receiving) &&
          (access === "All" || offer.accessPoint === access) &&
          offer.speedDays <= maxSpeed,
      ),
    [baseOffers, funding, receiving, access, maxSpeed],
  );

  const rankedOffers = useMemo(
    () => bestOfferPerProvider(qualifyingOffers),
    [qualifyingOffers],
  );
  const cheapest = rankedOffers[0] ?? null;
  const fastest = useMemo(
    () =>
      [...rankedOffers].sort(
        (a, b) => a.speedDays - b.speedDays || a.totalCostPct - b.totalCostPct,
      )[0] ?? null,
    [rankedOffers],
  );
  const selected =
    rankedOffers.find((offer) => offer.id === selectedId) ?? cheapest;
  const mostExpensive = rankedOffers.at(-1) ?? null;
  const spread =
    cheapest && mostExpensive
      ? mostExpensive.estimatedTotalCostGbp - cheapest.estimatedTotalCostGbp
      : 0;

  const maxChartCost = Math.max(
    1,
    ...rankedOffers.map((offer) => Math.ceil(offer.totalCostPct + 1)),
  );

  if (!dataset) {
    return (
      <main className="loading-screen">
        <div className="loading-mark">CS</div>
        <p>Preparing corridor comparison…</p>
      </main>
    );
  }

  const topCorridors = dataset.analysis.corridorRankings.slice(0, 5);
  const maxCorridorSpread = topCorridors[0]?.spreadPctPoints ?? 1;
  const summaryRows = dataset.analysis.corridorRankings.filter(
    (corridor) => driverFilter === "All" || corridor.primaryGapDriver === driverFilter,
  );
  const lowestAcrossCorridors = [...dataset.analysis.corridorRankings].sort(
    (a, b) => a.lowestCostPct - b.lowestCostPct,
  )[0];
  const feeLedCount = dataset.analysis.corridorRankings.filter(
    (corridor) => corridor.primaryGapDriver === "Fee difference",
  ).length;

  function openCorridor(nextDestination: string) {
    setDestination(nextDestination);
    setBenchmark(200);
    setFunding("All");
    setReceiving("All");
    setAccess("Internet");
    setMaxSpeed(5);
    setSelectedId(null);
    window.requestAnimationFrame(() => {
      document.getElementById("corridor-explorer")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Corridor Scout home">
          <span className="brand-mark">CS</span>
          <span>
            <strong>Corridor Scout</strong>
            <small>Cross-border cost explorer</small>
          </span>
        </a>
        <div className="header-meta">
          <span>Independent prototype</span>
          <a href={dataset.metadata.sourceUrl} target="_blank" rel="noreferrer">
            World Bank source ↗
          </a>
        </div>
      </header>

      <section className="intro" id="top">
        <div>
          <p className="eyebrow">Corridor analysis from raw workbook</p>
          <h1>Where do UK remittance costs diverge—and what drives the gap?</h1>
        </div>
        <div className="intro-copy">
          <span>Project abstract</span>
          <p>
            Using the World Bank&apos;s {dataset.metadata.period} pricing workbook,
            Corridor Scout compares {dataset.metadata.providers.length} providers across{" "}
            {dataset.analysis.corridorRankings.length} UK outbound corridors. It shows where
            providers&apos; lowest qualifying costs diverged most, which provider recorded the
            lowest cost, and whether fees or FX margins drove the difference.
          </p>
          <div className="decision-caption">
            <strong>Decision use</strong>
            <p>Prioritise corridors for closer pricing investigation and identify which cost component to examine first.</p>
          </div>
          <p className="scope-caption">{dataset.analysis.scope}</p>
        </div>
      </section>

      <section className="pipeline-section" aria-label="Automated analysis pipeline">
        <div className="workstream-card">
          <div>
            <p className="eyebrow">Workstream</p>
            <h2>Cross-border payment competitive intelligence</h2>
          </div>
          <div className="quality-stamp">
            <span>Data checks</span>
            <strong>{dataset.dataQuality.status}</strong>
          </div>
        </div>
        <div className="pipeline-flow">
          {dataset.analysis.pipelineSteps.map((step, index) => (
            <div key={step}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{step}</p>
            </div>
          ))}
        </div>
        <div className="pipeline-proof">
          <div><strong>{dataset.dataQuality.sourceRowsScanned.toLocaleString()}</strong><span>source rows scanned</span></div>
          <div><strong>{dataset.dataQuality.eligibleSourceRows}</strong><span>eligible quotations</span></div>
          <div><strong>{dataset.dataQuality.publishedOfferRecords}</strong><span>clean offer records</span></div>
          <div><strong>{dataset.analysis.corridorRankings.length}</strong><span>corridors analysed</span></div>
        </div>
        <a className="pipeline-code-link" href="https://github.com/Yingzi-Qi/corridor-scout/tree/main/pipeline" target="_blank" rel="noreferrer">
          View the five pipeline modules ↗
        </a>
      </section>

      <section className="summary-section" aria-labelledby="workbook-answers-title">
        <div className="summary-heading">
          <div>
            <p className="eyebrow">Answers from the workbook</p>
            <h2 id="workbook-answers-title">All ten corridors, one clear comparison.</h2>
          </div>
          <p>
            Ranked by the difference between each corridor&apos;s lowest and highest
            provider minimum under the fixed comparison scope.
          </p>
        </div>

        <div className="summary-cards">
          <article>
            <span>Widest provider gap</span>
            <strong>{dataset.analysis.corridorRankings[0].destination}</strong>
            <p>{dataset.analysis.corridorRankings[0].spreadPctPoints.toFixed(2)} percentage points</p>
          </article>
          <article>
            <span>Lowest cost in the comparison</span>
            <strong>{lowestAcrossCorridors.lowestProvider}</strong>
            <p>{percent(lowestAcrossCorridors.lowestCostPct)} · UK to {lowestAcrossCorridors.destination}</p>
          </article>
          <article>
            <span>Most common gap driver</span>
            <strong>Fees</strong>
            <p>{feeLedCount} of {dataset.analysis.corridorRankings.length} corridors</p>
          </article>
        </div>

        <div className="summary-toolbar">
          <div>
            <strong>Filter by main source of the gap</strong>
            <span>Select a corridor to open its detailed provider comparison.</span>
          </div>
          <div className="driver-filters" aria-label="Filter corridors by gap driver">
            {DRIVER_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={driverFilter === filter.value ? "active" : ""}
                aria-pressed={driverFilter === filter.value}
                onClick={() => setDriverFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="summary-table-card">
          <div className="table-wrap">
            <table className="corridor-summary-table">
              <thead>
                <tr className="group-header">
                  <th colSpan={3}>Corridor priority</th>
                  <th colSpan={2}>Lowest qualifying offer</th>
                  <th>Gap diagnosis</th>
                </tr>
                <tr>
                  <th>Rank</th>
                  <th>UK outbound corridor</th>
                  <th>Provider cost gap</th>
                  <th>Lowest recorded provider</th>
                  <th>Lowest cost</th>
                  <th>Main source of gap</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((corridor) => {
                  const rank = dataset.analysis.corridorRankings.findIndex(
                    (item) => item.destination === corridor.destination,
                  ) + 1;
                  return (
                    <tr key={corridor.destination}>
                      <td className="summary-rank">{String(rank).padStart(2, "0")}</td>
                      <td>
                        <button
                          type="button"
                          className="corridor-link"
                          onClick={() => openCorridor(corridor.destination)}
                        >
                          <strong>UK → {corridor.destination}</strong>
                          <span>Open detailed comparison ↓</span>
                        </button>
                      </td>
                      <td>
                        <div className="gap-value">
                          <strong>{corridor.spreadPctPoints.toFixed(2)} pp</strong>
                          <small>about {currency(corridor.spreadGbp)}</small>
                        </div>
                        <div className="summary-gap-track" aria-hidden="true">
                          <span style={{ width: `${(corridor.spreadPctPoints / maxCorridorSpread) * 100}%` }} />
                        </div>
                      </td>
                      <td>
                        <div className="summary-provider">
                          <span className={`provider-dot ${PROVIDER_CLASS[corridor.lowestProvider] ?? ""}`} />
                          <strong>{corridor.lowestProvider}</strong>
                        </div>
                      </td>
                      <td className="summary-lowest-cost">{percent(corridor.lowestCostPct)}</td>
                      <td>
                        <span className={`driver-tag ${driverClass(corridor.primaryGapDriver)}`}>
                          {driverLabel(corridor.primaryGapDriver)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="summary-footnote">
            Fixed view: $200 equivalent · Internet access · delivery within 3–5 days · one lowest-cost qualifying service per provider and corridor.
          </p>
        </div>
      </section>

      <section className="explorer" id="corridor-explorer" aria-label="Transfer comparison dashboard">
        <aside className="control-panel">
          <div className="panel-heading">
            <span className="step-number">01</span>
            <div>
              <h2>Set the comparison</h2>
              <p>Origin is fixed to the UK.</p>
            </div>
          </div>

          <label>
            Destination
            <select value={destination} onChange={(event) => setDestination(event.target.value)}>
              {dataset.metadata.destinations.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend>Benchmark amount</legend>
            <div className="segmented">
              {[200, 500].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className={benchmark === amount ? "active" : ""}
                  onClick={() => setBenchmark(amount)}
                >
                  ${amount} equivalent
                </button>
              ))}
            </div>
          </fieldset>

          <label>
            Funding method
            <select value={funding} onChange={(event) => setFunding(event.target.value)}>
              <option>All</option>
              {fundingOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>

          <label>
            Recipient receives via
            <select value={receiving} onChange={(event) => setReceiving(event.target.value)}>
              <option>All</option>
              {receivingOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>

          <label>
            Access channel
            <select value={access} onChange={(event) => setAccess(event.target.value)}>
              <option>All</option>
              {accessOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>

          <label>
            Maximum recorded speed
            <select
              value={maxSpeed}
              onChange={(event) => setMaxSpeed(Number(event.target.value))}
            >
              {SPEED_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="scope-note">
            <span>{qualifyingOffers.length}</span>
            qualifying service quotations remain after these filters.
          </div>
        </aside>

        <div className="results-panel">
          {cheapest ? (
            <>
              <div className="answer-banner">
                <div>
                  <p className="eyebrow">Lowest recorded qualifying cost</p>
                  <h2>{cheapest.provider}</h2>
                  <p>
                    {percent(cheapest.totalCostPct)} total cost · {cheapest.speed.toLowerCase()} ·{" "}
                    {cheapest.fundingMethod.toLowerCase()} to {cheapest.receiveMethod.toLowerCase()}
                  </p>
                </div>
                <div className="answer-cost">
                  <strong>{currency(cheapest.estimatedTotalCostGbp)}</strong>
                  <span>estimated cost on {currency(cheapest.sendAmountGbp)} sent</span>
                </div>
              </div>

              <div className="metric-row">
                <div>
                  <span>Providers compared</span>
                  <strong>{rankedOffers.length}</strong>
                </div>
                <div>
                  <span>Fastest recorded option</span>
                  <strong>{fastest?.speed}</strong>
                  <small>{fastest?.provider}</small>
                </div>
                <div>
                  <span>Cost spread</span>
                  <strong>{currency(spread)}</strong>
                  <small>cheapest to highest provider minimum</small>
                </div>
              </div>

              <div className="chart-card">
                <div className="section-heading">
                  <div>
                    <span className="step-number">02</span>
                    <h2>Cost versus recorded speed</h2>
                  </div>
                  <span className="chart-note">One lowest-cost qualifying offer per provider</span>
                </div>
                <div className="scatter-wrap">
                  <div className="y-label">Total cost</div>
                  <div className="scatter" aria-label="Cost versus speed plot">
                    {[0, 25, 50, 75, 100].map((line) => (
                      <div key={line} className="grid-line" style={{ bottom: `${line}%` }}>
                        <span>{percent((maxChartCost * line) / 100)}</span>
                      </div>
                    ))}
                    {rankedOffers.map((offer) => {
                      const x = SPEED_POSITION[offer.speed] ?? 50;
                      const y = Math.min(96, 4 + (offer.totalCostPct / maxChartCost) * 90);
                      return (
                        <button
                          key={offer.id}
                          type="button"
                          className={`plot-point ${PROVIDER_CLASS[offer.provider] ?? ""} ${
                            selected?.id === offer.id ? "selected" : ""
                          }`}
                          style={{ left: `${x}%`, bottom: `${y}%` }}
                          onClick={() => setSelectedId(offer.id)}
                          aria-label={`${offer.provider}, ${percent(offer.totalCostPct)}, ${offer.speed}`}
                        >
                          <span>{offer.provider}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="x-axis">
                    <span>Under 1h</span><span>Same day</span><span>Next day</span><span>2 days</span><span>3–5 days</span><span>6+ days</span>
                  </div>
                  <div className="x-label">Recorded transfer speed →</div>
                </div>
              </div>

              <div className="comparison-grid">
                <div className="comparison-table-card">
                  <div className="section-heading">
                    <div>
                      <span className="step-number">03</span>
                      <h2>Provider comparison</h2>
                    </div>
                    <span className="chart-note">Select a row to inspect</span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>Provider</th><th>Total cost</th><th>Speed</th><th>Method</th><th></th></tr>
                      </thead>
                      <tbody>
                        {rankedOffers.map((offer, index) => (
                          <tr
                            key={offer.id}
                            className={selected?.id === offer.id ? "selected" : ""}
                            onClick={() => setSelectedId(offer.id)}
                          >
                            <td><span className={`provider-dot ${PROVIDER_CLASS[offer.provider] ?? ""}`} />{offer.provider}</td>
                            <td><strong>{percent(offer.totalCostPct)}</strong><small>{currency(offer.estimatedTotalCostGbp)}</small></td>
                            <td>{offer.speed}</td>
                            <td>{offer.fundingMethod}<small>to {offer.receiveMethod}</small></td>
                            <td>{index === 0 ? <span className="lowest-tag">Lowest</span> : isParetoEfficient(offer, qualifyingOffers) ? <span className="pareto-tag">Efficient</span> : null}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {selected && (
                  <aside className="detail-card">
                    <p className="eyebrow">Selected quotation</p>
                    <div className="detail-title">
                      <h2>{selected.provider}</h2>
                      {isParetoEfficient(selected, qualifyingOffers) && <span className="pareto-tag">Cost–speed efficient</span>}
                    </div>
                    <dl>
                      <div><dt>Transfer fee</dt><dd>{currency(selected.feeGbp)} <small>{percent(selected.feePct)}</small></dd></div>
                      <div><dt>FX margin</dt><dd>{percent(selected.fxMarginPct)}</dd></div>
                      <div><dt>Total cost</dt><dd>{percent(selected.totalCostPct)}</dd></div>
                      <div><dt>Recorded speed</dt><dd>{selected.speed}</dd></div>
                      <div><dt>Access</dt><dd>{selected.accessPoint}</dd></div>
                      <div><dt>Collected</dt><dd>{selected.collectionDate}</dd></div>
                    </dl>
                    <div className="cost-composition">
                      <div className="composition-labels"><span>Fee component</span><span>FX component</span></div>
                      <div className="composition-bar">
                        <span style={{ width: `${Math.max(0, Math.min(100, selected.feePct / Math.max(selected.totalCostPct, 0.01) * 100))}%` }} />
                      </div>
                    </div>
                    <p className="source-row">World Bank source row {selected.sourceRowId}. Quotation marked transparent.</p>
                  </aside>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <span>0 qualifying offers</span>
              <h2>There is not enough comparable data for these conditions.</h2>
              <p>Broaden the speed, funding, receiving or access filter. The dashboard will not manufacture a ranking.</p>
            </div>
          )}
        </div>
      </section>

      <section className="analysis-section" aria-label="Cross-corridor findings">
        <div className="analysis-heading">
          <div>
            <p className="eyebrow">Cross-corridor analysis</p>
            <h2>Where did recorded provider costs diverge most?</h2>
          </div>
          <p>Fixed comparison: $200-equivalent, Internet access, delivery within 3–5 days.</p>
        </div>
        <div className="analysis-layout">
          <div className="finding-list">
            {dataset.analysis.findings.map((finding, index) => (
              <article key={finding}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{finding}</p>
              </article>
            ))}
          </div>
          <div className="corridor-ranking">
            <div className="ranking-header">
              <span>Largest provider cost spreads</span>
              <small>percentage points</small>
            </div>
            {topCorridors.map((corridor) => (
              <div className="ranking-row" key={corridor.destination}>
                <div className="ranking-label">
                  <strong>{corridor.destination}</strong>
                  <small>{corridor.lowestProvider} → {corridor.highestProvider} · {corridor.primaryGapDriver}</small>
                </div>
                <div className="ranking-bar">
                  <span style={{ width: `${(corridor.spreadPctPoints / maxCorridorSpread) * 100}%` }} />
                </div>
                <strong>{corridor.spreadPctPoints.toFixed(2)}</strong>
              </div>
            ))}
          </div>
        </div>
        <p className="analysis-caveat">Provider minima are compared within a fixed historical scope. The fee-versus-FX classification is diagnostic and does not establish why a provider set its price.</p>
      </section>

      <section className="method-section">
        <div className="method-heading">
          <p className="eyebrow">Method and limits</p>
          <h2>A narrow answer, with the boundaries left visible.</h2>
        </div>
        <div className="method-grid">
          <div>
            <span>What is compared</span>
            <p>Provider service quotations with the same origin, destination, quarter, benchmark amount and selected delivery conditions.</p>
          </div>
          <div>
            <span>How “lowest” is chosen</span>
            <p>The minimum World Bank total-cost percentage among offers that satisfy the active filters. Ties favour the faster recorded category.</p>
          </div>
          <div>
            <span>What this cannot claim</span>
            <p>These are consumer-remittance quotations, not live prices, completed transfers, merchant payout terms or reliability measurements.</p>
          </div>
        </div>
        <div className="source-strip">
          <div><span>Source</span><strong>{dataset.metadata.title}</strong></div>
          <div><span>Coverage used</span><strong>{dataset.metadata.recordCount} quotations · {dataset.metadata.license}</strong></div>
          <a href={dataset.metadata.methodologyUrl} target="_blank" rel="noreferrer">Read methodology ↗</a>
        </div>
      </section>

      <footer>
        <span>Corridor Scout</span>
        <p>The World Bank, Remittance Prices Worldwide, available at remittanceprices.worldbank.org. Independent analysis; no provider endorsement implied.</p>
      </footer>
    </main>
  );
}
