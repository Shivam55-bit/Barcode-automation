import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const evidenceDir = path.resolve('release-evidence');
mkdirSync(evidenceDir, { recursive: true });
const mode = process.argv[2] || 'fast';
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const isMain = path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url);

export function sourceFingerprint(): string {
  const files: string[] = [];
  const walk = (directory: string) => {
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, item.name);
      if (item.isDirectory()) walk(filePath);
      else files.push(filePath);
    }
  };
  for (const directory of ['src', 'electron', 'barcode-automation-backend/src', 'scripts', 'test', 'public/samples']) walk(directory);
  if (existsSync('.github/workflows')) walk('.github/workflows');
  files.push('server.ts', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'electron-builder.json', 'electron-builder.unsigned.json', 'test_suite_runner.ts', 'release-evidence/PRODUCTION_BLOCKERS.json');
  return createHash('sha256').update(JSON.stringify(files.sort().map(file => [file.replaceAll('\\', '/'), createHash('sha256').update(readFileSync(file)).digest('hex')]))).digest('hex');
}

const sourceDigest = sourceFingerprint();

function inventory() {
  const entries: any[] = [];
  const installedPath = path.join(evidenceDir, 'desktop', 'installed-results.json');
  const installed = existsSync(installedPath) ? JSON.parse(readFileSync(installedPath, 'utf8')) : undefined;
  const artifactPath = path.resolve('dist-electron-build', 'BarcodeFlow_Setup_Dev_Unsigned.exe');
  const artifactDigest = existsSync(artifactPath) ? createHash('sha256').update(readFileSync(artifactPath)).digest('hex') : undefined;
  const currentInstalled = installed?.sourceDigest === sourceDigest && installed?.installerDigest === artifactDigest && installed?.checks?.every((check: any) => check.status === 'passed');
  const toolbarTests: Record<string, string[]> = {
    'Open Document (Ctrl+O)': ['UI-ROUNDTRIP-001'],
    'Save Document (Ctrl+S)': ['UI-EDIT-001', 'UI-EDIT-002'],
    'Save As... (Ctrl+Shift+S)': ['UI-EDIT-001'],
    'Undo (Ctrl+Z)': ['UI-EDIT-001'],
    'Redo (Ctrl+Y)': ['UI-EDIT-001'],
  };
  const menuTests: Record<string, string[]> = {
    'Print Preview': ['UI-PREVIEW-001'],
    'Export Portable Editable Template (.bfl)...': ['UI-PORTABLE-001', 'UI-SHARE-001'],
  };
  const walk = (directory: string) => {
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, item.name);
      if (item.isDirectory()) { walk(filePath); continue; }
      if (!item.name.endsWith('.tsx')) continue;
      const source = ts.createSourceFile(filePath, readFileSync(filePath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node: ts.Node) => {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
          const tag = node.tagName.getText(source);
          const attributes = node.attributes.properties.filter(ts.isJsxAttribute);
          const attribute = (name: string) => attributes.find(value => value.name.getText(source) === name)?.initializer;
          const literal = (value?: ts.JsxAttributeValue): string => {
            if (!value) return '';
            if (ts.isStringLiteral(value)) return value.text;
            if (ts.isJsxExpression(value) && value.expression && ts.isStringLiteral(value.expression)) return value.expression.text;
            return value.getText(source);
          };
          const interactive = ['button', 'select', 'input', 'textarea', 'MenuItem', 'PropertyItem'].includes(tag) || attribute('onClick') || attribute('onChange');
          if (interactive) {
            const parent = node.parent;
            const children = ts.isJsxElement(parent) ? parent.children.filter(ts.isJsxText).map(value => value.text.trim()).filter(Boolean).join(' ') : '';
            const label = literal(attribute('title')) || literal(attribute('aria-label')) || literal(attribute('label')) || children || `${tag}: ${literal(attribute('placeholder')) || 'dynamic label'}`;
            const handler = literal(attribute('onClick')) || literal(attribute('onChange')) || literal(attribute('onMouseDown')) || '';
            const relativePath = filePath.replaceAll('\\', '/');
            const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
            const testIds = relativePath === 'src/components/toolbar/ObjectToolbar.tsx'
              ? toolbarTests[label] || (label.includes('Insert Text Object (') ? ['UI-EDIT-002'] : [])
              : relativePath === 'src/components/menu/MenuBar.tsx' ? menuTests[label] || [] : [];
            const verified = currentInstalled && testIds.length && testIds.every(id => installed.checks.some((check: any) => check.id === id && check.status === 'passed'));
            entries.push({
              id: `UI-${createHash('sha256').update(`${relativePath}:${node.getStart(source)}`).digest('hex').slice(0, 10)}`,
              uiEntry: label, intendedBehavior: handler || 'Controlled value; owning handler requires verification',
              location: `${relativePath}#L${line}`, persistenceRequirements: 'Document properties must survive .bfl reopen; view/session settings require separate verification',
              automatedTestIds: testIds, status: verified ? 'partially implemented' : 'incomplete',
              evidence: verified
                ? `Installed native-label workflow verified by desktop/installed-results.json; artifact SHA-256 ${artifactDigest}. Other document types and all property-history cases are not certified.`
                : 'Source entry found; complete integration and current packaged behavior not yet established',
            });
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
  };
  walk('src/components');
  const escape = (value: string) => value.replaceAll('|', '\\|').replace(/\s+/g, ' ').slice(0, 450);
  const header = '# Source Feature Inventory\n\nGenerated from actual JSX labels, titles, inputs, and handlers. Dynamic labels are recorded as expressions, never inferred from icon appearance. `incomplete` means end-to-end evidence is missing, not that the handler necessarily fails. Source-only evidence is not product completion. Keyboard handlers, generated option sets, and indirect component props require follow-up mapping.\n\n';
  const table = '| Feature ID | UI entry | Intended behavior | Implementation location | Persistence requirements | Automated test IDs | Status | Evidence |\n|---|---|---|---|---|---|---|---|\n';
  writeFileSync(path.join(evidenceDir, 'feature-inventory.json'), JSON.stringify({ generatedAt: new Date().toISOString(), sourceDigest, entries }, null, 2));
  writeFileSync(path.join(evidenceDir, 'FEATURE_MATRIX.md'), header + table + entries.map(entry => `| ${entry.id} | ${escape(entry.uiEntry)} | ${escape(entry.intendedBehavior)} | ${entry.location} | ${entry.persistenceRequirements} | ${entry.automatedTestIds.join(', ') || 'none yet'} | ${entry.status} | ${entry.evidence} |`).join('\n') + '\n');
  console.log(`Inventoried ${entries.length} real UI controls; unverified controls remain explicitly incomplete.`);
}

const checks: Array<{ id: string; status: string; exitCode: number | null; log: string }> = [];
function check(id: string, executable: string, args: string[]) {
  const result = spawnSync(executable, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const output = `${result.stdout || ''}${result.stderr || ''}${result.error || ''}`;
  const log = `${mode}-${runId}-${id}.log`;
  writeFileSync(path.join(evidenceDir, log), output);
  writeFileSync(path.join(evidenceDir, `${mode}-${id}.log`), output);
  const status = result.status === 0 ? 'passed' : 'failed';
  checks.push({ id, status, exitCode: result.status, log });
  console.log(`${id}: ${status}; log: release-evidence/${log}`);
  if (status === 'failed') console.log(output.slice(-5000));
}

if (isMain && mode === 'manifest') {
  const manifest = { version: JSON.parse(readFileSync('package.json', 'utf8')).version, sourceDigest, createdAt: new Date().toISOString() };
  writeFileSync(path.resolve('dist', 'release-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Bundled source manifest: ${sourceDigest}`);
} else if (isMain && mode === 'gate') {
  const blockers: Array<{ id: string; evidence: string }> = [];
  const artifact = path.resolve('dist-electron-build', 'BarcodeFlow_Setup_Dev_Unsigned.exe');
  const artifactDigest = existsSync(artifact) ? createHash('sha256').update(readFileSync(artifact)).digest('hex') : undefined;
  for (const relative of ['fast-results.json', 'regression-results.json', 'rendering-results.json', 'desktop/built-results.json', 'desktop/packaged-results.json', 'desktop/installed-results.json']) {
    const filePath = path.join(evidenceDir, relative);
    if (!existsSync(filePath)) { blockers.push({ id: 'EVIDENCE-MISSING', evidence: relative }); continue; }
    const result = JSON.parse(readFileSync(filePath, 'utf8'));
    if (result.sourceDigest !== sourceDigest) blockers.push({ id: 'EVIDENCE-STALE', evidence: relative });
    if (!result.checks?.length || result.checks.some((entry: any) => entry.status !== 'passed')) blockers.push({ id: 'CHECK-FAILED', evidence: relative });
    if (relative.startsWith('desktop/')) {
      const required = ['ARTIFACT-IDENTITY-001', 'SEC-AUTH-001', 'DOC-IPC-001', 'UI-EDIT-001', 'UI-EDIT-002', 'UI-ROUNDTRIP-001', 'UI-MULTIDOC-001', 'UI-PREVIEW-001', 'UI-PORTABLE-001', 'UI-SHARE-001', 'E2E-PRODUCT', 'E2E-SHIPPING', 'E2E-INVENTORY', 'E2E-EXPIRY', 'E2E-DATA', 'E2E-MIXED'];
      if (!relative.includes('built')) required.push('ARTIFACT-RESOURCES-001');
      if (relative.includes('installed')) required.push('INSTALL-001', 'INSTALL-REINSTALL-001', 'INSTALL-UNINSTALL-001');
      for (const id of required) if (!result.checks?.some((entry: any) => entry.id === id && entry.status === 'passed')) blockers.push({ id: 'REQUIRED-CHECK-MISSING', evidence: `${relative}: ${id}` });
    }
    if (relative.includes('installed') && (!artifactDigest || result.installerDigest !== artifactDigest)) blockers.push({ id: 'ARTIFACT-MISMATCH', evidence: relative });
  }
  const inventoryPath = path.join(evidenceDir, 'feature-inventory.json');
  if (!existsSync(inventoryPath)) blockers.push({ id: 'UI-INVENTORY-MISSING', evidence: 'A source-derived functional matrix is required' });
  else {
    const matrix = JSON.parse(readFileSync(inventoryPath, 'utf8'));
    if (matrix.sourceDigest !== sourceDigest) blockers.push({ id: 'EVIDENCE-STALE', evidence: 'feature-inventory.json' });
    const incomplete = matrix.entries?.filter((entry: any) => entry.status !== 'implemented').length;
    if (!matrix.entries?.length || incomplete) blockers.push({ id: 'UI-VERIFICATION-INCOMPLETE', evidence: `${incomplete || 0} controls lack full current functional evidence` });
  }
  const knownPath = path.join(evidenceDir, 'PRODUCTION_BLOCKERS.json');
  if (!existsSync(knownPath)) blockers.push({ id: 'BLOCKER-REGISTER-MISSING', evidence: 'Required limitation register is missing' });
  else blockers.push(...JSON.parse(readFileSync(knownPath, 'utf8')).blockers);
  const result = { generatedAt: new Date().toISOString(), sourceDigest, artifactDigest, status: blockers.length ? 'blocked' : 'passed', blockers };
  writeFileSync(path.join(evidenceDir, 'release-gate-results.json'), JSON.stringify(result, null, 2));
  writeFileSync(path.join(evidenceDir, `release-gate-${runId}.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = blockers.length ? 1 : 0;
} else if (isMain && mode === 'inventory') {
  inventory();
} else if (isMain) {
  const tsxCli = require.resolve('tsx/cli');
  if (mode === 'fast' || mode === 'regression') {
    check('types', process.execPath, [require.resolve('typescript/bin/tsc'), '--noEmit']);
    const testFiles = mode === 'fast'
      ? ['test/barTenderImport.test.ts', 'test/documentPersistence.test.ts', 'test/desktopBackend.test.ts']
      : ['test', 'src/tests'].flatMap(directory => readdirSync(directory)
          .filter(name => (name.endsWith('.test.ts') || name.endsWith('_suite.ts')) && name !== 'complete_data_source_suite.test.ts')
          .map(name => `${directory}/${name}`));
    const serializationSuite = 'test/serialization_production_suite.ts';
    check('node-tests', process.execPath, [tsxCli, '--test', ...testFiles.filter(file => file !== serializationSuite)]);
    if (testFiles.includes(serializationSuite)) check('serialization-production', process.execPath, [tsxCli, '--test', serializationSuite]);
  }
  if (mode === 'regression') {
    const vitestCli = path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs');
    check('data-source-integration', process.execPath, [vitestCli, 'run', 'test/complete_data_source_suite.test.ts', '--reporter=dot']);
    for (const file of ['test_suite_runner.ts', 'scripts/bartender_test_data_runner.ts', 'scripts/excel_test_suite_runner.ts']) {
      check(path.basename(file, '.ts'), process.execPath, [tsxCli, file]);
    }
    inventory();
  }
  if (mode === 'rendering') check('barcode-decoding', process.execPath, [tsxCli, '--test', 'test/barcodeRendering.test.ts']);
  if (!['fast', 'regression', 'rendering'].includes(mode)) throw new Error(`Unknown verification mode: ${mode}`);
  const report = JSON.stringify({ generatedAt: new Date().toISOString(), sourceDigest, platform: process.platform, runtime: process.version, checks }, null, 2);
  writeFileSync(path.join(evidenceDir, `${mode}-results.json`), report);
  writeFileSync(path.join(evidenceDir, `${mode}-${runId}-results.json`), report);
  process.exitCode = checks.some(result => result.status !== 'passed') ? 1 : 0;
}