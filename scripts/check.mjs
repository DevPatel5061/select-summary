import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extension, releaseFiles, root } from './lib/release.mjs';
const files = await releaseFiles();
const available = new Set(files);
const manifest = JSON.parse(
  await readFile(new URL('manifest.json', extension), 'utf8')
);
for (const file of [
  manifest.background.service_worker,
  manifest.action.default_popup,
  ...Object.values(manifest.icons),
  ...manifest.web_accessible_resources.flatMap((entry) => entry.resources)
])
  assert(available.has(file), `Missing manifest resource: ${file}`);
for (const file of files) {
  const source = await readFile(new URL(file, extension), 'utf8');
  if (file.endsWith('.js')) {
    const result = spawnSync(
      process.execPath,
      ['--check', fileURLToPath(new URL(file, extension))],
      { encoding: 'utf8' }
    );
    assert.equal(result.status, 0, result.stderr);
    for (const match of source.matchAll(
      /(?:from\s*|import\s*\(?\s*)['"](\.[^'"]+)['"]/g
    )) {
      const target = posix.normalize(posix.join(posix.dirname(file), match[1]));
      assert(available.has(target), `Missing import ${file}: ${match[1]}`);
    }
  }
  if (file.endsWith('.html')) {
    for (const match of source.matchAll(/(?:src|href)="([^"#]+)"/g))
      if (!/^(https?:|chrome:)/.test(match[1]))
        assert(available.has(match[1]), `Missing HTML asset: ${match[1]}`);
  }
}
// Also syntax-check repository-owned tooling and tests.
async function checkDirectory(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const file = resolve(path, entry.name);
    if (entry.isDirectory()) await checkDirectory(file);
    else if (entry.name.endsWith('.mjs')) {
      const result = spawnSync(process.execPath, ['--check', file], {
        encoding: 'utf8'
      });
      assert.equal(result.status, 0, result.stderr);
    }
  }
}
await checkDirectory(resolve(root, 'scripts'));
await checkDirectory(resolve(root, 'tests'));
console.log(
  `Checked syntax, imports, HTML assets and manifest references for ${files.length} release files.`
);
