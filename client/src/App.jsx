import { useState, useCallback } from 'react';
import { startScan } from './api';
import { getSavedScans } from './savedScans';
import Header from './components/Header';
import InputPanel from './components/InputPanel';
import ProgressLog from './components/ProgressLog';
import ReportView from './components/ReportView';
import SavedScans from './components/SavedScans';
import SplashScreen from './components/SplashScreen';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [phase, setPhase] = useState('idle');
  const [steps, setSteps] = useState([]);
  const [report, setReport] = useState(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [sourceType, setSourceType] = useState('github');
  const [error, setError] = useState(null);
  const [savedScans, setSavedScans] = useState(() => getSavedScans());
  const [inputKey, setInputKey] = useState(0);

  const refreshSaved = () => setSavedScans(getSavedScans());

  const handleSplashComplete = useCallback(() => setShowSplash(false), []);

  const handleScan = useCallback(async (config) => {
    setPhase('scanning');
    setSteps([]);
    setReport(null);
    setSourceType(config.sourceType || 'github');
    setRepoUrl(
      config.sourceType === 'plan' ? (config.planName || 'plan.md') :
      config.sourceType === 'files' ? `${config.files?.length || 0} uploaded file${(config.files?.length || 0) !== 1 ? 's' : ''}` :
      config.url
    );
    setError(null);

    try {
      await startScan(config, (event) => {
        if (event.type === 'progress') {
          setSteps((prev) => {
            const idx = prev.findIndex((s) => s.phase === event.phase && !s.done);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = event;
              return updated;
            }
            return [...prev, event];
          });
        } else if (event.type === 'complete') {
          setReport(event.report);
          setPhase('complete');
        } else if (event.type === 'error') {
          setError(event.message);
          setPhase('error');
        }
      });
      if (phase === 'scanning') {
        setPhase((p) => (p === 'scanning' ? 'error' : p));
        setError((e) => e || 'Scan ended unexpectedly');
      }
    } catch (err) {
      setError(err.message);
      setPhase('error');
    }
  }, []);

  const handleReset = () => {
    setPhase('idle');
    setSteps([]);
    setReport(null);
    setRepoUrl('');
    setError(null);
    setInputKey((k) => k + 1);
    refreshSaved();
  };

  const handleLoadSaved = (scan) => {
    setReport(scan.report);
    setRepoUrl(scan.repoUrl);
    setPhase('complete');
  };

  return (
    <>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}

      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-content mx-auto w-full px-6 md:px-12 py-12">
          <InputPanel
            key={inputKey}
            onScan={handleScan}
            disabled={phase === 'scanning'}
            ready={!showSplash}
          />

          {phase === 'scanning' && (
            <div className="mt-10">
              <ProgressLog steps={steps} sourceType={sourceType} />
            </div>
          )}

          {phase === 'error' && (
            <div className="mt-10 bg-red-50 border border-[#DC2626]/20 p-5">
              <p className="text-[#DC2626] font-medium text-sm">Scan failed</p>
              <p className="text-[#DC2626]/70 text-sm mt-1">{error}</p>
              <button
                onClick={handleReset}
                className="mt-3 text-sm text-[#DC2626] hover:text-[#1A1A1A] underline"
              >
                Try again
              </button>
            </div>
          )}

          {phase === 'complete' && report && (
            <div className="mt-10">
              <ReportView report={report} repoUrl={repoUrl} onNewScan={handleReset} onSaved={refreshSaved} />
            </div>
          )}

          {phase === 'idle' && (
            <SavedScans scans={savedScans} onLoad={handleLoadSaved} onRefresh={refreshSaved} />
          )}
        </main>
      </div>
    </>
  );
}
