# Automatic application versioning

The independent application starts at `0.1.0`. Its canonical metadata lives in
`version.json`; it does not continue the Symcon library's version sequence.

The `Update application metadata` workflow runs after source pushes to `dev`.
It uses `Burki24/Symcon_ModuleCI/application-metadata@main` and the existing
`HELPER_SYNC_APP_CLIENT_ID` variable and `HELPER_SYNC_APP_PRIVATE_KEY` secret.
The GitHub App must have Contents write permission for this repository. Do not
copy the key into configuration, logs or source files.

- Each source commit in a push increments the minor component, for example
  `0.1.0` to `0.2.0`; the patch component resets to zero. A higher manually
  selected version is never lowered.
- Build is the integer represented by the first seven hexadecimal source-SHA
  characters. Date is that source commit's Unix timestamp.
- The initial build/date values are zero until the first successful workflow.
- Bot commits begin with `CHORE: Update application metadata`. They do not count
  as source changes and do not trigger another version update.
- Retries are idempotent, and superseded source pushes cannot overwrite newer work.
- Project checks run before generation and again after changed metadata. The
  bot commits only `version.json`; it creates no tag, release or published package.

The central action shares the existing tested library-policy implementation in
ModuleCI, using an explicit application target with three-component versions.
The library mode and its two-component versions remain unchanged.

Before the first consumer push, the new central action must be approved and
available on `Symcon_ModuleCI/main`. Commit/push and that approval remain with
the user. Afterwards, pull the generated metadata commit through GitHub Desktop.
An actual GitHub run remains to be checked after those steps.

Current local check, requiring Node 22 or later and no npm dependencies:

```sh
node scripts/check-project.mjs
```

This checks metadata, UTF-8, line endings and own project text. It does not
establish application functionality or platform acceptance.
