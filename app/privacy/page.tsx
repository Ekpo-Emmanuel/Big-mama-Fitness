import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/ui";

export const metadata: Metadata = {
  title: "Privacy policy · Big Mama Fitness",
  description:
    "How Big Mama Fitness collects and uses information for class registration and updates.",
};

export default function PrivacyPage() {
  return (
    <main id="main" className="pb-16">
      <Section className="!pb-8">
        <p className="text-sm">
          <Link href="/" className="underline underline-offset-2">
            ← Back
          </Link>
        </p>
        <h1 className="mt-8 font-display text-4xl uppercase sm:text-5xl">
          Privacy policy
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-ink/70">
          Last updated: September 27, 2026
        </p>
        <div className="mt-10 max-w-2xl space-y-6 text-base leading-relaxed">
          <p>
            Big Mama Fitness (“we”) runs class registration on bigmamafit.ca.
            This page explains what information we collect and why.
          </p>
          <section className="space-y-2">
            <h2 className="font-bold">What we collect</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Registration details you submit: name, email, phone, how you
                heard about us, waiver acceptance, and optional marketing
                preference.
              </li>
              <li>
                Payment details handled by Stripe. We do not store full card
                numbers on our servers.
              </li>
              <li>
                Next-class interest details if you join the wait / future-class
                list (name and email).
              </li>
              <li>
                Basic site analytics through Google Tag Manager / Google
                Analytics 4 (page and event data; not registration form free
                text).
              </li>
            </ul>
          </section>
          <section className="space-y-2">
            <h2 className="font-bold">How we use it</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>Confirm your spot and send class emails.</li>
              <li>Process payment and refunds through Stripe.</li>
              <li>Run the class (attendance / organizer tools).</li>
              <li>
                Send future-class updates only when you opt in or leave details
                for that purpose.
              </li>
              <li>Understand which pages and funnel steps people use.</li>
            </ul>
          </section>
          <section className="space-y-2">
            <h2 className="font-bold">Who we share with</h2>
            <p>
              Service providers that help us operate the site: Convex (app
              data), Stripe (payments), Resend (email), and Google Analytics /
              Tag Manager (measurement). We do not sell your personal
              information.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-bold">Contact</h2>
            <p>
              Questions about this policy:{" "}
              <a
                href="mailto:info@bigmamafit.ca"
                className="underline underline-offset-2"
              >
                info@bigmamafit.ca
              </a>
              .
            </p>
          </section>
        </div>
      </Section>
    </main>
  );
}
