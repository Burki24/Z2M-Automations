# ADR 0004: Common draft check and guided desktop transfer

- Date: 2026-11-12
- Status: Implemented for the standalone app; native acceptance pending.

## Decision

Keep checking and transfer separate in workspace steps 7 and 8. The common
**Check draft** action selects its mode in main from the fresh stored document:

- Content, order, sequences or partner grants changed: validate the complete
  candidate with all automations disabled, preserving the existing transfer policy.
- Only rule switches changed: validate the intended enabled flags without
  altering content. Local revision counters do not influence this classification.
- Documents match: report no transfer needed and block unnecessary storage.

The strict `validateEnabled` action remains an internal compatibility entry point;
the app presents one check action. Offline checks remain local and cannot authorize
an upload. A remote check is read-only and does not stop or start operation.

Step 8 consumes the checked candidate. Main confirms the target, replacement
scope, changes, switch policy and automatic stop. The user chooses a private
backup before any control command. Cancellation leaves operation unchanged.
Main rechecks the approved project, endpoint, draft, session, build and baseline,
then stops automation operation if necessary. A fresh stopped intent confirms
the stop even if the saved recovery preference remains true.

Main revalidates the exact candidate and fresh capabilities, sends one store
request with session/revision preconditions, and independently verifies the
stored YAML, checksum, revision, build and stopped state. Operation stays stopped.
The result offers navigation to one-time testing or automatic operation, each
requiring its own explicit action. Configuration transfer never restarts Z2M.

Progress is a bounded projection readable while the mutation queue is occupied.
An unconfirmed stop blocks storage; an unconfirmed store blocks another upload
and manual starts until reconciled. Status checks send no control requests.
Missing replies are resolved through independent evidence, never command replay.

The Operation page also offers direct stored-rule permissions with a confirmed
enabled/total count. A bounded `setRuleFlags` command carries selected stable IDs
and an opaque context bound to project, endpoint, local draft and stored identity.
Main rereads the stored document and applies only the selected switches through
the same validation, explicit confirmation, backup, stop and verified storage
path. Matching drafts are synchronized after success; divergent local content is
preserved. Context changes reject stale selections. This action never starts
operation and cannot bypass unresolved transfer/update guards.

## Scope and evidence

Only desktop orchestration, desktop renderer and DE/EN messages change. Symcon
forms, canonical extension/schema and the pinned runtime artifact remain unchanged.
Tests use the real bundled extension and synthetic MQTT peers to cover automatic
classification, consent and backup ordering, cancellation, stale drafts/sessions,
missing replies, uncertain results and routing among eight systems. The existing
DOM fixture additionally checks the single action, mode feedback and pending
transfer progress in DE/EN without image capture. Windows evidence does not
establish Ubuntu or live-system acceptance for this new transfer workflow.
