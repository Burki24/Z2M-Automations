const fs = require('node:fs');
const path = require('node:path');
const {stageRuntimeDependencies} = require('./runtime-dependencies.cjs');
const WindowsMaker = require('./windows-maker.cjs');
const metadata = JSON.parse(fs.readFileSync(path.join(__dirname, '../../version.json'), 'utf8'));
const windowsIcon = path.join(__dirname, 'app.ico');
module.exports = {
  packagerConfig: {
    asar: true,
    ...(process.platform === 'win32' ? {icon: windowsIcon} : {}),
    prune: false,
    executableName: 'Z2M-Automations',
    appVersion: metadata.version,
    buildVersion: String(metadata.build),
    download: {cacheRoot: process.env.electron_config_cache, checksums: require('electron/checksums.json')},
    ignore: file => !!file && !/^\/(?:\.build(?:\/|$)|package\.json$|node_modules(?:\/|$))/.test(file.replaceAll('\\', '/'))
  },
  hooks: {readPackageJson: async (_config, pkg) => ({...pkg, version: metadata.version}),
    packageAfterCopy: async (_config, directory) => {
    const file = path.join(directory, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
    pkg.version = metadata.version;
    fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
    stageRuntimeDependencies(directory);
  }},
  makers: [
    new WindowsMaker({oneClick: false, perMachine: false, allowElevation: true,
      installerIcon: windowsIcon, uninstallerIcon: windowsIcon,
      include: path.join(__dirname, 'installer.nsh'),
      allowToChangeInstallationDirectory: true, installerLanguages: ['de_DE', 'en_US'],
      displayLanguageSelector: true, runAfterFinish: true, deleteAppDataOnUninstall: false,
      createStartMenuShortcut: true, shortcutName: 'Z2M-Automations', menuCategory: false,
      artifactName: 'Z2M-Automations-${version}-Windows-x64-Setup.${ext}'}, ['win32']),
    {name: '@electron-forge/maker-deb', platforms: ['linux'], config: {options: {name: 'z2m-automations', icon: path.join(__dirname, 'renderer', 'app-icon.png'), bin: 'Z2M-Automations', productName: 'Z2M-Automations', maintainer: 'Burkhard Kneiseler', homepage: 'https://github.com/Burki24/Z2M-Automations', categories: ['Utility']}}}
  ]
};
