import { useState } from 'react';
import { estimateFlag } from './SavingsSimulator';

const SEVERITY_STYLES = {
  critical: { badge: 'bg-red-50 text-[#DC2626] border-[#DC2626]/20', dot: 'bg-[#DC2626]', border: 'border-[#DC2626]/20' },
  warning: { badge: 'bg-amber-50 text-[#D97706] border-[#D97706]/20', dot: 'bg-[#D97706]', border: 'border-[#D97706]/20' },
  info: { badge: 'bg-blue-50 text-[#2563EB] border-[#2563EB]/20', dot: 'bg-[#2563EB]', border: 'border-[#2563EB]/20' },
};

export default function FlagCard({ flag }) {
  const [expanded, setExpanded] = useState(false);
  const style = SEVERITY_STYLES[flag.severity] || SEVERITY_STYLES.info;
  const estimate = estimateFlag(flag);

  return (
    <div className={`bg-white border ${style.border} overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4 flex items-start gap-3 hover:bg-[#FAFAF8] transition-colors"
      >
        <span className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${style.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] font-medium px-2 py-0.5 border ${style.badge}`}>
              {flag.severity.toUpperCase()}
            </span>
            <span className="text-xs text-[rgba(26,26,26,0.4)] font-mono">{flag.file}:{flag.line}</span>
          </div>
          <p className="text-sm text-[#1A1A1A] mt-1.5">{flag.title}</p>
        </div>
        <span className="text-[rgba(26,26,26,0.3)] text-sm mt-1 flex-shrink-0">
          {expanded ? '\u25B2' : '\u25BC'}
        </span>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-[rgba(0,0,0,0.06)] pt-4 space-y-4">
          <div>
            <h4 className="text-[13px] font-medium uppercase tracking-[0.08em] text-[rgba(26,26,26,0.4)] mb-1">Description</h4>
            <p className="text-sm text-[rgba(26,26,26,0.7)]">{flag.description}</p>
          </div>

          {flag.codeSnippet && (
            <div>
              <h4 className="text-[13px] font-medium uppercase tracking-[0.08em] text-[rgba(26,26,26,0.4)] mb-1">Code</h4>
              <pre className="bg-[#F8F8F6] border border-[rgba(0,0,0,0.06)] p-3 text-xs text-[#1A1A1A] overflow-x-auto whitespace-pre-wrap font-mono">
                {flag.codeSnippet}
              </pre>
            </div>
          )}

          {/* Per-call cost estimate */}
          <div className="bg-[#F8F8F6] border border-[rgba(0,0,0,0.06)] p-4">
            <h4 className="text-[13px] font-medium uppercase tracking-[0.08em] text-[rgba(26,26,26,0.4)] mb-2">Cost per call</h4>
            <div className="flex items-center gap-4 text-sm font-mono">
              <div>
                <span className="text-[rgba(26,26,26,0.4)] text-xs">Before: </span>
                <span className="text-[#DC2626]">${estimate.beforeCost.toFixed(4)}</span>
              </div>
              <span className="text-[rgba(26,26,26,0.2)]">&rarr;</span>
              <div>
                <span className="text-[rgba(26,26,26,0.4)] text-xs">After: </span>
                <span className="text-[#1A1A1A]">${estimate.afterCost.toFixed(4)}</span>
              </div>
              <span className="text-[#D97706] text-xs font-medium">-{estimate.savingsPercent}%</span>
            </div>
            <p className="text-[10px] text-[rgba(26,26,26,0.4)] mt-2">{estimate.explanation} ({estimate.modelLabel} pricing)</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Detail label="Impact" value={flag.impact} />
            <Detail label="Fix" value={flag.fix} />
            <Detail label="Savings" value={flag.savingsRatio} />
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <h4 className="text-[13px] font-medium uppercase tracking-[0.08em] text-[rgba(26,26,26,0.4)] mb-1">{label}</h4>
      <p className="text-sm text-[rgba(26,26,26,0.7)]">{value}</p>
    </div>
  );
}
