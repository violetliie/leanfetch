export default function Header() {
  return (
    <header className="border-b border-[rgba(0,0,0,0.06)] bg-[#F8F8F6] sticky top-0 z-10">
      <div className="max-w-content mx-auto px-6 md:px-12 py-4 flex items-center gap-3">
        <div className="w-8 h-8 bg-[#1A1A1A] flex items-center justify-center text-white font-medium text-sm">
          LF
        </div>
        <div>
          <h1 className="text-lg font-light tracking-tight text-[#1A1A1A]">LeanFetch</h1>
          <p className="text-[13px] font-medium text-[rgba(26,26,26,0.4)]">API cost auditor for LLM codebases</p>
        </div>
      </div>
    </header>
  );
}
