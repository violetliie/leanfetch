import { useState, useMemo } from 'react';

// Public model pricing per million tokens
const MODEL_RATES = {
  'claude-opus':    { input: 15.0, output: 75.0, label: 'Claude Opus' },
  'claude-sonnet':  { input: 3.0,  output: 15.0, label: 'Claude Sonnet' },
  'claude-haiku':   { input: 0.80, output: 4.0,  label: 'Claude Haiku' },
  'gpt-4o':         { input: 2.5,  output: 10.0, label: 'GPT-4o' },
  'gpt-4o-mini':    { input: 0.15, output: 0.60, label: 'GPT-4o Mini' },
  'gpt-4-turbo':    { input: 10.0, output: 30.0, label: 'GPT-4 Turbo' },
};

function estimateFlag(flag) {
  const snippet = (flag.codeSnippet || '') + (flag.description || '') + (flag.title || '');
  let model = 'claude-sonnet';
  if (/opus/i.test(snippet)) model = 'claude-opus';
  else if (/haiku/i.test(snippet)) model = 'claude-haiku';
  else if (/gpt-4o-mini/i.test(snippet)) model = 'gpt-4o-mini';
  else if (/gpt-4o/i.test(snippet)) model = 'gpt-4o';
  else if (/gpt-4/i.test(snippet)) model = 'gpt-4-turbo';

  const rates = MODEL_RATES[model];
  const avgInput = 2000;
  const avgOutput = 500;
  const costPerCall = (avgInput * rates.input + avgOutput * rates.output) / 1_000_000;

  let beforeMultiplier = 1;
  let afterMultiplier = 1;
  let savingsPercent = 0;
  let explanation = '';

  switch (flag.pattern) {
    case 'n-plus-one': {
      const n = 10;
      beforeMultiplier = n;
      afterMultiplier = 1.5;
      explanation = `${n} separate API calls batched into 1 (assuming ${n} loop iterations)`;
      break;
    }
    case 'missing-max-tokens': {
      beforeMultiplier = 1;
      afterMultiplier = 0.4;
      explanation = 'Output tokens capped to task-appropriate length';
      break;
    }
    case 'no-retry': {
      beforeMultiplier = 1.05;
      afterMultiplier = 1.0;
      explanation = 'Retry logic prevents ~5% wasted calls from transient failures';
      break;
    }
    case 'no-concurrency-limit': {
      beforeMultiplier = 1.1;
      afterMultiplier = 1.0;
      explanation = 'Concurrency limiting prevents rate-limit retries';
      break;
    }
    case 'expensive-model': {
      const cheapModel = model.includes('gpt') ? 'gpt-4o-mini' : 'claude-haiku';
      const cheapRates = MODEL_RATES[cheapModel];
      const cheapCost = (avgInput * cheapRates.input + avgOutput * cheapRates.output) / 1_000_000;
      afterMultiplier = cheapCost / costPerCall;
      explanation = `Switch from ${rates.label} to ${MODEL_RATES[cheapModel].label} for this task`;
      break;
    }
    case 'no-prompt-caching': {
      beforeMultiplier = 1;
      afterMultiplier = 0.73;
      explanation = 'Prompt caching saves ~90% on repeated system prompt tokens';
      break;
    }
    case 'history-resend': {
      beforeMultiplier = 5;
      afterMultiplier = 1.5;
      explanation = 'Sliding window/summarization prevents O(N^2) token growth over conversation turns';
      break;
    }
    case 'no-streaming': {
      beforeMultiplier = 1.02;
      afterMultiplier = 1.0;
      explanation = 'Streaming reduces timeout-related retries on long responses';
      break;
    }
    default: {
      savingsPercent = 15;
      afterMultiplier = 0.85;
      explanation = 'Estimated optimization based on pattern analysis';
    }
  }

  const beforeCost = costPerCall * beforeMultiplier;
  const afterCost = costPerCall * afterMultiplier;
  savingsPercent = savingsPercent || Math.round((1 - afterCost / beforeCost) * 100);

  return { model, modelLabel: rates.label, costPerCall, beforeCost, afterCost, savingsPercent, explanation };
}

export default function SavingsSimulator({ flags }) {
  const [callVolume, setCallVolume] = useState(100000);

  const estimates = useMemo(() => flags.map((flag) => ({
    ...flag,
    estimate: estimateFlag(flag),
  })), [flags]);

  const totals = useMemo(() => {
    let totalBefore = 0;
    let totalAfter = 0;
    for (const { estimate } of estimates) {
      totalBefore += estimate.beforeCost;
      totalAfter += estimate.afterCost;
    }
    return {
      beforePerRun: totalBefore,
      afterPerRun: totalAfter,
      savedPerRun: totalBefore - totalAfter,
      beforeAtVolume: totalBefore * callVolume,
      afterAtVolume: totalAfter * callVolume,
      savedAtVolume: (totalBefore - totalAfter) * callVolume,
      savingsPercent: totalBefore > 0 ? Math.round((1 - totalAfter / totalBefore) * 100) : 0,
    };
  }, [estimates, callVolume]);

  const presets = [1000, 10000, 100000, 1000000];

  return (
    <div className="bg-white border border-[rgba(0,0,0,0.06)] p-6 space-y-6">
      <div>
        <h3 className="text-[13px] font-medium uppercase tracking-[0.08em] text-[rgba(26,26,26,0.4)] mb-1">Savings Simulator</h3>
        <p className="text-xs text-[rgba(26,26,26,0.4)]">Estimates based on public model pricing and assumed ~2K input / ~500 output tokens per call.</p>
      </div>

      {/* Volume selector */}
      <div>
        <label className="text-[13px] font-medium text-[rgba(26,26,26,0.4)] block mb-2">Simulated call volume</label>
        <div className="flex gap-2 flex-wrap">
          {presets.map((v) => (
            <button
              key={v}
              onClick={() => setCallVolume(v)}
              className={`text-[13px] font-medium px-4 py-2 transition-colors ${
                callVolume === v
                  ? 'bg-[#1A1A1A] text-white'
                  : 'border border-[rgba(0,0,0,0.1)] text-[rgba(26,26,26,0.5)] hover:border-[rgba(0,0,0,0.2)] hover:text-[#1A1A1A]'
              }`}
            >
              {fmtNum(v)} calls
            </button>
          ))}
          <input
            type="number"
            value={callVolume}
            onChange={(e) => setCallVolume(Math.max(1, parseInt(e.target.value) || 0))}
            className="w-28 text-xs bg-white border border-[rgba(0,0,0,0.1)] px-3 py-2 text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
          />
        </div>
      </div>

      {/* Before / After comparison */}
      <div className="grid grid-cols-3 gap-4">
        <SimCard label="Before LeanFetch" value={`$${fmtMoney(totals.beforeAtVolume)}`} sub={`$${fmtMoney(totals.beforePerRun)} per run`} color="text-[#DC2626]" />
        <SimCard label="After LeanFetch" value={`$${fmtMoney(totals.afterAtVolume)}`} sub={`$${fmtMoney(totals.afterPerRun)} per run`} color="text-[#1A1A1A]" />
        <SimCard label="Total Saved" value={`$${fmtMoney(totals.savedAtVolume)}`} sub={`${totals.savingsPercent}% reduction`} color="text-[#1A1A1A]" />
      </div>

      {/* Per-flag breakdown */}
      <div>
        <h4 className="text-[13px] font-medium uppercase tracking-[0.08em] text-[rgba(26,26,26,0.4)] mb-3">Per-flag breakdown</h4>
        <div className="space-y-1.5 font-mono text-xs">
          {estimates.map((item, i) => {
            const e = item.estimate;
            return (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-[rgba(0,0,0,0.04)] last:border-0">
                <div className="flex-1 min-w-0">
                  <span className={`inline-block w-16 text-center text-[10px] font-medium px-1 py-0.5 mr-2 ${
                    item.severity === 'critical' ? 'bg-red-50 text-[#DC2626]'
                    : item.severity === 'warning' ? 'bg-amber-50 text-[#D97706]'
                    : 'bg-blue-50 text-[#2563EB]'
                  }`}>{item.severity}</span>
                  <span className="text-[rgba(26,26,26,0.6)] truncate">{item.title?.slice(0, 50)}</span>
                </div>
                <div className="flex items-center gap-3 text-right flex-shrink-0 ml-2">
                  <span className="text-[#DC2626]/60">${fmtMoney(e.beforeCost * callVolume)}</span>
                  <span className="text-[rgba(26,26,26,0.2)]">&rarr;</span>
                  <span className="text-[rgba(26,26,26,0.7)]">${fmtMoney(e.afterCost * callVolume)}</span>
                  <span className="text-[rgba(26,26,26,0.5)] w-12 text-right">-{e.savingsPercent}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-[10px] text-[rgba(26,26,26,0.3)] leading-relaxed">
        Estimates assume ~2,000 input tokens and ~500 output tokens per call, {fmtNum(callVolume)} total invocations,
        and public model pricing as of April 2026. N+1 loops assume 10 iterations. History-resend assumes 10-turn
        average conversation length. Actual savings depend on your runtime usage patterns. These estimates are directional, not precise.
      </p>
    </div>
  );
}

function SimCard({ label, value, sub, color }) {
  return (
    <div className="bg-[#F8F8F6] border border-[rgba(0,0,0,0.06)] p-5 text-center">
      <div className="text-[13px] font-medium uppercase tracking-[0.08em] text-[rgba(26,26,26,0.4)] mb-2">{label}</div>
      <div className={`text-[24px] font-light tracking-tight ${color}`}>{value}</div>
      <div className="text-[10px] text-[rgba(26,26,26,0.4)] mt-1">{sub}</div>
    </div>
  );
}

function fmtMoney(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(3);
  return n.toFixed(4);
}

function fmtNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(0) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return String(n);
}

export { estimateFlag };
