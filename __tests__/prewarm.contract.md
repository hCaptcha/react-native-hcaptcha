# Prewarm contract audit

The initial audit of `92ba84e` reproduced three defect classes. The working-tree fixes bind async SDK outcomes to their execution IDs, use fresh document identities, and retain the WebView and token timer across presentation changes. All former expected failures are ordinary passing regressions.

## Test boundary and independent oracle

`prewarm-model.js` imports no production code. It models request ownership, document generations, token ownership, and deadlines from the public contract:

- Prewarm alone cannot verify; execute queues one request until readiness. Repeated execute while that request is outstanding is idempotent.
- Hide cancels that request. An outcome belonging to a cancelled request is ignored and cannot satisfy or invalidate a newer request. The oracle now rejects cancelled errors entirely, strengthening the original oracle that permitted the error notification while preserving the newer request.
- Replacing a document retires its callbacks permanently, including when config returns to an earlier value. Outstanding verification waits for the replacement document.
- Execution uses the current verification payload. Payload edits preserve the document.
- The latest unused token expires 120 seconds after receipt, including while hidden. Marking it used suppresses expiry. A prewarm loading deadline cancels queued verification after 15 seconds.

`prewarm-driver.js` mounts actual `ConfirmHcaptcha` and `Hcaptcha`, evaluates every generated inline HTML script, uses the actual published `@hcaptcha/loader`, and executes every WebView injection in a VM. Assertions observe SDK calls/data, bridge-delivered tokens/errors, document identity, and overlay props. They do not read component state/refs or call production payload/serialization helpers as the oracle.

The native WebView transport, DOM script loading, and remote SDK are controlled boundaries. The SDK boundary supplies per-call promises whose outcomes can be delivered after cancellation. Four separate transport tests hold an already serialized native message, cancel and re-execute, then deliver that message before the new outcome. Both delayed SDK outcomes and queued native messages are rejected by execution identity. Existing Jest platform/hash stubs remain in use. The model search is a deterministic component/JavaScript integration test; native/live-SDK verification is recorded separately below.

## Finite domain

The exhaustive domain starts with prewarm enabled, theme `light`, payload `legacy-A`, and no request/token. It uses both presentation modes. Theme toggles between `light` and `dark`; payload toggles between a legacy value and an overriding `verifyParams` value, `override-B`.

Eleven actions: `execute`, `hide`, `ready`, `success`, `error`, `edit`, `replace`, `crash`, `timeout`, `consume`, `expire`.

- Success/error delivers the oldest undelivered SDK outcome, including outcomes from cancelled requests and retired documents. This intentionally creates adverse scheduling.
- Ready completes the current loading document. Replace toggles theme; crash invokes a native renderer-loss callback. The two modes exercise both renderer-loss callback entry points.
- Timeout advances to the loading deadline; expire advances to the held token deadline. Separate tests cover each deadline minus one millisecond, exactly at the deadline, and plus one millisecond.
- Ready requires a loading document; success/error requires an undelivered SDK outcome; timeout requires a loader deadline; consume/expire requires an unused token.

Two distinct payload values exercise fallback/override, latest-value delivery, and double-edit identity without an unbounded string space. Two theme values permit config A→B→A. Five actions are sufficient for ready→execute→hide→execute→late outcome and ready→execute→replace→replace→late outcome. A four-action search found no failures; the five-action bound exposes both defects. Longer interactions are sampled separately.

## Counts

Scenario identity is `(initial presentation, cold/warm option, show/execute option, payload encoding, executed action trace)`. Prefixes are distinct scenarios. Repeated runs and cross-family overlaps are deduplicated; reduction-only probes are excluded from the primary total.

**31,268 unique primary executed scenarios; zero contract violations.** Raw scenario identities, projections, reduced failures, and family membership are written to `output/prewarm-contract-results.json`.

| Family | Eligible/selected | Exercised | Result |
| --- | ---: | ---: | --- |
| Exhaustive, length 0–5 | 31,056 | 31,056 | All 31,056 matched |
| Stateful, 64 deterministic seeds × 2 modes, up to 32 actions | 128 | 128 completed | All 128 matched |
| Metamorphic relation instances | 63 pairs | 63 pairs | All 63 held |
| Deadline/unmount/queued-message/batching scenarios | 26 | 26 | All matched |
| Former failure regressions | 10 | 10 | All 10 matched |

Rows overlap and use different units; they must not be summed. Stateful selection is seeds 1–64 using the checked-in LCG and only oracle-eligible commands. It is not exhaustive coverage of length-32 traces. The complete 32-action stateful traces now pass; future failures are recorded at their first divergence and deletion-reduced.

The raw bounded word space is `2 × (11^0 + … + 11^5) = 354,312`. The declared grammar admits 31,056 and excludes **323,256**. Eligible counts by depth, across both modes: `2, 14, 92, 602, 3,966, 26,380`.

| First ineligible action | Excluded words, including all suffixes |
| --- | ---: |
| ready | 7,924 |
| success | 74,480 |
| error | 74,480 |
| timeout | 14,324 |
| consume | 76,024 |
| expire | 76,024 |

This counts each excluded word once, at its first failed precondition. Execute, hide, edit, replace, and crash have no grammar preconditions. Exclusion does not imply an API call is impossible: duplicate ready notifications and repeated acknowledgements are outside this grammar.

Metamorphic checks cover show/execute equivalence; execute idempotence; double-edit cancellation; legacy/verifyParams payload equivalence; ready/execute commutation; cold/warm observable equivalence; presentation invariance; renderer-loss/config-replacement equivalence; and changing presentation while holding a token. The final relation now holds in both directions, including the original token-expiry deadline.

## Reduced regressions

Both initial presentation modes cover every row below. Success/error refers to the oldest outstanding SDK outcome. Initial failures were reduced with contiguous-block and single-action deletion. The initial exhaustive result established five-action counterexamples for request/document ownership; all now pass.

| Defect | Reduced trace | Current passing outcome |
| --- | --- | --- |
| Cancelled request outcome accepted by a newer request | ready, execute A, hide, execute B, success A | Token A ignored |
| Cancelled request error invalidates a newer request | ready, execute A, hide, execute B, error A, success B | Error A ignored; token B delivered |
| Config A→B→A revives retired document callbacks | ready, execute, replace, replace, success | Old token ignored |
| Same document defect, error outcome | ready, execute, replace, replace, error | Old error ignored |
| Presentation change initiates unsolicited verification | ready, execute, success, toggle presentation, ready | One verification; original token expiry preserved |

The cancellation fix uses the SDK's [async execution API](https://docs.hcaptcha.com/configuration#asynchronous-mode-get-a-promise), captures an ID per invocation, and filters its token/error messages before any state/timer changes. Callback delivery remains the default non-prewarm path. The document guard compares a fresh object identity rather than reusing a serialized config key. The wrapper tracks pending verification independently of visibility and keeps the same prewarm subtree across presentation modes.

All ten regressions use ordinary `test.each`; there are no expected-failure annotations or search exemptions. Any model divergence fails the search. Four additional queue tests cover a native token/error emitted before cancellation but delivered after re-execution. Two more cases cover hide/re-execute in one React batch. Focused unit cases also reject malformed/stale request envelopes and reset the document when inline prewarm mode changes.

## Validation and remaining risks

Run `npm test -- --runInBand --watchman=false`. The complete run reports **150 ordinary passing Jest tests, 5 suites, 2 snapshots**. Lint passes. Counts above come from the independent-model ledger.

Native follow-up runs exercise live-SDK signup/login and server-side verification, widget reuse, delayed cancellation/re-execution with distinguishable fixture tokens, and presentation changes while holding a token. Each platform passed 21 distinct native checks: 12 functional cases, four delayed live-SDK recovery cases (cancel, renderer loss, prewarm change, presentation change), four transport-failure cases, and one ten-trial latency comparison. Android functional coverage combines the full run with the corrected cancellation rerun. The first cancellation fixture placed its button beneath the visible overlay; the corrected fixture calls the app ref, matching navigation-driven cancellation. No production change was needed for that fixture error.

Five cold and five warm trials measured median token latency of Android 303→73 ms and iOS 453→141 ms. Warm-trial max JS frame gaps were 38 ms and 29 ms; initial prewarm gaps were 109 ms and 44 ms. These are debug-emulator measurements with public auto-pass keys. The historical 30-flow soak and 125-second expiry cases were not rerun in this fix follow-up. Network tests opened real challenges without solving them and completed backend verification with the integration key. Raw latency samples are `output/prewarm-latency-fix-{android,ios}.json`; native logs are `output/hcaptcha-fix-*.log`.

The bounded domain excludes traces longer than five actions, apart from the selected stateful traces and metamorphic/regression cases. It also excludes malformed SDK messages, duplicate SDK outcomes/readiness, arbitrary payload/theme/phone/journey combinations, dynamic prewarm toggles, multiple simultaneous captcha instances, React batching/concurrent schedules, timer jitter, and native process/network/OS scheduling. Presentation toggles, unmount, malformed envelopes, and the selected batched hide/re-execute schedule have targeted coverage outside the 11-action exhaustive alphabet. The sampled traces do not establish exhaustive coverage of those extensions.

The reproduced request/document/presentation defects are fixed within this domain. The search does not prove correctness outside the selected schedules or establish backend acceptance of enterprise request-specific payloads. Native fixture tests exercise actual WebView transport; live-SDK flows exercise SDK integration. Neither makes the sampled state space exhaustive or establishes physical-device performance/leak freedom.
