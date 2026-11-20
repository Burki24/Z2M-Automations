import {createHash} from 'node:crypto';
import {spawnSync, execFileSync} from 'node:child_process';
import {copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const build = join(root, 'apps/desktop/.build');
const destination = join(root, 'artifacts');
const packageRoot = join(build, 'workspace-package');
const fromJson = path => JSON.parse(readFileSync(path, 'utf8'));
const git = (...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim();
const designer = fromJson(join(build, 'designer-package.json'));
const dependencies = fromJson(join(root, 'apps/desktop/package.json')).dependencies;
const backend = [
  'auto-connect.js', 'contracts.js', 'credentials.js', 'diagnostics.js', 'draft-editor.js', 'draft-exchange.js',
  'draft-feedback.js', 'draft-merge.cjs', 'draft-merge.js', 'draft-validation.js', 'extension-transfer.js',
  'extension-update.js', 'help.js', 'mqtt-protocol.js', 'mqtt-reader.js', 'offline-workspace.js',
  'partner-overview.js', 'project-files.js', 'project-service.js', 'project.js', 'runtime-control.js',
  'runtime-state.js', 'security.js', 'system-link.js', 'workspace-application.js',
  'schema/automations.schema.json', 'schema/provenance.json', 'extension/z2m-automations.mjs', 'extension/provenance.json',
];
const renderer = readdirSync(join(build, 'renderer'), {recursive: true, withFileTypes: true})
  .filter(entry => entry.isFile()).map(entry => join(entry.parentPath, entry.name).slice(join(build, 'renderer').length + 1).replaceAll('\\', '/'))
  .filter(name => (name === 'index.html' || !Object.hasOwn(designer.assets, name)) && !/^confirmation\./.test(name))
  .map(name => 'renderer/' + name);
const files = ['LICENSE', ...backend, ...renderer].sort();
const hashes = {};
for (const name of files) {
  const target = join(packageRoot, name);
  mkdirSync(dirname(target), {recursive: true});
  const source = join(build, name);
  copyFileSync(source, target);
  hashes[name] = createHash('sha256').update(readFileSync(source)).digest('hex');
}
const name = '@z2ma/workspace-runtime';
const scopes = ['apps/desktop/src', 'apps/desktop/renderer', 'apps/desktop/help', 'apps/desktop/schema', 'apps/desktop/extension',
  'apps/desktop/package.json', 'docs/USER_GUIDE.md', 'docs/USER_GUIDE_DE.md', 'docs/images', 'packages/designer/src', 'scripts/build.mjs', 'scripts/build-help.mjs'];
const manifest = {
  format: 1, name, version: designer.version, designerContent: designer.content,
  source: {repository: designer.source, baseCommit: git('rev-parse', 'HEAD'), workingTree: Boolean(git('status', '--porcelain', '--', ...scopes))},
  files: hashes,
};
const write = (file, value) => writeFileSync(join(packageRoot, file), JSON.stringify(value, null, 2) + '\n');
write('manifest.json', manifest);
write('package.json', {name, version: designer.version, license: designer.license, private: true, type: 'commonjs',
  main: 'workspace-application.js', dependencies, files: [...files, 'manifest.json']});
mkdirSync(destination, {recursive: true});
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run through npm run pack:workspace.');
const result = spawnSync(process.execPath, [npm, 'pack', '--ignore-scripts', '--pack-destination', destination, '--loglevel=error'],
  {cwd: packageRoot, stdio: 'inherit'});
process.exitCode = result.status ?? 1;
