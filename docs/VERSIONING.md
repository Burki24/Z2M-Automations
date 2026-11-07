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

## Current verification and activation order

On 2026-11-07, the shared library/application regression checks and a read-only
application calculation against this repository passed. The application starts
at `0.1.0`; a first ordinary source increment proposes `0.2.0`. The calculation
does not modify metadata or create a commit.

The action exists on ModuleCI's development branch but is not yet present on
the checked `main` revision `4ec6a01246ff112c3cc6492dbcbb306fd1557e6f`.
This prevents the consumer workflow from resolving its configured action;
it is a release-order prerequisite, not a reason to change the reference to `dev`.

1. Review and merge the application metadata action and its shared script from
   `Symcon_ModuleCI/dev` into `main` through the normal repository workflow.
2. Commit/push this application's changes from GitHub Desktop. If a previous
   metadata run failed because the action was unavailable, rerun that run after
   the central merge instead of editing the action reference.
3. Check the successful Actions run and its metadata-only bot commit, then pull
   that commit. Only this final check establishes operation on GitHub.


Current local check, requiring Node 22 or later and no npm dependencies:

```sh
node scripts/check-project.mjs
```

This checks metadata, UTF-8, line endings and own project text. It does not
establish application functionality or platform acceptance.
