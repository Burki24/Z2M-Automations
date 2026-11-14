# Automatic application versioning

The independent application starts at `0.1.0`. Its canonical metadata lives in
`version.json`; it does not continue the Symcon library's version sequence.

`Desktop verification` calls the reusable `Update application metadata` workflow
before building source pushes or manual runs on `dev`. It uses
`Burki24/Symcon_ModuleCI/application-metadata@main` and the existing
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

## Build order and immutable checkout

1. The `version` prerequisite updates and checks `version.json`, then commits and
   pushes metadata through the existing GitHub App. There is no separate parallel
   metadata push workflow.
2. After the push succeeds, `scripts/ci-build-ref.mjs capture` exposes the exact
   metadata commit SHA and version as reusable-workflow outputs. A superseded
   source produces empty outputs and no package jobs. An already versioned source
   can be rebuilt without incrementing its version again.
3. Both platform jobs require that prerequisite and check out its immutable SHA.
   Each verifies HEAD, version and a clean tracked checkout before building. They
   never resolve a moving branch name after the handoff. A later source push
   cannot give Windows and Ubuntu different source or version metadata.
4. Verification, packaging, source/package/installed smoke, removal checks and
   success-only artifact uploads retain their existing order and failure gates.

Metadata-only `version.json` pushes do not start a second desktop run. Pull
requests and `main` builds continue to use their triggering commit and committed
metadata without invoking the version writer or receiving its App credential.
The workflow run's source SHA remains the triggering source commit; the explicit
`CI_VERSIONED_BUILD` and `CI_VERSIONED_CHECKOUT` events identify the versioned
commit actually used for packaging.

`tests/ci-versioning.test.mjs` checks workflow dependencies and trigger gates,
failure/cancellation/supersession, idempotent reruns, and real temporary Git
checkouts for both platforms after the source branch advances. It also checks
the CLI output contract and rejects mismatched commits, versions and dirty
metadata. These local checks do not establish a successful GitHub run; the new
ordering needs its own CI evidence after the user pushes it.

## Confirmed GitHub operation

On 2026-11-07, consumer run 42367039704 succeeded with
Burki24/Symcon_ModuleCI/application-metadata@main at
f09d5053d439ef5aafcdbf7d9408994ccb294d5f. Bot commit
744fc251503047068bed507a6f84cd4457cf6cb8 updated only version.json to 0.2.0;
the follow-up bot run correctly skipped generation. The user pulled that commit.

D1 builds read version.json when staging the Electron application and the shared
designer package. Forge overrides the application version and updates the copied
package manifest; source package manifests are not version authorities.
The user continues to commit/push; no tag or publication is produced.

The dependency-free metadata/text check remains:

~~~sh
node scripts/check-project.mjs
~~~

It does not replace runtime or platform acceptance.
