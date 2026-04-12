import { useState } from 'react';

export default function InputPanel({ onScan, disabled }) {
  const [anthropicKey, setAnthropicKey] = useState('');
  const [githubPat, setGithubPat] = useState('');
  const [url, setUrl] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!anthropicKey.trim() || !url.trim()) return;
    onScan({
      sourceType: 'github',
      url: url.trim(),
      anthropicKey: anthropicKey.trim(),
      githubPat: githubPat.trim() || undefined,
    });
  };

  const inputClass =
    'w-full bg-white border border-[rgba(0,0,0,0.1)] px-3 py-2.5 text-sm text-[#1A1A1A] placeholder-[rgba(26,26,26,0.3)] focus:outline-none focus:border-[#1A1A1A] focus:ring-1 focus:ring-[#1A1A1A] disabled:opacity-50';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[rgba(0,0,0,0.06)] p-6 md:p-8">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="block text-[13px] font-medium uppercase tracking-[0.08em] text-[rgba(26,26,26,0.4)] mb-2">
            Anthropic API Key <span className="text-[#DC2626]">*</span>
          </label>
          <input
            type="password"
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            placeholder="sk-ant-..."
            disabled={disabled}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-[13px] font-medium uppercase tracking-[0.08em] text-[rgba(26,26,26,0.4)] mb-2">
            GitHub PAT <span className="text-[rgba(26,26,26,0.3)] normal-case tracking-normal">(optional, for private repos)</span>
          </label>
          <input
            type="password"
            value={githubPat}
            onChange={(e) => setGithubPat(e.target.value)}
            placeholder="ghp_..."
            disabled={disabled}
            className={inputClass}
          />
        </div>
      </div>

      <div className="mt-5">
        <label className="block text-[13px] font-medium uppercase tracking-[0.08em] text-[rgba(26,26,26,0.4)] mb-2">
          GitHub Repository URL <span className="text-[#DC2626]">*</span>
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/owner/repo or owner/repo"
          disabled={disabled}
          className={inputClass}
        />
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs text-[rgba(26,26,26,0.4)]">
          Keys are not stored and exist only for the duration of your scan.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={disabled || !url.trim()}
            onClick={() => {
              if (!url.trim()) return;
              onScan({ sourceType: 'github', url: url.trim(), anthropicKey: 'demo', githubPat: githubPat.trim() || undefined });
            }}
            className="text-[13px] font-medium text-[rgba(26,26,26,0.5)] hover:text-[#1A1A1A] px-4 py-2.5 transition-colors disabled:text-[rgba(26,26,26,0.2)]"
          >
            Demo Scan
          </button>
          <button
            type="button"
            disabled={disabled || !url.trim()}
            onClick={() => {
              if (!url.trim()) return;
              onScan({ sourceType: 'github', url: url.trim(), anthropicKey: 'cli', githubPat: githubPat.trim() || undefined });
            }}
            className="border border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white text-[13px] font-medium px-5 py-2.5 transition-colors disabled:border-[rgba(0,0,0,0.1)] disabled:text-[rgba(26,26,26,0.3)] disabled:hover:bg-transparent disabled:hover:text-[rgba(26,26,26,0.3)]"
          >
            {disabled ? 'Scanning...' : 'Scan via Subscription'}
          </button>
          <button
            type="submit"
            disabled={disabled || !anthropicKey.trim() || !url.trim()}
            className="bg-[#1A1A1A] hover:bg-[#333333] text-white text-[13px] font-medium px-5 py-2.5 transition-colors disabled:bg-[rgba(26,26,26,0.15)] disabled:text-[rgba(26,26,26,0.3)]"
          >
            {disabled ? 'Scanning...' : 'Scan (API Key)'}
          </button>
        </div>
      </div>
    </form>
  );
}
