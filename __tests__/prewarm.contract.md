# Prewarm contract audit

The initial audit of `92ba84e` reproduced three defect classes. The working-tree fixes bind async SDK outcomes to their execution IDs, use fresh document identities, and retain the WebView and token timer across presentation changes. All former expected failures are ordinary passing regressions.

## Test boundary and independent oracle

`prewarm-model.js` imports no production code. It models request ownership, document generations, token ownership, and deadlines from the public contract:

- Prewarm alone cannot verify; execute queues one request until readiness. Repeated execute while that request is outstanding is idempotent.
- Destroy silently cancels requests and loading/token timers, retires all callbacks/event reset hooks, and removes the native WebView. Repeated destruction and config edits while destroyed cannot recreate it. Execute recreates it with the latest config. Destruction does not revoke an issued token; apps retaining one must track expiry themselves.
- Hide cancels that request. An outcome belonging to a cancelled request is ignored and cannot satisfy or invalidate a newer request. The oracle now rejects cancelled errors entirely, strengthening the original oracle that permitted the error notification while preserving the newer request.
- Replacing a document retires its callbacks permanently, including when config returns to an earlier value. Outstanding verification waits for the replacement document.
- Execution uses the current verification payload. `verifyParams` edits preserve the document; legacy top-level payload edits replace it, preserving v4 behavior.
- The latest unused token expires 120 seconds after receipt, including while hidden. Marking it used suppresses expiry. A prewarm loading deadline cancels queued verification after 15 seconds.

`prewarm-driver.js` mounts actual `ConfirmHcaptcha` and `Hcaptcha`, evaluates every generated inline HTML script, uses the actual published `@hcaptcha/loader`, and executes every WebView injection in a VM. Assertions observe SDK calls/data, bridge-delivered tokens/errors, document identity, and overlay props. They do not read component state/refs or call production payload/serialization helpers as the oracle.

The native WebView transport, DOM script loading, and remote SDK are controlled boundaries. The SDK boundary supplies per-call promises whose outcomes can be delivered after cancellation. Twelve separate transport tests hold an already serialized native message, cancel and re-execute, then deliver that message before the new outcome. Both delayed SDK outcomes and queued native messages are rejected by execution identity. Existing Jest platform/hash stubs remain in use. The model search is a deterministic component/JavaScript integration test; native/live-SDK verification is recorded separately below.

## Finite domain

The exhaustive domain starts with prewarm enabled, theme `light`, payload `legacy-A`, and no request/token. It uses wrapper overlay, wrapper passive, and inline prewarm components. Inline `reset()` is the oracle’s `hide` action and has no visibility obligation. Theme toggles between `light` and `dark`; `verifyParams.rqdata` toggles between `legacy-A` and `override-B`. The static legacy fallback is `legacy-A`.

Twelve actions: `execute`, `hide`, `ready`, `success`, `error`, `edit`, `replace`, `crash`, `timeout`, `consume`, `expire`, `destroy`.

- Success/error delivers the oldest undelivered SDK outcome, including outcomes from cancelled requests and retired documents. This intentionally creates adverse scheduling.
- Ready completes the current loading document. Replace toggles theme; crash invokes a native renderer-loss callback. The two modes exercise both renderer-loss callback entry points.
- Timeout advances to the loading deadline; expire advances to the held token deadline. Separate tests cover each deadline minus one millisecond, exactly at the deadline, and plus one millisecond.
- Ready requires an active loading document; crash requires a mounted document; success/error requires an undelivered SDK outcome; timeout requires a loader deadline; consume/expire requires an unused token. Edits/replacements while destroyed update config without mounting. Old SDK outcomes remain deliverable after destroy to challenge ownership.

Two distinct payload values exercise latest-value delivery and double-edit identity without an unbounded string space. Metamorphic cases separately compare legacy fallback with `verifyParams` overrides. Two theme values permit config A→B→A. Five actions are sufficient for ready→execute→hide→execute→late outcome and ready→execute→replace→replace→late outcome. A four-action search found no failures; the five-action bound exposes both defects. Longer interactions are sampled separately.

## Counts at 6df87c3

Scenario identity is `(wrapper/inline, initial presentation, cold/warm option, show/execute option, payload encoding, executed action trace)`. Prefixes are distinct scenarios. Repeated runs and cross-family overlaps are deduplicated; reduction-only probes are excluded from the primary total.

**73,741 unique primary executed scenarios; zero contract violations.** Raw scenario identities, projections, reduced failures, and family membership are written to `output/prewarm-contract-results.json`.

| Family | Eligible/selected | Exercised | Result |
| --- | ---: | ---: | --- |
| Exhaustive, length 0–5, three component variants | 71,259 | 71,259 | All 71,259 matched |
| Stateful, 64 deterministic seeds × 3 variants, 32 actions | 192 | 192 completed | All 192 matched |
| Completion-order domain, two/three attempts | 1,008 | 1,008 | All matched |
| Metamorphic relation instances | 890 pairs | 890 pairs | All 890 held |
| Deadline/unmount/queued-message/batching/isolation scenarios | 1,180 | 1,180 | All matched |
| Former failure regressions | 10 | 10 | All 10 matched |

Rows overlap and use different units; they must not be summed. Stateful selection is seeds 1–64, with nine lifecycle witness prefixes followed by weighted oracle-eligible exploration using the checked-in LCG. The generator prioritizes readiness/current completions and includes explicitly addressed stale completions. It is not exhaustive coverage of length-32 traces. Every trace must deliver at least one accepted token. Failures retain their wrapper/inline options through deletion reduction.

The raw bounded word space is `3 × (12^0 + … + 12^5) = 814,359`. The declared grammar admits **71,259**, all exercised, and excludes **743,100**. Eligible counts by depth, across all three variants: `3, 24, 174, 1,230, 8,658, 61,170`.

| First ineligible action | Excluded words, including all suffixes |
| --- | ---: |
| ready | 30,552 |
| success | 162,081 |
| error | 162,081 |
| crash | 16,446 |
| timeout | 42,144 |
| consume | 164,898 |
| expire | 164,898 |

This counts each excluded word once, at its first failed precondition. Execute, hide, edit, replace, and destroy have no grammar preconditions. Exclusion does not imply an API call is impossible: duplicate ready notifications and repeated acknowledgements are outside this grammar.

Metamorphic checks add 21 destroy-idempotence relations and 14 destroy/show-alias relations across seven lifecycle prefixes. They also cover show/execute equivalence; execute idempotence; double-edit cancellation; legacy/verifyParams payload equivalence; ready/execute commutation; cold/warm observable equivalence; presentation invariance; renderer-loss/config-replacement equivalence; and changing presentation while holding a token. Legacy-edit transformations add readiness after the required reload and assert the additional document count separately; calls, tokens/errors, and visibility must match. The presentation relation holds in both directions, including the original token-expiry deadline.

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

Run `npm test -- --runInBand --watchman=false`. The v5 run reports **157 ordinary passing Jest tests, 5 suites, 2 snapshots**. Lint passes. Counts above come from the independent-model ledger. Legacy serialization/reloads are preserved; six parameterized cases cover all three legacy fields in both modes. Two additional cases cover reload after a completed token: non-prewarm automatically verifies again, while prewarm waits for an explicit request. Request data that must preserve the warmed document uses `verifyParams`. Pooled-event regressions cover both writable fields and inherited read-only `nativeEvent` getters in both modes; the latter reproduced the React Native 0.88 CI failure before the fix.

The earlier ownership-fix native runs exercised live-SDK signup/login and server-side verification, widget reuse, delayed cancellation/re-execution with distinguishable fixture tokens, and presentation changes while holding a token. Each platform passed 21 distinct checks: 12 functional cases, four delayed live-SDK recovery cases (cancel, renderer loss, prewarm change, presentation change), four transport-failure cases, and one ten-trial latency comparison. Android functional coverage combined the full run with the corrected cancellation rerun. The first cancellation fixture placed its button beneath the visible overlay; the corrected fixture calls the app ref, matching navigation-driven cancellation. No production change was needed for that fixture error. The former legacy-payload no-reload expectation is superseded by the v5 compatibility cases: legacy updates reload, while `verifyParams` updates reuse the document.

After the v5 compatibility and event-copy changes, both platforms passed all **13 functional cases** again: four live-SDK auth cases and nine controlled-SDK WebView cases. The payload cases assert two SDK loads for changing legacy data and one for changing `verifyParams`, with the current payload delivered in both cases. Logs are `output/hcaptcha-v5-{android,ios}-verified.log`. The earlier recovery, network, latency, soak, and long-expiry checks were not rerun for this final compatibility follow-up. Local hosts use React Native 0.80.3 / Harness 1.0.0; the inherited-getter unit regression reproduces the separate React Native 0.88 CI failure. Fresh CI exercises the newer native toolchain.

Five cold and five warm trials measured median token latency of Android 303→73 ms and iOS 453→141 ms. Warm-trial max JS frame gaps were 38 ms and 29 ms; initial prewarm gaps were 109 ms and 44 ms. These are debug-emulator measurements with public auto-pass keys. The historical 30-flow soak and 125-second expiry cases were not rerun in this fix follow-up. Network tests opened real challenges without solving them and completed backend verification with the integration key. Raw latency samples are `output/prewarm-latency-fix-{android,ios}.json`; native logs are `output/hcaptcha-fix-*.log`.

The bounded domain excludes traces longer than five actions, apart from the selected stateful, completion-order, metamorphic, and regression cases. Its string success/error commands still complete oldest-first; addressed completion orders are exhaustive only in the separate two/three-attempt domain below. It also excludes malformed SDK messages, duplicate SDK outcomes/readiness, arbitrary payload/theme/phone/journey combinations, dynamic prewarm toggles, arbitrary simultaneous-instance configurations, arbitrary React batching/concurrent schedules, timer jitter, and arbitrary native process/network/OS scheduling. Presentation toggles, unmount, malformed envelopes, and selected batching schedules have targeted coverage outside the 12-action exhaustive alphabet. Destroy coverage additionally enumerates all 90 command words of length 1–4 over execute/hide/destroy containing destroy, from four lifecycle prefixes and across all three component variants: 1,080 batched scenarios. There are 21 teardown/recreation scenarios, 18 destroy-at-deadline scenarios, three two-instance isolation scenarios, 24 native callbacks delivered inside the destroy/re-execute batch before React commits, and 12 queued native outcome scenarios (hide/destroy × success/error × three variants). The sampled traces do not establish exhaustive coverage of those extensions.

The reproduced request/document/presentation defects are fixed within this domain. The search does not prove correctness outside the selected schedules or establish backend acceptance of enterprise request-specific payloads. Native fixture tests exercise actual WebView transport; live-SDK flows exercise SDK integration. Neither makes the sampled state space exhaustive or establishes physical-device performance/leak freedom.


## Destroy follow-up

`destroy.test.js` adds ten component regressions outside the model ledger: wrapper/inline × default/prewarm journey/back-handler and retained-script-error-hook checks, delayed SMS-link rejection checks, and one/three default-mode hide cycles followed by destruction. The last two cover token timers that intentionally outlive ordinary default-mode unmounts; explicit destroy cancels all timers owned by the wrapper, including those retired views. Ordinary hide/unmount behavior remains unchanged. Retained token `markUsed()` callbacks cannot cancel a newly created token’s timer.

Native runs exercise actual WebViews and the published loader on Android API 33 and iOS 26, using the existing React Native 0.84.1 / Harness 1.0.0 host. Per platform: 12 destroy fixture cases (three component variants × blocked SDK loading / ready / pending / held-token states), two live-SDK signup/login cases that destroy immediately after receiving each token and verify it on the backend afterward, plus 13 existing functional cases. Each non-loading destroy fixture case recreates the WebView twice; repeated destroy is silent and stale results cannot reach the new attempt. SDK-load counts independently confirm recreation. Logs: `output/hcaptcha-destroy-final-{android,ios}.log`.

These tests establish native teardown/recreation and functional recovery, not immediate process RSS reduction or physical-device leak freedom. WebKit/Android may retain process caches after view destruction. Public auto-pass integration keys cover backend verification; interactive puzzles and enterprise payload acceptance are not established by these fixtures. Exhaustiveness applies only to the declared finite grammar and batched-command domain.


## Stateful coverage gates and completion ordering at 6df87c3

The previous uniform generator accepted zero tokens in its 128 long traces and never invoked consume/expire. It also omitted inline long traces and could complete only the oldest SDK attempt. The updated model and driver accept `{ type: 'success' | 'error', attempt: index }` commands independently; the driver settles that specific real generated-runtime promise. `{ type: 'advance', ms: 120000 }` checks expiry suppression after consumption. Production code is unchanged in this follow-up.

All three component variants now execute 64 distinct 32-command traces. Per variant, these deliver **324 accepted tokens**, execute **152 consume** and **110 expire** commands, and observe **21 abstract states, 150 distinct transitions, and 500 distinct adjacent transition pairs**. Across variants: 192 traces, 972 accepted tokens, 456 consumes, and 330 expire commands. Counts for transitions/pairs describe the same oracle abstraction across variants and must not be summed as distinct behaviors.

Coverage is recorded only after the actual component/HTML/loader observations match the independent oracle. Each variant must cover all 21 declared abstract states: loading/ready × idle/pending request × absent/held/consumed/expired token (16), timed-out × idle request × four token states (4), and destroyed with no request/token (1). Timeout cancels requests; destruction clears local token ownership. Document/request IDs, payload, visibility, and timestamps remain separate model variables and are not collapsed into these labels for behavioral assertions.

The tests additionally require 15 state-conditioned adjacent transition pairs, including ready→execute, ready→current success/error, success→consume/expire, consume→clock advance with no expiry, expiry→execute, hide→execute, pending/held-token destroy→execute, timeout→execute, renderer/config replacement→ready, and current success→stale success/error. State labels and both transition actions form each pair's identity. Missing states/pairs or any seed without an accepted token fail the suite; raw per-variant counts and missing lists are in the JSON ledger.

The completion-order domain constructs two or three outstanding SDK attempts across hide, destroy, config replacement, or renderer loss. For each component variant and interruption, it enumerates every attempt permutation (2! or 3!) and all success/error assignments (2^2 or 2^3). If the current attempt succeeds, both consume+120-second advance and expiry tails run; if it fails, a 120-second advance verifies no stale token/expiry arrives. This declares **1,008 eligible scenarios, all exercised, zero exclusions within that domain**. Each is compared step-by-step with the oracle. The 792 non-baseline permutations additionally satisfy outcome-order metamorphic equivalence, giving 890 total relation instances including existing cases.

This includes newer token delivery before an older success/error, both after same-document cancellation and after document retirement. Four or more attempts, mixed interruption kinds within the permutation setup, duplicate promise settlements, arbitrary delay values, and arbitrary native/React scheduling are outside this completion-order enumeration. Longer sampled traces can contain more attempts and mixed interruptions, but do not exhaust their permutations. No new contract violations were found.


## Review fixes: initialization and retry lifecycle

**84,220 unique primary scenarios; zero contract violations. All 248 unit/model tests, two snapshots, and lint pass.** The 1,228 boundary scenarios and 93 review-regression executions overlap the searches and each other; primary scenario identities are deduplicated in the JSON ledger.

The review exposed missing pre-ready failure and event-reset transitions. The oracle now distinguishes loading, failed, ready, timed-out, and destroyed phases, and retains event-hook lifetime separately from document identity. Initialization errors cancel queued prewarm requests. Idle failures are silent and retried on execute; active failures report an error with a retry hook. An ordinary event reset starts a fresh request and restores wrapper visibility unless passive. Retained reset hooks cannot cross destroy. Render-failure retries can become ready immediately because the SDK is already loaded; loader/script retries wait for readiness. The oracle models that distinction without importing production code.

Production fixes use typed initialization and async-result envelopes, preventing long errors or rejected Error objects from becoming tokens. Informational pre-ready messages do not cancel loading deadlines. Native reloads retire callbacks synchronously and recreate the WebView. Reset hooks read the latest payload after replacement; verifyParams preserves the document and legacy props still reload. The root-placement documentation continues to apply; swapping View and Modal would discard the warmed WebView.

The original core domain remains 12 commands through depth five: 814,359 raw words, 71,259 eligible/exercised, 743,100 excluded by declared preconditions across three variants. A separate lifecycle domain uses 13 commands through depth four: execute, hide, ready, success, eventReset, initError, renderError, scriptError, timeout, reload, info, duplicateReady, destroy. Its **92,823 raw words admit 11,529 eligible scenarios, all exercised, and exclude 81,294**. Per variant, eligible counts by depth are `1, 10, 68, 467, 3,297`. Domains overlap; their scenario counts must not be added as unique scenarios.

The lifecycle grammar admits initialization failures/informational messages only while loading, duplicate readiness only while ready, reset only after an event hook exists, and reload only while mounted. A render failure cannot spontaneously produce readiness before retry; the other load failures may be followed by late readiness. SDK completions require an outstanding attempt. Invalid commands are excluded by those preconditions, not by expected-failure filters.

Per variant, the current long traces accept 273 tokens, execute 107 consume and 103 expire commands, and observe 246 distinct transitions and 792 adjacent transition pairs. Across all variants, that is 819 accepted tokens, 321 consumes, and 309 expire commands. Every seed accepts a token; no required states or pairs are missing.

The 192 long traces include the seven new commands in weighted exploration and six additional lifecycle witness prefixes. Gates require **25 abstract states** (the previous 21 plus failed/idle × four token states) and **21 state-conditioned adjacent transition pairs** per component variant. Every seed must still accept a token. The 1,008 two/three-attempt completion-order scenarios remain in place. Nine new metamorphic pairs verify current payloads through retained failure/reset hooks, with the expected extra reload for legacy props: 899 relation instances total.

There are 93 review-regression executions across the three variants. Minimal witnesses include idle initialization failure; execute→long initialization error; execute→initialization error→execute→ready; ready→execute→token→hide→eventReset; and info→timeout→execute. Longer cases cover expired-event retry, retry cancellation ownership, stale hooks after destroy, late readiness after errors, native reload, duplicate readiness, reserved strings as typed errors, and rejected Error objects. Boundary tests now deliver 60 retired callbacks inside destroy/reload batches before React commits and exercise 12 malformed initialization envelopes, alongside existing deadline and instance-isolation tests.

Native validation adds six cases per platform: three variants × idle render failure/active failure/event-reset recovery and held-token reset after hiding. The overlay case verifies real native touch interception after retry by pressing the underlying form button; passive/inline cases verify hidden repeated execution. Together with the existing auth/lifecycle cases, **33 checks per platform** exercise actual native WebViews and live SDK/backend verification. The controlled fixture's first render failure is silent; its second failure during execute is reported and its reset recovers without reloading the SDK. Logs are `output/hcaptcha-review-ios.log` and `output/hcaptcha-review-final-android.log`.

The model still excludes arbitrary React/OS scheduling, full SDK/DOM behavior, unbounded payloads, arbitrary malformed packets, and all permutations of four or more attempts. The bounded lifecycle domain omits payload/presentation changes and token consumption/expiry; those are exercised by the core search, long traces, dedicated regressions, and metamorphic cases. Native process caches and physical-device leak/performance guarantees remain outside these checks.

The exhaustive domains are prewarm-only; default-mode compatibility has dedicated component/native checks. Arbitrary custom SDK callback payloads in default mode retain their legacy interpretation.
