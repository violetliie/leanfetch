import { execFile } from 'child_process';
import { mkdtempSync, readdirSync, readFileSync, statSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, extname } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Clone a public/private GitHub repo and return all files with paths + sizes.
 * Uses `git clone --depth 1` — zero GitHub API calls, no rate limits.
 */
export async function cloneAndReadRepo(owner, repo, branch, pat) {
  let cloneUrl;
  if (pat) {
    cloneUrl = `https://x-access-token:${pat}@github.com/${owner}/${repo}.git`;
  } else {
    cloneUrl = `https://github.com/${owner}/${repo}.git`;
  }

  const tmpDir = mkdtempSync(join(tmpdir(), 'leanfetch-'));
  const repoDir = join(tmpDir, repo);

  try {
    const cloneArgs = ['clone', '--depth', '1'];
    if (branch) cloneArgs.push('--branch', branch);
    cloneArgs.push(cloneUrl, repoDir);

    await execFileAsync('git', cloneArgs, { timeout: 60_000 });

    // Walk the repo and collect all files
    const files = [];
    walkDir(repoDir, repoDir, files);
    return { files, tmpDir, repoDir };
  } catch (err) {
    // Clean up on failure
    rmSync(tmpDir, { recursive: true, force: true });
    if (err.message?.includes('not found') || err.stderr?.includes('not found')) {
      throw new Error(`Repository ${owner}/${repo} not found. If private, provide a GitHub PAT.`);
    }
    if (err.stderr?.includes('could not read Username')) {
      throw new Error(`Repository ${owner}/${repo} requires authentication. Provide a GitHub PAT.`);
    }
    throw new Error(`Failed to clone repository: ${err.stderr || err.message}`);
  }
}

function walkDir(baseDir, currentDir, files) {
  const entries = readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.git') continue;
    const fullPath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      walkDir(baseDir, fullPath, files);
    } else if (entry.isFile()) {
      const relativePath = fullPath.slice(baseDir.length + 1);
      try {
        const stat = statSync(fullPath);
        files.push({
          path: relativePath,
          size: stat.size,
          fullPath,
        });
      } catch {
        // skip unreadable files
      }
    }
  }
}

/**
 * Read file contents from the cloned repo on disk.
 * Much faster than API — just fs.readFileSync.
 */
export function readFileContents(files, onProgress) {
  const results = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const content = readFileSync(file.fullPath, 'utf-8');
      results.push({ ...file, content });
    } catch {
      // skip binary/unreadable files
    }
    if (onProgress) onProgress({ current: i + 1, total: files.length, file: file.path });
  }
  return results;
}

export function cleanupClone(tmpDir) {
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // best effort
  }
}
