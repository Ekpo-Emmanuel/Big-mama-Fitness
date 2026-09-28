import Link from "next/link";
import { notFound } from "next/navigation";
import { getEvent } from "@/lib/db";
import { isFeedbackToken } from "@/lib/feedback";
import { resolveFeedback } from "@/lib/feedback-server";
import { FeedbackForm } from "@/components/feedback-form";
import { FeedbackPageView } from "@/components/feedback-page-view";
import { Section, buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Rate the class",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};

export default async function FeedbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();
  const { token } = await searchParams;
  const validToken = token && isFeedbackToken(token) ? token : "";
  const state = validToken
    ? await resolveFeedback(slug, validToken)
    : { status: "invalid" as const };

  return (
    <main id="main" className="min-h-[100dvh] bg-cream">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40"
      />
      <Section className="relative !py-10 sm:!py-16">
        {state.status === "ok" ? (
          <>
            <FeedbackPageView eventId={state.eventId} />
            <FeedbackForm
              eventId={state.eventId}
              eventName={state.eventName}
              firstName={state.firstName}
              token={validToken}
              alreadySubmitted={state.alreadySubmitted}
              existing={state.existing}
            />
          </>
        ) : (
          <div className="mx-auto max-w-lg space-y-6 text-center">
            <h1 className="font-display text-4xl uppercase leading-[1.05] tracking-tight sm:text-5xl">
              {state.status === "expired"
                ? "This feedback link has expired."
                : "This feedback link is not valid."}
            </h1>
            <p className="leading-relaxed text-ink/80">
              {state.status === "expired"
                ? "Feedback stays open for 30 days after class."
                : "Open the Rate the class link from your follow-up email."}
            </p>
            <Link href="/" className={buttonClass}>
              Back to Big Mama Fitness
            </Link>
          </div>
        )}
      </Section>
    </main>
  );
}
