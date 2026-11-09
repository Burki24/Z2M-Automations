const fs = require('node:fs');
const path = require('node:path');

/** Stage the installed, lockfile-selected production closure of this workspace. */
function stageRuntimeDependencies(directory) {
  const destination = path.resolve(directory, 'node_modules');
  if (path.dirname(destination) !== path.resolve(directory) || path.resolve(directory) === path.resolve(__dirname)) throw new Error('Invalid package staging directory.');
  const modules = fs.realpathSync(path.join(__dirname, '../../node_modules'));
  const packages = new Set();
  function locate(name, from) {
    if (!/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name) || ['.', '..'].includes(name)) throw new Error('Invalid runtime dependency name.');
    let current = from;
    while (true) {
      const candidate = path.join(current, 'node_modules', name, 'package.json');
      if (fs.existsSync(candidate)) return fs.realpathSync(path.dirname(candidate));
      const parent = path.dirname(current);
      if (parent === current) throw new Error('Missing installed runtime dependency: ' + name);
      current = parent;
    }
  }
  function collect(manifestPath) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    for (const name of Object.keys(manifest.dependencies ?? {})) {
      const source = locate(name, path.dirname(manifestPath));
      const relative = path.relative(modules, source);
      if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Runtime dependency is outside the locked node_modules tree.');
      if (packages.has(source)) continue;
      packages.add(source); collect(path.join(source, 'package.json'));
    }
  }
  collect(path.join(__dirname, 'package.json'));
  // This exact generated child has been checked against the provided package stage.
  fs.rmSync(destination, {recursive: true, force: true});
  for (const source of packages) {
    const target = path.join(destination, path.relative(modules, source));
    fs.cpSync(source, target, {recursive: true, filter: file => file === source || path.basename(file) !== 'node_modules'});
  }
  return packages.size;
}
module.exports = {stageRuntimeDependencies};
