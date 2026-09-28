import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RegistrationConfirmation, confirmationState } from "../components/registration-confirmation";
import { initialEvent } from "../lib/event";

describe("registration confirmation presentation", () => {
  it("celebrates only verified paid, active registrations", () => {
    for (const payment_status of ["pending", "failed", "cancelled", "refunded"]) {
      expect(confirmationState({ payment_status, attendee_status: "confirmed" })).not.toBe("paid");
    }
    expect(confirmationState(null)).toBe("unknown");
    expect(confirmationState({ payment_status: "paid", attendee_status: "cancelled" })).toBe("cancelled");
    expect(confirmationState({ payment_status: "paid", attendee_status: "checked_in" })).toBe("paid");
  });
  it("uses event data and working calendar parameters without booking tokens", () => {
    const event = { ...initialEvent, name: "Future Dance", addressLine1: "123 New Street", instructorName: "Alex" };
    const html = renderToStaticMarkup(React.createElement(RegistrationConfirmation, { event, row: { payment_status: "paid", attendee_status: "confirmed" } }));
    expect(html).toContain("Spot confirmed");
    expect(html).toContain("Future Dance");
    expect(html).toContain("123 New Street");
    expect(html).toContain("With Alex");
    expect(html).toContain("20261018T000000Z%2F20261018T013000Z");
    expect(html).not.toContain("token=");
  });
  it("does not show success copy or calendar actions for an unverified booking", () => {
    const html = renderToStaticMarkup(React.createElement(RegistrationConfirmation, { event: initialEvent, row: null }));
    expect(html).toContain("Let’s check your booking.");
    expect(html).not.toContain("Spot confirmed");
    expect(html).not.toContain("Add to Google Calendar");
  });
});
