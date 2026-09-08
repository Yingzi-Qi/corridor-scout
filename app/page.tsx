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
    providers: string[];
    destinations: string[];
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

  useEffect(() => {
    fetch("/corridor-data.json")
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
          <p className="eyebrow">United Kingdom origin · {dataset.metadata.period}</p>
          <h1>Which recorded transfer option cost least—and how fast was it?</h1>
        </div>
        <p className="intro-copy">
          Compare transparent service quotations on the same corridor, benchmark amount and
          delivery constraint. Rankings describe this dataset, not today’s live market.
        </p>
      </section>

      <section className="explorer" aria-label="Transfer comparison dashboard">
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
