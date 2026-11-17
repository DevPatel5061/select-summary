import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { extension, releaseFiles, root } from './lib/release.mjs';
const check = spawnSync(process.execPath, [join(root, 'scripts/check.mjs')], {
  stdio: 'inherit',
  cwd: root
});
if (check.status !== 0) process.exit(check.status || 1);
const manifest = JSON.parse(
  await readFile(new URL('manifest.json', extension), 'utf8')
);
const staging = await mkdtemp(join(tmpdir(), 'select-summary-release-'));
const archive = join(root, 'dist', `select-summary-${manifest.version}.zip`);
try {
  const files = await releaseFiles();
  for (const file of files) {
    await mkdir(dirname(join(staging, file)), { recursive: true });
    await cp(new URL(file, extension), join(staging, file));
  }
  await mkdir(dirname(archive), { recursive: true });
  await rm(archive, { force: true });
  const result = spawnSync('zip', ['-q', archive, ...files], {
    cwd: staging,
    stdio: 'inherit'
  });
  if (result.status !== 0)
    throw new Error('Could not create archive; install the zip command.');
  console.log(`Packaged ${files.length} runtime files: ${archive}`);
} finally {
  await rm(staging, { recursive: true, force: true });
}
