import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const engine = join(root, 'src', 'chart-engine');
const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]);

test('internal chart engine includes each runtime tier', () => {
  for (const entry of ['index.ts', 'widget/index.ts', 'indicators/index.ts', 'draw/index.ts', 'transform/index.ts', 'profile/index.ts', 'trade/index.ts']) {
    assert.equal(existsSync(join(engine, entry)), true, entry);
  }
});

test('application uses only Layer Zero chart-engine imports', () => {
  const packageJson = readFileSync(join(root, 'package.json'), 'utf8');
  const terminal = readFileSync(join(root, 'src', 'components', 'OpenAlgoTerminal', 'ChartTerminal.jsx'), 'utf8');
  assert.equal(packageJson.includes('"openalgo-charts"'), false);
  assert.match(terminal, /@layr0\/chart-engine\/widget/);
  for (const file of files(engine).filter((item) => item.endsWith('.ts'))) {
    assert.equal(readFileSync(file, 'utf8').includes("from 'openalgo-charts"), false, file);
  }
});
