# User-guide screenshots

**English | [Deutsch](README_DE.md)**

These are authorized captures of the actual shared desktop renderer and its
confirmation template, using isolated synthetic presentation data. No real
broker, device, private project, credential dialog or desktop was captured.
The two language sets show the same scenarios and are not translations painted
over an image. Device and project names are separately authored sample data;
the application does not translate user-defined names.

The renderer reference is recorded in manifest.json: application version,
shared-designer content identity, capture platform and each image's dimensions.
Windows supplied the capture environment. These are shared application views,
not evidence of native Ubuntu installation/keyring dialogs or live execution.
Native OS differences are described in the handbooks.

The main READMEs use [English](readme-hero-en.png) and
[German](readme-hero-de.png) title artwork. These are AI-generated compositions
based on the approved German design and authorized dark-theme app captures with
synthetic data, using the matching UI language. Their renderer reference is
application 0.121.0. They are promotional artwork, not unmodified screenshots or
evidence of native Ubuntu behavior. The approved German artwork is preserved
unchanged; the English edition localizes its captions and monitor view. Generation
details and file hashes are in [readme-hero-provenance.json](readme-hero-provenance.json).
The user-guide screenshot manifest remains separate.

## Regenerate after permission

Before any future capture, obtain explicit permission for that documentation task
under the global capture rule. The command flag below is an additional guard;
it is not a substitute for the user's permission. State the target (this app),
purpose (user documentation) and scope (synthetic DE/EN views) first.

~~~sh
npm run build
node scripts/capture-user-guide.mjs --approved
~~~

The script uses the existing Electron dependency, a disposable profile and local
compiled assets. Its fixture has no MQTT transport, general file operations or
credential access. It captures app content only and closes it after completion.
It does not run in CI or the normal verification commands.

Check both language sets visually, verify links and matching scenario names,
then run the capture-free local mandatory checks. Keep screenshot changes with
the matching manual and manifest changes. Native installation screenshots must
be made separately on the named OS after their own scoped permission.
