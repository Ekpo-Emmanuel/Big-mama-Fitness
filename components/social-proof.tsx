import { Section, Eyebrow, headingClass } from "./ui";
export interface Testimonial {
  quote: string;
  name: string;
  sourceUrl?: string;
}
export function SocialProof({
  testimonials = [],
}: {
  testimonials?: Testimonial[];
}) {
  if (!testimonials.length) return null;
  return (
    <Section>
      <Eyebrow>From people who were there</Eyebrow>
      <h2 className={headingClass}>Their words. Their experience.</h2>
      <div className="mt-8 grid gap-8 md:grid-cols-2">
        {testimonials.map((item, index) => (
          <figure key={index} className="border-t border-ink/20 pt-6">
            <blockquote className="text-xl leading-relaxed">
              {item.quote}
            </blockquote>
            <figcaption className="mt-4 text-sm font-bold">
              {item.name}
              {item.sourceUrl && (
                <a
                  href={item.sourceUrl}
                  rel="noopener noreferrer"
                  className="ml-3 underline"
                >
                  View source
                </a>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}
