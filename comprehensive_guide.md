You are building the MVP for a small Afro Dance Fitness event registration platform.

This is NOT a generic website project.

The business goal is:
1. Sell up to 20 paid tickets for a live Afro Dance Fitness class.
2. Make registration and payment extremely easy.
3. Capture future-event leads after the event sells out.
4. Give the organizer a simple admin experience for attendee management.
5. Add proper analytics and attribution from day one.
6. Build this in a reusable way so future events can be launched without rebuilding the app.

IMPORTANT:
The public landing page UI/UX will be designed separately by ChatGPT Astra.
Do NOT redesign the landing page creatively yourself.
Your responsibility is to build the architecture, functionality, data flow, integrations, states, and a clean implementation that Astra can style/design on top of.

You may create a functional baseline layout, but keep it structurally simple and componentized.
Do not over-design.
Do not lock the application into a specific visual aesthetic.

==================================================
PROJECT CONTEXT
==================================================

Organizer:
Brenda

Working event name:
Afro Dance Fitness Nanaimo

The final brand/event name may change later, so do NOT hard-code branding deeply into components.

Event:
Saturday, October 17, 2026

Event window:
5:00 PM - 6:30 PM

Actual workout:
Approximately 60 minutes

Suggested schedule:
5:00-5:15 PM - arrival/check-in
5:15-6:15 PM - workout
6:15-6:30 PM - cooldown/social/final wrap-up

Location:
1969 Boxwood Rd
Nanaimo, BC
V9S 5X9
Canada

Ticket price:
CAD $10

Audience:
Open to everyone

Skill level:
Beginner friendly

No dance experience required.

Minimum attendance target:
15

IMPORTANT:
This is only an internal target.
The event still runs even if fewer than 15 people register.

Maximum paid tickets:
20

Hard capacity:
20 successful paid tickets.

Once 20 tickets have been sold:
- Ticket registration closes.
- Checkout becomes unavailable.
- The landing page switches into a sold-out state.
- Visitors can submit their contact information to hear about future events.

This future-event list is NOT a cancellation waitlist.

If someone cancels:
- Their ticket status can become cancelled.
- Their seat is NOT automatically released.
- Registration does NOT automatically reopen.
- People on the future-event list do NOT automatically replace cancellations.

Example:
20 tickets sold.
2 later cancel.
Event stays sold out unless the organizer manually decides otherwise.

==================================================
CORE USER FLOW
==================================================

Primary funnel:

Traffic source
→ Landing page
→ Reserve My Spot
→ Registration form
→ Stripe checkout
→ Successful payment
→ Confirmed attendee
→ Confirmation email
→ Reminder emails
→ Event check-in
→ Post-event follow-up

Sold-out funnel:

Traffic source
→ Landing page
→ Event sold out
→ Future event interest form
→ Contact stored for future marketing

==================================================
PUBLIC LANDING PAGE REQUIREMENTS
==================================================

NOTE:
ChatGPT Astra will handle the actual visual redesign and final UX.

Your job:
- Build clean semantic structure.
- Build reusable components.
- Build all dynamic data and states.
- Make the landing page easy for Astra to redesign.
- Use mobile-first implementation.
- Avoid rigid hard-coded CSS structures that are difficult to restyle.

The landing page has ONE primary conversion goal:

Visitor → $10 paid attendee.

Primary CTA copy:
"Reserve My Spot — $10"

When sold out:
"Join the Next Class List"
or
"Notify Me About the Next Class"

Do NOT create a traditional website navigation experience.

Avoid:
- complex navigation
- unrelated pages
- multiple competing CTAs
- unnecessary links
- distracting interactions
- over-engineered page transitions
- decorative UI that interferes with conversion

The landing page should support these content sections:

1. Hero
2. Core experience/benefits
3. Beginner reassurance / objection handling
4. Experience imagery/video section
5. Event schedule
6. Instructor section
7. Ticket offer
8. Capacity/scarcity section
9. Social proof section if real proof becomes available
10. FAQ
11. Final CTA

These sections should be implemented as reusable components.

The copy/content should be editable from event data/config where reasonable.

==================================================
LANDING PAGE CONVERSION PRINCIPLES
==================================================

These requirements come from the landing-page research we reviewed.

The most important area is above the fold.

The hero should communicate within seconds:
- emotional benefit
- what the event is
- where it is
- when it is
- price
- beginner friendliness
- availability
- one clear CTA

The headline should be benefit-driven, not just descriptive.

Example direction:
"Your Saturday Workout Should Feel Like a Party."

Subheadline direction:
"Move to Afrobeats, sweat, laugh and leave feeling amazing in a beginner-friendly Afro Dance Fitness experience in Nanaimo."

Do not hard-code this exact copy if content/config architecture makes it easy to edit.

The hero should support:
- headline
- subheadline
- event details
- CTA
- reassurance items
- hero image or video

Reassurance examples:
- No dance experience needed
- Beginner friendly
- Open to everyone
- One-time $10 ticket
- No membership

The page must be:
- mobile-first
- easy to scan
- structured with clear headings
- visually hierarchical
- conversion focused
- simple rather than overly experimental

Assume many visitors arrive from QR codes on their phones.

Add support for a mobile sticky CTA.

==================================================
EVENT MODEL
==================================================

Do not hard-code this app only for October 17.

Build an Event entity/model.

Recommended fields:

Event
- id
- slug
- name
- shortName
- headline
- subheadline
- description
- date
- startTime
- endTime
- workoutStartTime
- workoutEndTime
- timezone
- venueName
- addressLine1
- city
- province
- postalCode
- country
- priceCents
- currency
- capacity
- targetAttendance
- status
- heroImageUrl
- heroVideoUrl
- instructorName
- instructorBio
- instructorImageUrl
- contactEmail
- isPublished
- registrationOpen
- createdAt
- updatedAt

Suggested event status:
draft
published
sold_out
completed
cancelled

The initial event should use:
capacity = 20
targetAttendance = 15
priceCents = 1000
currency = CAD

==================================================
REGISTRATION FORM
==================================================

Keep registration short.

Required:
- firstName
- lastName
- email
- phone
- participation waiver acceptance

Optional:
- marketing consent
- how did you hear about us?

IMPORTANT:
Marketing consent must be separate from mandatory event participation terms.

A person must be able to buy a ticket even if they do not consent to marketing.

Participation waiver:
Do not permanently hard-code legal copy into business logic.
Store waiver text/version so it can be updated later.

Suggested structure:
waiverVersion
waiverText
waiverAcceptedAt

==================================================
ATTENDEE MODEL
==================================================

Recommended Attendee fields:

Attendee
- id
- eventId
- firstName
- lastName
- email
- phone
- waiverAccepted
- waiverVersion
- waiverAcceptedAt
- marketingConsent
- marketingConsentAt
- referralSource
- utmSource
- utmMedium
- utmCampaign
- utmContent
- paymentStatus
- attendeeStatus
- stripeCheckoutSessionId
- stripePaymentIntentId
- amountPaidCents
- currency
- registeredAt
- cancelledAt
- refundedAt
- checkedInAt
- createdAt
- updatedAt

Suggested attendeeStatus:
pending
confirmed
cancelled
checked_in
no_show

Suggested paymentStatus:
pending
paid
failed
refunded
cancelled

Do not use only a boolean paid flag.

==================================================
PAYMENT LOGIC
==================================================

Stripe will be used.

No Stripe account is configured yet, so build the integration with environment variables and mock-friendly abstractions.

Suggested env variables:

STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

IMPORTANT:
A browser redirect to a success page must NOT be treated as authoritative payment confirmation.

Stripe webhook must be the source of truth.

Only after Stripe confirms successful payment:
- attendee becomes confirmed
- paymentStatus becomes paid
- the ticket counts toward capacity

Do not count:
- submitted registration forms
- abandoned checkout sessions
- failed payments

toward the 20-seat capacity.

==================================================
CAPACITY & CONCURRENCY
==================================================

This is critical.

The system must NEVER allow more than 20 successful paid tickets.

Capacity must be enforced server-side.

Two users attempting to buy the last ticket simultaneously must not result in 21 confirmed paid tickets.

Do not rely only on:
- frontend checks
- client-side counts
- disabled buttons

Use transactional/database-safe logic.

Define clearly how the final seat is reserved/confirmed.

If temporary checkout reservations are needed, implement them carefully and expire them.

If you choose not to temporarily reserve seats during checkout, capacity must still be enforced when the webhook confirms payment.

Document your approach.

==================================================
CANCELLATION RULES
==================================================

Current business rule:

Cancellation does NOT automatically reopen inventory.

If 20 tickets were successfully sold:
ticketsSold remains 20 for inventory purposes unless manually adjusted.

Example:
20 sold
1 cancelled

Public page remains sold out.

Organizer sees:
Tickets sold: 20/20
Expected attendees: 19

Do not automatically offer the cancelled seat to future-event leads.

==================================================
REFUNDS
==================================================

Refund policy is not fully finalized.

Build this so refund handling can be added cleanly.

Support paymentStatus:
refunded

Support admin/manual refund state updates.

Do not assume refunds automatically reopen inventory.

==================================================
SOLD-OUT / FUTURE EVENT LEAD FLOW
==================================================

Once the event reaches capacity:
- hide paid registration CTA
- show sold-out state
- show future-event interest form

Do NOT call this a waitlist in the data model.

Use something like:

FutureEventLead
or
EventInterest

Suggested fields:

FutureEventLead
- id
- sourceEventId
- firstName
- lastName
- email
- phone
- marketingConsent
- utmSource
- utmMedium
- utmCampaign
- utmContent
- createdAt

These contacts are for future-event marketing.

They do NOT automatically gain access to cancelled seats.

==================================================
ADMIN EXPERIENCE
==================================================

Keep admin lightweight.

Do NOT build a huge CRM.

Build only what is needed for the first event.

Suggested admin dashboard:

Event Overview

Afro Dance Fitness
October 17, 2026

Tickets Sold
17 / 20

Expected Attendance
17

Revenue
$170

Future Event Leads
8

Actions:
- View Guests
- View Leads
- Export Guests CSV
- Export Leads CSV

Guest table:

Name
Email
Phone
Payment Status
Attendee Status
Waiver
Marketing Consent
Registered At
Checked In

Actions:
- Mark checked in
- Mark cancelled
- Mark no-show
- View attendee details

Optional:
- search
- filter by status

Do not overcomplicate the dashboard.

==================================================
CHECK-IN
==================================================

On event day, admin should be able to quickly mark guests as checked in from mobile.

Optimize this view for phone use.

One-tap check-in.

Show:
- name
- status
- check-in button

Do not require opening a full edit form for every attendee.

==================================================
EMAIL NOTIFICATIONS
==================================================

Build email flows with provider abstraction so the email service can be configured later.

Flows needed:

1. Successful payment
Guest:
- registration confirmation
- event date/time
- location
- what to bring
- confirmation that payment succeeded

Organizer:
- new registration notification
- attendee name
- count sold / capacity

2. 24 hours before event
Guest reminder:
- date
- arrival time
- address
- what to bring

3. 2-3 hours before event
Short reminder:
- see you tonight
- location
- arrival time

4. Post-event
Guest:
- thank you
- feedback request
- future event CTA

Future-event leads:
Do not email automatically unless they have consented appropriately.

==================================================
ANALYTICS
==================================================

Implement:
Google Analytics 4
Google Tag Manager
Google Search Console support

Use GTM as the main event orchestration layer where sensible.

Environment variables:

NEXT_PUBLIC_GTM_ID
NEXT_PUBLIC_GA_MEASUREMENT_ID

Build a reusable analytics abstraction.

Example:

trackEvent("reserve_spot_click", {
  event_id,
  event_name,
  spots_remaining
})

Do not scatter raw gtag calls throughout unrelated components.

==================================================
TRACKED EVENTS
==================================================

Track at minimum:

page_view
reserve_spot_click
registration_start
registration_submit
checkout_start
purchase
sold_out_view
future_event_lead_submit

Useful properties:

event_id
event_name
ticket_price
currency
spots_remaining
utm_source
utm_medium
utm_campaign
utm_content

Purchase should include:
value = 10
currency = CAD

Make sure purchase is triggered once, based on confirmed payment.

Avoid duplicate purchase events.

==================================================
UTM ATTRIBUTION
==================================================

Persist UTMs from first landing.

Support:

utm_source
utm_medium
utm_campaign
utm_content

Example QR link:

/event/afro-dance-fitness
?utm_source=poster
&utm_medium=qr
&utm_campaign=october17
&utm_content=gym_lobby

Social example:

utm_source=instagram
utm_medium=social
utm_campaign=october17

These values should survive the entire funnel and be stored with:
- attendee
- future-event lead

==================================================
SEARCH / SEO
==================================================

Add:
- page title
- meta description
- canonical URL
- robots.txt
- sitemap.xml
- Open Graph metadata
- Twitter/social metadata if appropriate

Add Event structured data / schema.org Event markup.

Include where appropriate:
- event name
- date/time
- location
- organizer
- ticket price
- currency
- availability
- event URL

Make schema data dynamic from Event configuration.

==================================================
SEARCH CONSOLE
==================================================

Build the site so Google Search Console verification can be configured easily.

Support either:
- HTML meta verification
or
- DNS/domain verification documentation

Do not hard-code a verification token.

==================================================
SOURCE ATTRIBUTION / QR TRACKING
==================================================

The app should make it easy to generate multiple campaign links.

Examples:
poster-gym
poster-workplace
poster-cafe
instagram
facebook
direct-message

We should later be able to answer:
- which source generated page visits
- which source started registration
- which source generated paid attendees
- which source generated future-event leads

==================================================
RESPONSIVE / MOBILE REQUIREMENTS
==================================================

Mobile-first.

This is critical because QR-code visitors will likely use phones.

Optimize:
- landing page
- forms
- checkout handoff
- admin guest list
- check-in

Support a sticky mobile CTA on the landing page.

Do not allow:
- horizontal overflow
- tiny touch targets
- overly dense admin tables on mobile

==================================================
ACCESSIBILITY
==================================================

Use:
- semantic HTML
- accessible labels
- keyboard navigation
- focus states
- appropriate color contrast
- aria attributes where needed

Do not rely only on color to communicate state.

==================================================
VALIDATION
==================================================

Implement server-side validation.

Validate:
- valid email
- required fields
- waiver acceptance
- valid phone format reasonably
- event registration state
- capacity
- payment state transitions

Do not trust client input.

==================================================
SECURITY
==================================================

Implement sensible baseline security:
- validate webhook signatures
- do not expose Stripe secret keys
- rate-limit registration/lead endpoints
- sanitize user input where appropriate
- protect admin routes
- prevent duplicate webhook processing
- prevent duplicate payment confirmation
- safe error handling
- avoid leaking PII to analytics

Do NOT send:
- email
- phone
- full name

to GA4/GTM.

==================================================
IDEMPOTENCY
==================================================

Important for Stripe and event registration.

The system should safely handle:
- webhook retries
- duplicate events
- repeated success-page visits
- duplicate form submissions
- browser refreshes

Stripe webhook processing must be idempotent.

==================================================
AUTH / ADMIN ACCESS
==================================================

Implement a simple secure admin authentication layer.

Do not overbuild multi-tenant permissions for MVP unless architecture already supports it easily.

Minimum:
- authenticated organizer/admin
- protected dashboard
- protected guest management
- protected check-in

==================================================
LANDING PAGE CONTENT CONFIG
==================================================

Make core copy configurable enough that Astra can redesign without changing business logic.

Examples:
heroHeadline
heroSubheadline
heroReassuranceItems
benefits
faqItems
instructorBio
finalCtaHeadline

Avoid burying marketing copy directly inside complex server logic.

==================================================
DESIGN HANDOFF TO ASTRA
==================================================

Build the landing page in a way that Astra can easily redesign.

Requirements:
- clean component hierarchy
- reusable components
- Tailwind CSS if available / preferred
- minimal one-off inline styling
- meaningful component names
- separate content/data from presentation where reasonable

Suggested components:

EventHero
EventBenefits
BeginnerReassurance
EventExperience
EventSchedule
InstructorSection
TicketOffer
CapacityIndicator
SocialProof
EventFaq
FinalCta
StickyMobileCta
SoldOutState
FutureEventLeadForm

Astra should be able to restyle/rearrange these without touching:
- payment logic
- capacity logic
- database logic
- analytics logic

==================================================
PREFERRED ROUTES
==================================================

Suggested:

Public:
/
or
/event/[slug]

Registration:
 /event/[slug]/register

Checkout creation API:
 /api/events/[id]/checkout

Stripe webhook:
 /api/webhooks/stripe

Success:
 /event/[slug]/success

Sold-out interest:
 Can be embedded on event page

Admin:
 /admin
 /admin/events/[id]
 /admin/events/[id]/guests
 /admin/events/[id]/leads
 /admin/events/[id]/check-in

Adjust based on framework conventions if needed.

==================================================
DATA REPORTING
==================================================

Admin should be able to see:

Tickets sold
Capacity
Expected attendees
Checked-in count
No-show count
Cancelled count
Revenue
Future-event lead count

Example:

Tickets Sold:
20 / 20

Expected:
18

Checked In:
16

Cancelled:
2

Revenue:
$200

Future Event Leads:
11

==================================================
EVENT STATES
==================================================

Clearly implement these public states:

1. Registration open
CTA:
Reserve My Spot — $10

2. Sold out
CTA:
Join the Next Class List

3. Event completed
No checkout.
Show completed state or future-event interest CTA.

4. Event cancelled
Show clear cancellation status.
No checkout.

==================================================
CAPACITY DISPLAY
==================================================

Support a dynamic count like:

7 spots remaining

Do not create fake scarcity.

Capacity is based on actual successful ticket sales.

When capacity = 20:
show sold out.

==================================================
COPY GUIDANCE
==================================================

Working landing page messaging direction:

Headline:
Your Saturday Workout Should Feel Like a Party.

Subheadline:
Move to Afrobeats, sweat, laugh and leave feeling amazing in a beginner-friendly Afro Dance Fitness experience in Nanaimo.

Hero details:
Saturday, October 17
5:00-6:30 PM
Nanaimo
$10
20 spots maximum

Reassurance:
No dance experience needed
Beginner friendly
Open to everyone
One-time ticket
No membership

Do NOT treat this copy as final immutable content.
Astra will refine it.

==================================================
WHAT NOT TO BUILD YET
==================================================

Do NOT build:
- complex CRM
- memberships
- subscriptions
- instructor marketplace
- class packages
- multiple staff permission levels
- loyalty system
- referral program
- automated seat replacement
- complex waitlist logic
- recurring class scheduling
- advanced marketing automation

Keep this focused.

==================================================
MVP SUCCESS CRITERIA
==================================================

The MVP is complete when:

1. A visitor can open the event landing page.
2. They can start registration.
3. They can submit the required attendee information.
4. Waiver acceptance is captured.
5. They can begin Stripe checkout.
6. Successful Stripe payment confirms the attendee.
7. Failed/abandoned checkout does not consume a ticket.
8. Capacity cannot exceed 20 paid tickets.
9. At 20 sold tickets, checkout closes.
10. Sold-out visitors can submit future-event interest.
11. Future-event leads are stored separately.
12. Admin can view guests.
13. Admin can view future-event leads.
14. Admin can mark check-in.
15. Admin can export CSV.
16. Confirmation/reminder email architecture exists.
17. GA4/GTM tracking works.
18. UTM attribution persists through conversion.
19. Search/SEO basics exist.
20. Event schema is generated.
21. The app is responsive and mobile-first.
22. Landing-page components are cleanly separated for Astra to redesign.

==================================================
TEST CASES
==================================================

Please create tests for these scenarios:

1. First attendee pays successfully.
Expected:
ticket count = 1

2. Registration submitted but checkout abandoned.
Expected:
ticket count unchanged

3. Payment fails.
Expected:
not confirmed
capacity unchanged

4. 19 tickets sold and user 20 pays.
Expected:
ticket count = 20
event becomes sold out

5. Attempt ticket 21.
Expected:
checkout blocked or payment cannot confirm into overcapacity

6. Two people attempt final seat simultaneously.
Expected:
capacity remains <= 20

7. Stripe sends same webhook twice.
Expected:
one attendee confirmation
one purchase record
one analytics purchase

8. Sold-out visitor submits future-event form.
Expected:
stored as FutureEventLead
not Attendee

9. Confirmed guest cancels after sellout.
Expected:
event remains sold out
ticket inventory does not automatically reopen

10. Admin marks guest checked in.
Expected:
checkedInAt set
status updated

11. UTM visitor purchases.
Expected:
UTM source/medium/campaign/content stored with attendee

12. UTM visitor joins future-event list.
Expected:
UTM values stored with lead

13. User declines marketing consent but pays.
Expected:
registration succeeds
marketingConsent = false

14. User does not accept waiver.
Expected:
registration blocked

==================================================
IMPLEMENTATION APPROACH
==================================================

Before coding:

1. Inspect the existing repository.
2. Report:
   - framework
   - database
   - ORM
   - auth
   - email setup
   - analytics setup
   - payment setup
   - styling framework
   - deployment environment
3. Propose the smallest architecture that fits this MVP.
4. Identify which parts already exist and should be reused.
5. Do not replace working infrastructure unnecessarily.

Then implement in phases.

Suggested phases:

Phase 1
Data model and event configuration

Phase 2
Public event flow and registration

Phase 3
Stripe checkout and webhook logic

Phase 4
Capacity enforcement and sold-out flow

Phase 5
Admin dashboard and check-in

Phase 6
Email notifications

Phase 7
GA4/GTM/UTM tracking

Phase 8
SEO/Search Console/Event schema

Phase 9
Testing/hardening

Phase 10
Prepare landing page for Astra redesign

At the end of each phase:
- run tests
- run typecheck
- run lint
- run build
- report changed files
- report unresolved issues

Do not move forward with hidden failures.

==================================================
FINAL DELIVERABLE
==================================================

When implementation is complete, provide:

1. Architecture summary
2. Database schema summary
3. Route map
4. Environment variable list
5. Stripe setup instructions
6. Email provider setup instructions
7. GA4/GTM setup instructions
8. Search Console setup instructions
9. UTM tracking examples
10. Admin usage instructions
11. Test results
12. Known limitations
13. Exact areas Astra should redesign
14. Any follow-up decisions still required from us

Do not redesign the landing page beyond a functional baseline.
Astra will handle final visual design and UX.