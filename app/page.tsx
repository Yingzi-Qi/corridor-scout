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
  benchmarkAmount: number;
  benchmarkCurrency: string;
  sendAmount: number;
  sendCurrency: string;
  feeAmount: number;
  feePct: number;
  fxMarginPct: number;
  totalCostPct: number;
  estimatedTotalCost: number;
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
    recordCount: number;
    sourceRecordCount: number;
    providers: string[];
    destinations: string[];
  };
  analysis: {
    scope: string;
    filters: {
      benchmarkAmount: number;
      benchmarkCurrency: string;
      accessPoint: string;
      maxSpeedDays: number;
    };
    findings: string[];
    corridorRankings: Array<{
      destination: string;
      providerCount: number;
      lowestProvider: string;
      lowestCostPct: number;
      highestProvider: string;
      highestCostPct: number;
      spreadPctPoints: number;
      spreadAmount: number;
      sendCurrency: string;
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

function currency(value: number, currencyCode = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(value);
}

function percent(value: number) {
  return `${value.toFixed(2)}%`;
}

function benchmarkLabel(value: number, currencyCode: string) {
  return `${new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(value)} equivalent`;
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
  const [destination, setDestination] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [benchmark, setBenchmark] = useState(200);
  const [funding, setFunding] = useState("All");
  const [receiving, setReceiving] = useState("All");
  const [access, setAccess] = useState("Internet");
  const [maxSpeed, setMaxSpeed] = useState(5);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [driverFilter, setDriverFilter] = useState("All");

  useEffect(() => {
    const controller = new AbortController();
    setLoadError(false);
    fetch("corridor-data.json", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Data unavailable");
        return response.json();
      })
      .then((data: Dataset) => {
        if (!data.metadata || !data.offers?.length || !data.analysis?.corridorRankings?.length) {
          throw new Error("Incomplete comparison data");
        }
        setDataset(data);
        setDestination(data.analysis.corridorRankings[0].destination);
        setBenchmark(data.analysis.filters.benchmarkAmount);
        setAccess(data.analysis.filters.accessPoint);
        setMaxSpeed(data.analysis.filters.maxSpeedDays);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      });
    return () => controller.abort();
  }, [loadAttempt]);

  const baseOffers = useMemo(() => {
    if (!dataset) return [];
    return dataset.offers.filter(
      (offer) => offer.destination === destination && offer.benchmarkAmount === benchmark,
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
  const benchmarkOptions = useMemo(
    () =>
      dataset
        ? [...new Set(dataset.offers.map((offer) => offer.benchmarkAmount))].sort(
            (a, b) => a - b,
          )
        : [],
    [dataset],
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
      [...qualifyingOffers].sort(
        (a, b) => a.speedDays - b.speedDays || a.totalCostPct - b.totalCostPct,
      )[0] ?? null,
    [qualifyingOffers],
  );
  const selected =
    qualifyingOffers.find((offer) => offer.id === selectedId) ?? cheapest;
  const mostExpensive = rankedOffers.at(-1) ?? null;
  const spread =
    cheapest && mostExpensive
      ? mostExpensive.estimatedTotalCost - cheapest.estimatedTotalCost
      : 0;

  const minChartCost = Math.min(0, Math.floor(Math.min(...rankedOffers.map((offer) => offer.totalCostPct))));
  const maxChartCost = Math.max(1, Math.ceil(Math.max(...rankedOffers.map((offer) => offer.totalCostPct))));
  const chartRange = maxChartCost - minChartCost;


  if (!dataset) {
    return (
      <main className="loading-screen">
        <div className="loading-mark">CS</div>
        <p role={loadError ? "alert" : "status"}>
          {loadError ? "The comparison data could not be loaded." : "Preparing corridor comparison…"}
        </p>
        {loadError && <button className="primary-button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</button>}
      </main>
    );
  }

  const maxCorridorSpread = dataset.analysis.corridorRankings[0]?.spreadPctPoints || 1;
  const fixedFilters = dataset.analysis.filters;
  const summaryRows = dataset.analysis.corridorRankings.filter(
    (corridor) => driverFilter === "All" || corridor.primaryGapDriver === driverFilter,
  );
  const lowestAcrossCorridors = [...dataset.analysis.corridorRankings].sort(
    (a, b) => a.lowestCostPct - b.lowestCostPct,
  )[0];
  const driverCounts = dataset.analysis.corridorRankings.reduce<Record<string, number>>(
    (counts, corridor) => ({
      ...counts,
      [corridor.primaryGapDriver]: (counts[corridor.primaryGapDriver] ?? 0) + 1,
    }),
    {},
  );
  const [commonDriver, commonDriverCount] = Object.entries(driverCounts).sort(
    (a, b) => b[1] - a[1],
  )[0];
  const priority = dataset.analysis.corridorRankings[0];
  const sourceCount = dataset.metadata.sourceRecordCount ?? new Set(dataset.offers.map((offer) => offer.sourceRowId)).size;
  const originLabel = dataset.metadata.origin === "United Kingdom"
    ? "UK"
    : dataset.metadata.origin;

  function resetConditions() {
    setBenchmark(fixedFilters.benchmarkAmount);
    setFunding("All");
    setReceiving("All");
    setAccess(fixedFilters.accessPoint);
    setMaxSpeed(fixedFilters.maxSpeedDays);
    setSelectedId(null);
  }

  function openCorridor(nextDestination: string) {
    setDestination(nextDestination);
    setBenchmark(fixedFilters.benchmarkAmount);
    setFunding("All");
    setReceiving("All");
    setAccess(fixedFilters.accessPoint);
    setMaxSpeed(fixedFilters.maxSpeedDays);
    setSelectedId(null);
    window.requestAnimationFrame(() => {
      document.getElementById("corridor-explorer")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        block: "start",
      });
    });
  }

  function inspectOffer(offerId: string, revealDetails = false) {
    setSelectedId(offerId);
    if (!revealDetails) return;
    window.setTimeout(() => {
      const detailCard = document.getElementById("selected-quotation");
      detailCard?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" });
      detailCard?.focus({ preventScroll: true });
    }, 0);
  }

  return (
    <main id="top">
      <a className="skip-link" href="#overview">Skip to comparison</a>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Corridor Scout home">
          <span className="brand-mark">CS</span>
          <span>
            <strong>Corridor Scout</strong>
            <small>Cross-border cost explorer</small>
          </span>
        </a>
        <div className="header-meta">
          <a href="#overview">Overview</a>
          <a href="#corridor-explorer">Explorer</a>
          <a href="#methodology">Method</a>
          <a href={dataset.metadata.sourceUrl} target="_blank" rel="noreferrer">
            World Bank source ↗
          </a>
        </div>
      </header>

      <section className="intro" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Historical pricing study · {dataset.metadata.period}</p>
          <h1 id="page-title">Where do {originLabel} remittance costs differ most?</h1>
          <p className="intro-description">Compare provider costs, isolate fee and FX differences, and decide what to investigate next.</p>
        </div>
        <div className="coverage-label">
          <strong>{dataset.metadata.providers.length} providers · {dataset.analysis.corridorRankings.length} corridors</strong>
          <span>{sourceCount} source quotations · World Bank RPW</span>
        </div>
      </section>

      <section className="summary-section" id="overview" aria-label="Corridor overview">
        <div className="overview-scope">
          <span className="scope-tag">Fixed overview</span>
          <p>{benchmarkLabel(fixedFilters.benchmarkAmount, fixedFilters.benchmarkCurrency)} · {fixedFilters.accessPoint === "Internet" ? "Online" : fixedFilters.accessPoint} · up to {fixedFilters.maxSpeedDays} days</p>
          <a href="#methodology">How we compare</a>
        </div>
        <div className="summary-cards">
          <article>
            <span>Largest cost gap</span>
            <strong>{priority.spreadPctPoints.toFixed(2)} <small>pp</small></strong>
            <p>{originLabel} → {priority.destination}</p>
          </article>
          <article>
            <span>Lowest recorded cost</span>
            <strong>{percent(lowestAcrossCorridors.lowestCostPct)}</strong>
            <p>{lowestAcrossCorridors.lowestProvider} · {lowestAcrossCorridors.destination}</p>
          </article>
          <article>
            <span>Most common gap component</span>
            <strong>{driverLabel(commonDriver)}</strong>
            <p>{commonDriverCount} of {dataset.analysis.corridorRankings.length} corridors</p>
          </article>
        </div>

        <aside className="next-step" aria-label="Suggested investigation">
          <div>
            <span className="eyebrow">Start the investigation</span>
            <h2>Look first at {priority.destination}&apos;s {priority.primaryGapDriver === "FX-margin difference" ? "FX margin" : priority.primaryGapDriver === "Fee difference" ? "fee" : "combined fee and FX"} gap.</h2>
            <p>The {priority.spreadPctPoints.toFixed(2)} pp spread is the largest in this sample. Check current quotes and match funding and receiving methods before drawing a commercial conclusion.</p>
          </div>
          <button type="button" className="primary-button" onClick={() => openCorridor(priority.destination)}>Inspect {priority.destination} <span aria-hidden="true">↓</span></button>
        </aside>

        <div className="summary-toolbar">
          <div>
            <h2>Corridors ranked by cost gap</h2>
            <span>One lowest qualifying offer per provider. Select a corridor to inspect.</span>
          </div>
          <div className="driver-filters" aria-label="Filter corridors by gap driver">
            {DRIVER_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={driverFilter === filter.value ? "active" : ""}
                aria-pressed={driverFilter === filter.value}
                title={filter.value === "Mixed" ? "Fee and FX-margin gaps are too similar for either to dominate." : undefined}
                onClick={() => setDriverFilter(filter.value)}
              >
                {filter.label} ({filter.value === "All"
                  ? dataset.analysis.corridorRankings.length
                  : (driverCounts[filter.value] ?? 0)})
              </button>
            ))}
          </div>
        </div>

        <p className="driver-explanation">Gap = highest minus lowest provider minimum. <abbr title="Percentage points">pp</abbr> = percentage points. Fee and FX labels describe the larger component of that gap.</p>

        <div className="summary-table-card">
          <div className="table-wrap">
            <table className="corridor-summary-table">
              <thead>
                <tr>
                  <th>Overall rank</th>
                  <th>{originLabel} outbound corridor</th>
                  <th>Provider cost gap</th>
                  <th>Lowest recorded provider</th>
                  <th>Lowest cost</th>
                  <th>Main source of gap</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((corridor) => {
                  const rank = dataset.analysis.corridorRankings.findIndex((item) => item.destination === corridor.destination) + 1;
                  return (
                    <tr key={corridor.destination}>
                      <td className="summary-rank">{String(rank).padStart(2, "0")}</td>
                      <td>
                        <button
                          type="button"
                          className="corridor-link"
                          onClick={() => openCorridor(corridor.destination)}
                        >
                          <strong>{originLabel} → {corridor.destination}</strong>
                          <span>Inspect offers →</span>
                        </button>
                      </td>
                      <td>
                        <div className="gap-value">
                          <strong>{corridor.spreadPctPoints.toFixed(2)} pp</strong>
                          <small>about {currency(corridor.spreadAmount, corridor.sendCurrency)}</small>
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
            Funding and receiving methods may differ. “Mixed” means the absolute fee and FX gaps differ by less than 0.25 pp. Rankings stay fixed when you change the explorer below.
          </p>
        </div>
      </section>

      <section className="explorer" id="corridor-explorer" aria-label="Transfer comparison dashboard">
        <aside className="control-panel">
          <div className="panel-heading">
            <div>
              <h2>Explore a corridor</h2>
              <p>Adjust the conditions for this comparison.</p>
            </div>
          </div>

          <label>
            Destination
            <select value={destination} onChange={(event) => { setDestination(event.target.value); resetConditions(); }}>
              {dataset.metadata.destinations.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend>Benchmark amount</legend>
            <div className="segmented">
              {benchmarkOptions.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className={benchmark === amount ? "active" : ""}
                  aria-pressed={benchmark === amount}
                  onClick={() => { setBenchmark(amount); setFunding("All"); setReceiving("All"); setAccess(fixedFilters.accessPoint); setSelectedId(null); }}
                >
                  {benchmarkLabel(amount, fixedFilters.benchmarkCurrency)}
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

          <button type="button" className="reset-button" onClick={resetConditions}>Reset conditions</button>
          <div className="scope-note" aria-live="polite">
            <span>{qualifyingOffers.length}</span>
            qualifying service quotations remain after these filters.
          </div>
        </aside>

        <div className="results-panel">
          <div className="explorer-heading">
            <div><p className="eyebrow">Adjustable comparison · {dataset.metadata.period}</p><h2>{originLabel} → {destination}</h2></div>
            <span className="scope-tag">{benchmarkLabel(benchmark, fixedFilters.benchmarkCurrency)}</span>
          </div>
          <p className="comparison-context">{funding === "All" || receiving === "All" ? "Funding or receiving methods can differ. Choose specific methods to narrow the comparison." : `${funding} → ${receiving}. Provider prices still reflect historical quotations.`}</p>
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
                  <strong>{currency(cheapest.estimatedTotalCost, cheapest.sendCurrency)}</strong>
                  <span>estimated cost on {currency(cheapest.sendAmount, cheapest.sendCurrency)} sent</span>
                </div>
              </div>

              <div className="metric-row">
                <div>
                  <span>Providers compared</span>
                  <strong>{rankedOffers.length}</strong>
                </div>
                <div>
                  <span>Fastest qualifying service</span>
                  <strong>{fastest?.speed}</strong>
                  <small>{fastest?.provider}</small>
                </div>
                <div>
                  <span>Cost spread</span>
                  <strong>{rankedOffers.length > 1 ? currency(spread, cheapest.sendCurrency) : "Not comparable"}</strong>
                  <small>{rankedOffers.length > 1 ? "lowest to highest provider minimum" : "Only one provider qualifies"}</small>
                </div>
              </div>

              <div className="chart-card">
                <div className="section-heading">
                  <div>
                    <h2>Cost versus recorded speed</h2>
                  </div>
                  <span className="chart-note">One lowest-cost offer per provider</span>
                </div>
                <div className="scatter-wrap">
                  <div className="y-label">Total cost</div>
                  <div className="scatter" aria-label="Cost versus speed plot">
                    {[0, 25, 50, 75, 100].map((line) => (
                      <div key={line} className="grid-line" style={{ bottom: `${line}%` }}>
                        <span>{percent(minChartCost + (chartRange * line) / 100)}</span>
                      </div>
                    ))}
                    {minChartCost < 0 && <div className="zero-line" style={{ bottom: `${(-minChartCost / chartRange) * 100}%` }} aria-label="Zero total cost" />}
                    {rankedOffers.map((offer) => {
                      const x = SPEED_POSITION[offer.speed] ?? 50;
                      const y = ((offer.totalCostPct - minChartCost) / chartRange) * 100;
                      return (
                        <button
                          key={offer.id}
                          type="button"
                          className={`plot-point ${PROVIDER_CLASS[offer.provider] ?? ""} ${
                            selected?.id === offer.id ? "selected" : ""
                          }`}
                          style={{ left: `${x}%`, bottom: `${y}%` }}
                          onClick={() => inspectOffer(offer.id, true)}
                          aria-pressed={selected?.id === offer.id}
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
                  <div className="x-label">Recorded speed categories · spacing does not represent elapsed time</div>
                </div>
              </div>

              <div className="comparison-grid">
                <div className="comparison-table-card">
                  <div className="section-heading">
                    <div>
                      <h2>Provider comparison</h2>
                    </div>
                    <span className="chart-note">Select a provider to inspect</span>
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
                            onClick={() => inspectOffer(offer.id)}
                          >
                            <td><button type="button" className="provider-button" onClick={(event) => { event.stopPropagation(); inspectOffer(offer.id); }} aria-pressed={selected?.id === offer.id}><span className={`provider-dot ${PROVIDER_CLASS[offer.provider] ?? ""}`} />{offer.provider}</button></td>
                            <td><strong>{percent(offer.totalCostPct)}</strong><small>{currency(offer.estimatedTotalCost, offer.sendCurrency)}</small></td>
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
                  <aside
                    className="detail-card"
                    id="selected-quotation"
                    aria-live="polite"
                    tabIndex={-1}
                  >
                    <p className="eyebrow">Selected quotation</p>
                    <div className="detail-title">
                      <h2>{selected.provider}</h2>
                      {isParetoEfficient(selected, qualifyingOffers) && <span className="pareto-tag">Cost–speed efficient</span>}
                    </div>
                    <dl>
                      <div><dt>Transfer fee</dt><dd>{currency(selected.feeAmount, selected.sendCurrency)} <small>{percent(selected.feePct)}</small></dd></div>
                      <div><dt>FX margin</dt><dd>{percent(selected.fxMarginPct)}</dd></div>
                      <div><dt>Total cost</dt><dd>{percent(selected.totalCostPct)}</dd></div>
                      <div><dt>Recorded speed</dt><dd>{selected.speed}</dd></div>
                      <div><dt>Access</dt><dd>{selected.accessPoint}</dd></div>
                      <div><dt>Collected</dt><dd>{selected.collectionDate}</dd></div>
                    </dl>
                    {selected.feePct >= 0 && selected.fxMarginPct >= 0 && selected.totalCostPct > 0 && <div className="cost-composition">
                      <div className="composition-labels"><span>Fee component</span><span>FX component</span></div>
                      <div className="composition-bar">
                        <span style={{ width: `${Math.max(0, Math.min(100, selected.feePct / Math.max(selected.totalCostPct, 0.01) * 100))}%` }} />
                      </div>
                    </div>
                    }
                    {selected.totalCostPct < 0 && <p className="source-row">The recorded FX advantage exceeds the fee. A negative cost is relative to the source exchange-rate benchmark, not a guaranteed cash reward.</p>}
                    <p className="source-row">World Bank source row {selected.sourceRowId}. Quotation marked transparent.</p>
                  </aside>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <span>0 qualifying offers</span>
              <h2>There is not enough comparable data for these conditions.</h2>
              <p>Broaden the speed, funding, receiving or access filter.</p>
              <button type="button" className="primary-button" onClick={resetConditions}>Reset conditions</button>
            </div>
          )}
        </div>
      </section>

      <section className="method-section" id="methodology">
        <div className="method-heading">
          <p className="eyebrow">Methodology and limitations</p>
          <h2>Understand the comparison.</h2>
        </div>
        <div className="method-grid">
          <div>
            <span>What is compared</span>
            <p>Historical consumer-remittance prices for the same corridor, quarter and benchmark amount. The overview allows different funding and receiving methods; the explorer can restrict them.</p>
          </div>
          <div>
            <span>How “lowest” is chosen</span>
            <p>Each provider contributes its lowest qualifying total-cost percentage. Ties favour faster service. The gap compares the highest and lowest of these provider minima; it does not measure average customer savings.</p>
          </div>
          <div>
            <span>What this cannot claim</span>
            <p>These are consumer-remittance quotations, not live prices, completed transfers, merchant payout terms or reliability measurements.</p>
          </div>
        </div>
        <div className="source-strip">
          <div><span>Source</span><strong>{dataset.metadata.title}</strong></div>
          <div><span>Coverage used · {dataset.metadata.license}</span><strong>{dataset.metadata.recordCount} amount observations from {sourceCount} source quotations</strong></div>
          <div className="source-links">
            <a href={dataset.metadata.methodologyUrl} target="_blank" rel="noreferrer">Source methodology ↗</a>
            <a href="https://github.com/Yingzi-Qi/corridor-scout/tree/main/pipeline" target="_blank" rel="noreferrer">Automated pipeline ↗</a>
          </div>
        </div>
      </section>

      <footer>
        <span>Corridor Scout</span>
        <p>The World Bank, Remittance Prices Worldwide, available at remittanceprices.worldbank.org. Independent analysis; no provider endorsement implied.</p>
      </footer>
    </main>
  );
}
