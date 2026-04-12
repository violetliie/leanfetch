import { useState } from 'react';
import SummaryBar from './SummaryBar';
import FlagCard from './FlagCard';
import CostBreakdown from './CostBreakdown';
import SavingsSimulator from './SavingsSimulator';
import { saveScan } from '../savedScans';

export default function ReportView({ report, repoUrl, onNewScan, onSaved }) {
  const { flags, summary, tokenUsage, overallAssessment, topRecommendation, estimatedSavings } = report;
  const [saved, setSaved] = useState(false);

  const handleCopy = () => {
    const md = buildMarkdown(report);
    navigator.clipboard.writeText(md);
  };

  const handleSave = () => {
    saveScan(repoUrl || 'unknown', report);
    setSaved(true);
    if (onSaved) onSaved();
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <SummaryBar summary={summary} tokenUsage={tokenUsage} />

      {overallAssessment && (
        <div className="bg-white border border-[rgba(0,0,0,0.06)] p-6">
          <h3 className="text-[13px] font-medium uppercase tracking-[0.08em] text-[rgba(26,26,26,0.4)] mb-3">Overall Assessment</h3>
          <p className="text-[15px] text-[rgba(26,26,26,0.7)] leading-relaxed">{overallAssessment}</p>
          {topRecommendation && (
            <div className="mt-4 p-4 bg-[#F8F8F6] border-l-2 border-l-[#1A1A1A] border border-[rgba(0,0,0,0.06)]">
              <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-[rgba(26,26,26,0.4)] mb-1">Top Recommendation</p>
              <p className="text-sm text-[#1A1A1A]">{topRecommendation}</p>
            </div>
          )}
          {estimatedSavings?.perInvocationSummary && (
            <p className="text-xs text-[rgba(26,26,26,0.4)] mt-4">{estimatedSavings.perInvocationSummary}</p>
          )}
        </div>
      )}

      {flags.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13px] font-medium uppercase tracking-[0.08em] text-[rgba(26,26,26,0.4)]">
              Flags ({flags.length})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className={`text-[13px] font-medium px-4 py-1.5 transition-colors ${
                  saved
                    ? 'text-[rgba(26,26,26,0.4)] border border-[rgba(0,0,0,0.06)]'
                    : 'text-[rgba(26,26,26,0.5)] hover:text-[#1A1A1A] border border-[rgba(0,0,0,0.1)] hover:border-[rgba(0,0,0,0.2)]'
                }`}
              >
                {saved ? 'Saved' : 'Save Scan'}
              </button>
              <button
                onClick={handleCopy}
                className="text-[13px] font-medium text-[rgba(26,26,26,0.5)] hover:text-[#1A1A1A] border border-[rgba(0,0,0,0.1)] hover:border-[rgba(0,0,0,0.2)] px-4 py-1.5 transition-colors"
              >
                Copy Report
              </button>
              <button
                onClick={onNewScan}
                className="text-[13px] font-medium text-white bg-[#1A1A1A] hover:bg-[#333333] px-4 py-1.5 transition-colors"
              >
                New Scan
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {flags.map((flag, i) => (
              <FlagCard key={`${flag.file}-${flag.line}-${i}`} flag={flag} />
            ))}
          </div>
        </div>
      )}

      {flags.length === 0 && (
        <div className="bg-white border border-[rgba(0,0,0,0.06)] p-10 text-center">
          <p className="text-[rgba(26,26,26,0.7)]">No API inefficiency patterns were found.</p>
          <p className="text-sm text-[rgba(26,26,26,0.4)] mt-1">Your codebase looks clean!</p>
          <button
            onClick={onNewScan}
            className="mt-4 text-sm text-[#1A1A1A] hover:text-[rgba(26,26,26,0.6)] underline"
          >
            Scan another repository
          </button>
        </div>
      )}

      {flags.length > 0 && <SavingsSimulator flags={flags} />}

      <CostBreakdown tokenUsage={tokenUsage} />
    </div>
  );
}

function buildMarkdown(report) {
  const { flags, summary, overallAssessment, topRecommendation } = report;
  let md = `# LeanFetch Scan Report\n\n`;
  md += `Files scanned: ${summary.filesScanned} | Flags: ${summary.totalFlags} | Critical: ${summary.critical} | Warning: ${summary.warning} | Info: ${summary.info}\n\n`;

  if (overallAssessment) md += `## Assessment\n${overallAssessment}\n\n`;
  if (topRecommendation) md += `**Top recommendation:** ${topRecommendation}\n\n`;

  if (flags.length > 0) {
    md += `## Flags\n\n`;
    for (const f of flags) {
      md += `### [${f.severity.toUpperCase()}] ${f.title}\n`;
      md += `**File:** ${f.file}:${f.line}\n\n`;
      md += `${f.description}\n\n`;
      if (f.codeSnippet) md += `\`\`\`\n${f.codeSnippet}\n\`\`\`\n\n`;
      md += `**Impact:** ${f.impact}\n**Fix:** ${f.fix}\n**Savings:** ${f.savingsRatio}\n\n---\n\n`;
    }
  }

  return md;
}
