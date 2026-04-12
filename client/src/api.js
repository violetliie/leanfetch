export async function startScan(config, onEvent) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1_800_000); // 30 min

  try {
    const response = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
      signal: controller.signal,
    });

    if (!response.ok && response.headers.get('content-type')?.includes('application/json')) {
      const err = await response.json();
      throw new Error(err.error || `Server error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (line.trim()) {
          try {
            onEvent(JSON.parse(line));
          } catch {
            // skip malformed lines
          }
        }
      }
    }

    // flush remaining buffer
    if (buffer.trim()) {
      try {
        onEvent(JSON.parse(buffer));
      } catch {
        // skip
      }
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

// Cost rates per million tokens
const RATES = {
  haiku: { input: 1.0, output: 5.0, cacheRead: 0.1, cacheCreation: 1.25 },
  sonnet: { input: 3.0, output: 15.0, cacheRead: 0.3, cacheCreation: 3.75 },
};

export function calculateCost(tokenUsage) {
  const calc = (usage, rates) => {
    const inputCost = ((usage.input - (usage.cacheRead || 0) - (usage.cacheCreation || 0)) * rates.input) / 1_000_000;
    const outputCost = (usage.output * rates.output) / 1_000_000;
    const cacheReadCost = ((usage.cacheRead || 0) * rates.cacheRead) / 1_000_000;
    const cacheCreationCost = ((usage.cacheCreation || 0) * rates.cacheCreation) / 1_000_000;
    return inputCost + outputCost + cacheReadCost + cacheCreationCost;
  };

  const triageCost = calc(tokenUsage.triage, RATES.haiku);
  const deepScanCost = calc(tokenUsage.deepScan, RATES.sonnet);
  const synthesisCost = calc(tokenUsage.synthesis, RATES.sonnet);

  return {
    triage: triageCost,
    deepScan: deepScanCost,
    synthesis: synthesisCost,
    total: triageCost + deepScanCost + synthesisCost,
  };
}
