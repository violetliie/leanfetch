import { Router } from 'express';
import { cloneAndReadRepo, readFileContents, cleanupClone } from '../services/github.js';
import { structuralFilter, subpathFilter, keywordFilter } from '../services/filter.js';
import { triage, deepScan, synthesize } from '../services/analyzer.js';

const router = Router();

router.post('/', async (req, res) => {
  const { sourceType, url, anthropicKey, githubPat, subpath } = req.body;

  if (!anthropicKey) {
    return res.status(400).json({ error: 'Anthropic API key is required' });
  }
  if (sourceType !== 'github' || !url) {
    return res.status(400).json({ error: 'GitHub URL is required for this source type' });
  }

  // NDJSON streaming response
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (event) => res.write(JSON.stringify(event) + '\n');

  const tokenUsage = {
    triage: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
    deepScan: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
    synthesis: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
  };

  let tmpDir = null;

  try {
    const parsed = parseGitHubUrl(url);

    // 1. Clone repo (zero GitHub API calls)
    send({ type: 'progress', phase: 'fetch', message: `Cloning ${parsed.owner}/${parsed.repo}...` });
    const clone = await cloneAndReadRepo(parsed.owner, parsed.repo, parsed.branch, githubPat);
    tmpDir = clone.tmpDir;
    send({ type: 'progress', phase: 'fetch', message: `Cloned repository (${clone.files.length} files)`, done: true });

    // 2. Subpath filter (monorepo scoping) + Structural filter
    const scopedFiles = subpathFilter(clone.files, subpath);
    send({ type: 'progress', phase: 'structural', message: `Applying structural filters${subpath ? ` (scoped to ${subpath})` : ''}...` });
    const afterStructural = structuralFilter(scopedFiles);
    send({ type: 'progress', phase: 'structural', message: `Structural filter (${afterStructural.length} files remain)`, done: true });

    if (afterStructural.length === 0) {
      return finish(res, send, tokenUsage, clone.files.length, 0);
    }

    // 3. Read file contents from disk (instant, no API)
    send({ type: 'progress', phase: 'content', message: `Reading ${afterStructural.length} files from disk...` });
    const filesWithContent = readFileContents(afterStructural, (p) => {
      if (p.current % 20 === 0 || p.current === p.total) {
        send({ type: 'progress', phase: 'content', message: `Read ${p.current}/${p.total} files`, current: p.current, total: p.total });
      }
    });
    send({ type: 'progress', phase: 'content', message: `Read ${filesWithContent.length} file contents`, done: true });

    // 4. Keyword filter
    send({ type: 'progress', phase: 'keyword', message: 'Scanning for API keywords...' });
    const afterKeyword = keywordFilter(filesWithContent);
    send({ type: 'progress', phase: 'keyword', message: `Keyword filter (${afterKeyword.length} files remain)`, done: true });

    if (afterKeyword.length === 0) {
      return finish(res, send, tokenUsage, clone.files.length, 0);
    }

    // 5. Triage
    send({ type: 'progress', phase: 'triage', message: `Starting triage on ${afterKeyword.length} files...`, current: 0, total: afterKeyword.length });
    const triaged = await triage(afterKeyword, anthropicKey, (p) => {
      send({ type: 'progress', phase: 'triage', message: `Triage: analyzing ${p.file}...`, current: p.current, total: p.total });
      if (p.usage) addUsage(tokenUsage.triage, p.usage);
    });
    const relevant = triaged.filter((f) => f.relevant);
    send({ type: 'progress', phase: 'triage', message: `Triage complete (${relevant.length} files flagged for deep scan)`, done: true });

    if (relevant.length === 0) {
      return finish(res, send, tokenUsage, clone.files.length, 0);
    }

    // 6. Deep scan (Sonnet for speed, Opus for API key mode)
    send({ type: 'progress', phase: 'deepScan', message: `Starting deep scan on ${relevant.length} files...`, current: 0, total: relevant.length });
    const allFlags = await deepScan(relevant, anthropicKey, (p) => {
      const msg = p.message || `Deep scan: analyzing ${p.file}...`;
      send({ type: 'progress', phase: 'deepScan', message: msg, current: p.current, total: p.total });
      if (p.usage) addUsage(tokenUsage.deepScan, p.usage);
    });
    send({ type: 'progress', phase: 'deepScan', message: `Deep scan complete (${allFlags.length} flags found)`, done: true });

    if (allFlags.length === 0) {
      return finish(res, send, tokenUsage, clone.files.length, relevant.length);
    }

    // 7. Synthesis
    send({ type: 'progress', phase: 'synthesis', message: 'Generating synthesis report...' });
    const report = await synthesize(allFlags, anthropicKey, (usage) => {
      addUsage(tokenUsage.synthesis, usage);
    });
    send({ type: 'progress', phase: 'synthesis', message: 'Synthesis complete', done: true });

    const summary = {
      filesScanned: clone.files.length,
      filesAnalyzed: relevant.length,
      totalFlags: report.flags.length,
      critical: report.flags.filter((f) => f.severity === 'critical').length,
      warning: report.flags.filter((f) => f.severity === 'warning').length,
      info: report.flags.filter((f) => f.severity === 'info').length,
    };

    send({ type: 'complete', report: { ...report, summary, tokenUsage } });
  } catch (err) {
    send({ type: 'error', message: err.message || 'An unexpected error occurred' });
  } finally {
    if (tmpDir) cleanupClone(tmpDir);
    res.end();
  }
});

function finish(res, send, tokenUsage, filesScanned, filesAnalyzed) {
  send({
    type: 'complete',
    report: {
      flags: [],
      overallAssessment: 'No API inefficiency patterns were found in this repository.',
      summary: { filesScanned, filesAnalyzed, totalFlags: 0, critical: 0, warning: 0, info: 0 },
      tokenUsage,
    },
  });
  res.end();
}

function addUsage(target, usage) {
  target.input += usage.input_tokens || 0;
  target.output += usage.output_tokens || 0;
  target.cacheRead += usage.cache_read_input_tokens || 0;
  target.cacheCreation += usage.cache_creation_input_tokens || 0;
}

function parseGitHubUrl(url) {
  url = url.trim().replace(/\/$/, '');

  let match = url.match(/(?:https?:\/\/)?github\.com\/([^/]+)\/([^/.#]+?)(?:\.git)?(?:\/tree\/([^/]+))?(?:\/.*)?$/);
  if (match) {
    return { owner: match[1], repo: match[2], branch: match[3] || null };
  }

  match = url.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (match) {
    return { owner: match[1], repo: match[2], branch: null };
  }

  throw new Error('Invalid GitHub URL. Use: https://github.com/owner/repo or owner/repo');
}

export { router as scanRouter };
