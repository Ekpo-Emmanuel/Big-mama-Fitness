import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LandingPage } from "../components/landing-page";
import { initialEvent } from "../lib/event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

function render(sold: number, registrationOpen = true) {
  return renderToStaticMarkup(
    React.createElement(LandingPage, {
      event: {
        ...initialEvent,
        startsAt: "2030-10-17T17:00:00-07:00",
        endsAt: "2030-10-17T18:30:00-07:00",
        registrationOpen,
      },
      sold,
    }),
  );
}

describe("Next Class List public path", () => {
  it("keeps paid registration primary while exposing the list for open events", () => {
    const html = render(2);
    expect(html).toContain("Reserve My Spot");
    expect(html).toContain("Can’t make this class?");
    expect(html).toContain("Notify Me About the Next Class");
  });

  it("uses the same list when sold out or otherwise closed", () => {
    expect(render(initialEvent.capacity)).toContain("Want the next one?");
    expect(render(2, false)).toContain("Catch the next class.");
  });

  it("asks only for low-friction contact fields", () => {
    const html = render(2);
    expect(html).toContain('name="firstName"');
    expect(html).toContain('name="email"');
    expect(html).not.toContain('name="lastName"');
    expect(html).not.toContain('name="phone"');
    expect(html).not.toContain('name="waiverAccepted"');
  });
});
