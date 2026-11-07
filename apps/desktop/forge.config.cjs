const fs = require('node:fs');
const path = require('node:path');
const metadata = JSON.parse(fs.readFileSync(path.join(__dirname, '../../version.json'), 'utf8'));
module.exports = {
  packagerConfig: {
    asar: true,
    executableName: 'Z2M-Automations',
    appVersion: metadata.version,
    buildVersion: String(metadata.build),
    ignore: file => !!file && !/^\/(?:\.build(?:\/|$)|package\.json$|node_modules(?:\/|$))/.test(file.replaceAll('\\', '/'))
  },
  hooks: {readPackageJson: async (_config, pkg) => ({...pkg, version: metadata.version}),
    packageAfterCopy: async (_config, directory) => {
    const file = path.join(directory, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
    pkg.version = metadata.version;
    fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
  }},
  makers: [
    {name: '@electron-forge/maker-squirrel', platforms: ['win32'], config: {name: 'Z2MAutomations', authors: 'Burkhard Kneiseler', description: 'Zigbee2MQTT automation designer', setupExe: 'Z2M-Automations-Setup.exe'}},
    {name: '@electron-forge/maker-deb', platforms: ['linux'], config: {options: {name: 'z2m-automations', bin: 'Z2M-Automations', productName: 'Z2M-Automations', maintainer: 'Burkhard Kneiseler', homepage: 'https://github.com/Burki24/Z2M-Automations', categories: ['Utility']}}}
  ]
};
