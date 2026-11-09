const MakerNsis = require('electron-forge-maker-nsis');
const metadata = require('../../version.json');

// Forge supplies the already verified executable; only wrap it in an installer.
class WindowsMaker extends MakerNsis {
  getBuildOptions(options) {
    const build = super.getBuildOptions(options);
    build.config = {...build.config,
      appId: 'de.kneiseler.z2m-automations',
      productName: 'Z2M-Automations',
      extraMetadata: {version: metadata.version},
      buildVersion: String(metadata.build),
      win: {signAndEditExecutable: false},
      publish: null,
      directories: {...build.config.directories, buildResources: __dirname}
    };
    return build;
  }
}
module.exports = WindowsMaker;
