# Next Class List UX

## 1. Problems found

The existing section lacked a cohesive card and clear hierarchy. It appeared equally low on the page regardless of availability. Closed events therefore made visitors pass the event story before reaching the useful next action. The form and generic confirmation did not feel integrated with the landing page.

## 2. Placement

Open events retain the signup below the event value, proof, and final paid CTA. Sold-out and closed events place it before the event hero. Each state renders exactly one form.

## 3. Open events

A quiet lilac card uses “Can’t make this class?” and “Notify Me About the Next Class.” Paid registration remains the primary conversion. Existing Anton typography, cream surfaces, plum text, rounded corners, and button styling are reused.

## 4. Sold-out and closed events

A plum card with a yellow eyebrow promotes the list as the next action. Sold-out copy starts with “This class is full.” Other closed states use “Catch the next class,” with the applicable registration, cancelled, or completed explanation. Both use “Join the Next Class List.”

## 5. Form

First name and email remain the only contact fields. Labels sit above full-width inputs. Consent remains optional and unchecked. The full-width button shows a loading label and prevents repeated submission while busy. Inline errors use an alert and preserve entered values for retry. Existing native validation, autocomplete, focus styles, and request handling remain in place.

## 6. Success

The form becomes a warm inline confirmation with a yellow check mark and display heading. Copy reflects the submitted consent choice. A clear note explains that joining is not a ticket or seat reservation. The status region supports assistive technology.

## 7. Mobile

Fields stack at every size. The surrounding card switches from one column to two on desktop. Inputs and CTA retain generous touch targets. Browser checks covered 320, 375, 390, 430, and 1440 pixels without horizontal overflow.

## 8. Motion

Existing button interaction styles and `motion-enter` animate error and success feedback. No new animation system or dependency was added. Reduced-motion behavior was verified.

## 9. Files changed for this redesign

- `components/landing-page.tsx`: placement, state-specific card, and copy.
- `components/future-event-lead-form.tsx`: form presentation and confirmation.
- `tests/next-class-list.test.ts`: closed-state copy expectation.
- `scripts/motion-preview/entry.tsx`: closed-state preview fixture.
- `scripts/motion-preview/qa.mjs`: locator accepts both state-specific CTA labels.
- `scripts/motion-preview/next-class-qa.mjs`: focused responsive and interaction checks.
- `NEXT-CLASS-UX.md`: this report.

Other pre-existing working-tree changes were preserved.

## 10. Preserved functionality

No changes were made for this redesign to Convex lead handling, deduplication, sourceContext, lead_context analytics, UTM attribution, admin behavior, current-event registration, Stripe, capacity, or attendee logic. The form uses the same endpoint and payload. No new fields were added.

## 11. Verification

- Typecheck: passed.
- Lint: passed with two existing unused-import warnings (`Link` in the admin event layout and `money` in the registration page); no errors.
- `git diff --check`: passed.
- Production build: passed.
- Tests: 7 Node tests passed; 104 of 105 Vitest tests passed initially. One existing job test exceeded its 5-second timeout under concurrent load. Its file then passed all 3 tests on rerun, including the timed-out test. All 112 distinct tests passed across those runs.
- Browser: 15 responsive state views passed, plus validation, loading, retry, success with and without consent, sourceContext payloads, dark OS preference, reduced motion, and keyboard traversal. No browser runtime errors were observed.
- Duplicate leads: existing backend regression passed. Browser checks exercised the unchanged successful response used for both new and duplicate leads.
- Screenshots reviewed: mobile closed card, desktop open card, and success state. Captures are in `artifacts/next-class-ux/`.

Browser verification used the actual components in the local preview harness with mocked submission responses. It did not create live leads or exercise a deployed production backend. No deployment was performed.
