import { readdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const files = await readdir('chrome-extension');
for (const file of files.filter(file => file.endsWith('.js'))) execFileSync(process.execPath, ['--check', `chrome-extension/${file}`]);
const manifest = JSON.parse(await readFile('chrome-extension/manifest.json', 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, '3.0.0');
assert.deepEqual(manifest.host_permissions, ['https://generativelanguage.googleapis.com/*']);
assert.deepEqual(manifest.permissions.sort(), ['activeTab', 'contextMenus', 'scripting', 'storage']);
assert.deepEqual(manifest.web_accessible_resources[0].resources, ['summary.css']);
for (const file of files.filter(file => /\.(js|html|css|json)$/.test(file))) {
  const text = await readFile(`chrome-extension/${file}`, 'utf8');
  assert(!/\p{Extended_Pictographic}/u.test(text), `Unexpected emoji in ${file}`);
  assert(!/\b(?:alert|confirm)\s*\(/.test(text), `Native dialog in ${file}`);
  assert(!/console\.(log|warn|error)/.test(text), `Potential sensitive logging in ${file}`);
}
console.log('Extension syntax, manifest, permissions, and source hygiene checks passed.');
