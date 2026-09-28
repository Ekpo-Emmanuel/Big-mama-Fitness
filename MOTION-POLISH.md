# Big Mama Fitness motion polish

Presentation-only pass. Existing colors, typography, page structure, registration/payment/auth flows and Convex mutations remain intact. One narrow-screen correction lets the feedback rating fieldset shrink at 320px.

## Audit and decisions

| Opportunity | Before | Treatment | Reason |
| --- | --- | --- | --- |
| Primary/secondary controls, filters and tabs | Mixed generic transitions | 100ms press, 120ms release/color feedback | Confirm touch without delaying actions |
| Validation, checkout and saved results | Abrupt messages; spinner ignored reduced motion | Short message entrance, truthful pending indicator and busy semantics | Explain errors, progress and completion |
| Waiver, admin confirmation and mobile menu | Abrupt native open/close | 200ms entrance, 120ms exit; native focus/Escape retained | Preserve spatial context |
| Marketing hierarchy | Static hero and benefits | One hero entrance and one once-only benefits reveal | Establish hierarchy without animating every section |
| Availability and confirmation | Instant status replacement | Short availability opacity cue; confirmation entrance keyed by actual state | Make meaningful state changes noticeable |
| Check-in and undo, including remote updates | Abrupt card/counter changes | 120ms opacity cue on attendee status and counter changes | Explain incoming state without reordering guests |

Rejected: animated searching/filter reflow (frequent operational task); route-wide entrance/exit delays (slower navigation); animated metrics/count-ups (numbers should be immediately accurate); repeated reading-section reveals, parallax and confetti (no useful feedback).

## Implementation report

1. **Coverage:** audited landing/event, registration, checkout handoff, confirmation, sold-out/lead capture, feedback, login, admin overview, guests/pending, check-in, feedback results, leads and event details.
2. **Tokens:** `--motion-fast:120ms`, `--motion-normal:200ms`, `--motion-slow:280ms`; press 100ms; request spinner 900ms per rotation. Standard easing `(0.77,0,0.175,1)`, enter/exit `(0.23,1,0.32,1)`, emphasis `(0.32,0.72,0,1)`. Distance 6px, press scale .98, dialog/menu scale .97. No stagger delays.
3. **Libraries:** CSS transitions/keyframes, IntersectionObserver and the browser Web Animations API. No new production dependency. `ask-sonner` evaluation favored existing inline live feedback over adding Sonner.
4. **Public pages:** hero copy enters once; benefits reveal once when visible. Server content is never hidden pending JavaScript. FAQ content fades through native disclosure. CTA/capacity labels acknowledge changes; sticky CTA remains fixed and immediately tappable.
5. **Forms:** validation messages enter briefly; focus and validation remain immediate. Inputs/buttons share state/press feedback. Feedback rating/sentiment controls use explicit transitions. Feedback fieldset gets `min-w-0` to prevent 320px overflow.
6. **Checkout/loading:** existing “Opening secure checkout…” and disabled state remain tied to the actual request. Spinner now honors reduced motion. No artificial minimum wait or delayed redirect. Existing admin request skeleton respects reduced motion; reactive updates do not introduce skeletons.
7. **Success:** confirmation entrance is keyed by payment/attendance state; polling the same state does not replay it. Verified paid text remains controlled by existing confirmation rules. Feedback and future-class saves use short, accessible inline completion feedback.
8. **Admin:** shared controls, tabs and filters respond to press; guest/lead disclosures fade. Overview metrics, feedback distributions and event details stay immediately readable.
9. **Realtime:** motion observes `attendee_status`, so local check-in, undo, optimistic rollback and Convex-supplied remote changes use the same presentation cue. Counter updates display their real values immediately. No changes to `admin-check-in.tsx`, subscription/mutation code or API routes.
10. **Overlays:** native dialogs retain focus containment, Escape and trigger focus restoration. Waiver stays mounted for native discrete close transitions; body overflow restores on close/unmount. Admin confirmation copy remains stable during exit. Mobile More menu opens from its bottom navigation anchor. Older browsers without discrete transitions retain instant native close.
11. **Reduced motion:** global CSS disables animations/transitions; JavaScript checks media preference before running and cancels active motion on preference change. Keyboard interaction skips optional motion. Static status text remains available.
12. **Performance:** primarily transform/opacity, with brief color transitions on small controls/cards. No animation frames loop in JavaScript, permanent `will-change`, blur, animated height or heavy package. Observer disconnects after first reveal; animations/listeners clean up. 60fps on physical mobile hardware has not been measured.
13. **Files:** `app/globals.css`, `app/layout.tsx`; `components/motion.tsx`, `ui.tsx`, `admin-ui.tsx`, `admin-guests.tsx`, `admin-leads.tsx`, `admin-navigation.tsx`, `event-sections.tsx`, `event-cta.tsx`, `landing-page.tsx`, `registration-form.tsx`, `registration-confirmation.tsx`, `waiver-dialog.tsx`, `feedback-form.tsx`, `future-event-lead-form.tsx`, `login-form.tsx`; isolated QA in `scripts/motion-preview/`.
14. **Verification:** 7 Node tests + 102 Vitest tests passed. Typecheck and final production build passed. Lint has no errors; two pre-existing unused-import warnings remain in admin event layout and registration page. New motion/QA files pass targeted lint. Browser QA passed all 70 route/viewport combinations at 320, 375, 390, 430 and 1440px, with no overflow or hydration/page errors. Passed: waiver bounds/focus/Escape/acceptance, rapid toggles, keyboard activation, slow checkout failure/retry/redirect, local and simulated remote check-in/undo, pending registrations, search/filters, action failure, mobile navigation, feedback/lead completion, once-only reveal, FAQ, reduced motion, and zero layout-shift contribution from replaying the hero animation after assets loaded. A separate check passed live preference-change cancellation and scroll-lock restoration. `git diff --check` passed. Initial sandbox test execution hit Windows `uv_os_get_passwd / ENOMEM`; the authorized retry outside that sandbox passed.
15. **Intentionally static:** route changes, search/filter insertion/removal, dashboard metrics, long reading content, feedback distributions and event settings. Moving operational rows or delaying navigation would impair frequent tasks. No new drawers or notification system introduced.

## Verification scope

The fixture preview renders actual components with fixture data, then hydrates the matching markup. It blocks external browser requests and stubs API responses. Two tabs simulate incoming attendee props through BroadcastChannel; this verifies presentation behavior, not a live Convex transport or production payment. Native Next production build verifies compilation and route integration. No production data was written.

Reproduce with `node --import tsx scripts/motion-preview/server.mts`, then `node scripts/motion-preview/qa.mjs` and `node scripts/motion-preview/preference-qa.mjs`. Screenshots and results are saved under `artifacts/motion/`. Browser coverage is Chromium/Edge with emulated viewports, not physical iOS/Android hardware or a live multi-organizer Convex deployment.

## Motion review

Review against `review-animations/STANDARDS.md`: explicit purpose/frequency, short easing-controlled feedback, interruptible transitions/WAAPI, reduced-motion handling, gated hover, transform/opacity, immediate keyboard workflow and cleanup. **Approved for this presentation-only scope**, with the browser/device verification limits above.
