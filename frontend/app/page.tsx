"use client";

import { useState } from "react";

type Label = "NORMAL" | "SUSPICIOUS" | "FRAUD";

type PredictResponse = {
  raw_score: number;
  fraud_prob: number;
  label: Label;
};

const LABEL_STYLES: Record<Label, { color: string; copy: string }> = {
  NORMAL: {
    color: "#535C91",
    copy: "Feature pattern matches other regular listings in this category.",
  },
  SUSPICIOUS: {
    color: "#9290C3",
    copy: "A few features deviate from normal listings. Worth a closer look before checkout.",
  },
  FRAUD: {
    color: "#C2433D",
    copy: "High anomaly score — this pattern resembles listings usually flagged as fraudulent.",
  },
};

const GAUGE_ZONES = [
  { from: 0, to: 90, color: "#535C91" }, // 0.00–0.50 NORMAL
  { from: 90, to: 144, color: "#9290C3" }, // 0.50–0.80 SUSPICIOUS
  { from: 144, to: 180, color: "#C2433D" }, // 0.80–1.00 FRAUD
];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 180) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polarToCartesian(cx, cy, r, endDeg);
  const end = polarToCartesian(cx, cy, r, startDeg);
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function AnomalyGauge({ prob, scanning }: { prob: number; scanning: boolean }) {
  const cx = 120;
  const cy = 118;
  const r = 92;
  const clamped = Math.min(Math.max(prob, 0), 1);
  const needle = scanning ? null : polarToCartesian(cx, cy, r - 14, clamped * 180);

  return (
    <svg
      viewBox="0 0 240 150"
      className="w-full max-w-[260px]"
      role="img"
      aria-label={
        scanning
          ? "Scanning listing"
          : `Anomaly score ${Math.round(clamped * 100)} percent`
      }
    >
      <path d={arcPath(cx, cy, r, 0, 180)} fill="none" stroke="#1B1A55" strokeWidth="16" />
      {GAUGE_ZONES.map((zone) => (
        <path
          key={zone.from}
          d={arcPath(cx, cy, r, zone.from, zone.to)}
          fill="none"
          stroke={zone.color}
          strokeWidth="16"
          strokeOpacity={0.85}
        />
      ))}

      {needle && (
        <g>
          <line
            x1={cx}
            y1={cy}
            x2={needle.x}
            y2={needle.y}
            stroke="#F4F3FA"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r="6" fill="#F4F3FA" />
        </g>
      )}

      {scanning && (
        <g
          style={
            {
              transformOrigin: `${cx}px ${cy}px`,
              transformBox: "view-box",
              animation: "sweep 1.4s ease-in-out infinite alternate",
            } as React.CSSProperties
          }
        >
          <line
            x1={cx}
            y1={cy}
            x2={cx}
            y2={cy - (r - 14)}
            stroke="#9290C3"
            strokeWidth="3"
            strokeLinecap="round"
            opacity={0.8}
          />
        </g>
      )}
    </svg>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const res = await fetch(`${base}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        throw new Error(`Server responded ${res.status}`);
      }

      const data: PredictResponse = await res.json();
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not reach the detection server."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#070F2B]">
      <style>{`
        @keyframes sweep {
          from { transform: rotate(-70deg); }
          to { transform: rotate(70deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[#535C91] [font-family:var(--font-mono)]">
          <span>fraudlens</span>
          <span>isolation forest · unsupervised</span>
        </div>

        <h1 className="mt-8 text-4xl font-medium leading-[1.05] text-[#F4F3FA] sm:text-5xl [font-family:var(--font-display)]">
          Paste the listing link.
          <br />
          Let the system get suspicious.
        </h1>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3 sm:flex-row">
          <label htmlFor="listing-url" className="sr-only">
            Product listing link
          </label>
          <input
            id="listing-url"
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.amazon.com/dp/..."
            className="flex-1 rounded-md border border-[#535C91]/40 bg-[#1B1A55]/60 px-4 py-3 text-sm text-[#F4F3FA] outline-none placeholder:text-[#535C91] focus:border-[#9290C3] focus:ring-2 focus:ring-[#9290C3]/30 [font-family:var(--font-mono)]"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-[#9290C3] px-6 py-3 text-sm font-medium text-[#070F2B] transition hover:bg-[#a9a7d6] disabled:cursor-not-allowed disabled:opacity-60 [font-family:var(--font-mono)]"
          >
            {loading ? "Scanning…" : "Check listing"}
          </button>
        </form>

        {error && (
          <p className="mt-4 text-sm text-[#C2433D] [font-family:var(--font-mono)]">
            ⚠ {error}
          </p>
        )}

        {(loading || result) && (
          <section className="mt-12 rounded-2xl border border-[#1B1A55] bg-[#0B1438] p-8">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
              <AnomalyGauge prob={result?.fraud_prob ?? 0} scanning={loading} />

              <div className="flex-1 text-center sm:text-left">
                {loading ? (
                  <p className="text-sm text-[#535C91] [font-family:var(--font-mono)]">
                    running isolation forest…
                  </p>
                ) : result ? (
                  <>
                    <p
                      className="text-3xl font-semibold tracking-tight [font-family:var(--font-display)]"
                      style={{ color: LABEL_STYLES[result.label].color }}
                    >
                      {result.label}
                    </p>
                    <p className="mt-2 text-sm text-[#9290C3] [font-family:var(--font-mono)]">
                      fraud_prob {(result.fraud_prob * 100).toFixed(1)}% · raw_score{" "}
                      {result.raw_score.toFixed(4)}
                    </p>
                    <p className="mt-3 max-w-sm text-sm text-[#9290C3]/80">
                      {LABEL_STYLES[result.label].copy}
                    </p>
                  </>
                ) : null}
              </div>
            </div>
          </section>
        )}

        <footer className="mt-20 flex justify-between border-t border-[#1B1A55] pt-6 text-xs text-[#535C91] [font-family:var(--font-mono)]">
          <span>e-commerce-fraud-detection</span>
          <span>v1 · isolation forest</span>
        </footer>
      </div>
    </main>
  );
}
