import React, { useEffect, useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import "../../app/globals.css";
import "@fontsource/anton/latin-400.css";
import { MotionPreferences } from "../../components/motion";
import { AdminPage } from "../../components/admin-ui";
import { LandingPage } from "../../components/landing-page";
import { RegistrationForm } from "../../components/registration-form";
import { RegistrationConfirmation } from "../../components/registration-confirmation";
import { FeedbackForm } from "../../components/feedback-form";
import { AdminGuests, type AdminGuest } from "../../components/admin-guests";
import { event as baseEvent, rows, pending } from "../admin-preview/fixtures";
import Events from "../../app/admin/(protected)/page";
import Overview from "../../app/admin/(protected)/events/[id]/page";
import EventView from "../../app/admin/(protected)/events/[id]/[view]/page";
import EventLayout from "../../app/admin/(protected)/events/[id]/layout";
import AdminLayout from "../../app/admin/(protected)/layout";
import Login from "../../app/login/page";

const event = {
  ...baseEvent,
  startsAt: "2030-10-18T18:00:00Z",
  endsAt: "2030-10-18T19:00:00Z",
};
function LiveGuests() {
  const [guests, setGuests] = useState<AdminGuest[]>(rows);
  useEffect(() => {
    const channel = new BroadcastChannel("motion-qa");
    channel.onmessage = ({ data }: MessageEvent<AdminGuest[]>) =>
      setGuests(data);
    return () => channel.close();
  }, []);
  return (
    <AdminGuests
      rows={guests}
      checkIn
      live
      onLiveUpdate={async (id, action) => {
        await new Promise((resolve) => setTimeout(resolve, 350));
        if (location.search.includes("failure"))
          throw new Error("Fixture failure");
        const updated = guests.map((row) =>
          row.id === id
            ? {
                ...row,
                attendee_status:
                  action === "check_in" ? "checked_in" : "confirmed",
              }
            : row,
        );
        setGuests(updated);
        const channel = new BroadcastChannel("motion-qa");
        channel.postMessage(updated);
        channel.close();
      }}
    />
  );
}

async function main() {
  const path = location.pathname.split("/").filter(Boolean);
  let content: React.ReactNode;
  if (path[0] === "admin") {
    const params = Promise.resolve({ id: "preview", view: path[3] || "" });
    content = await AdminLayout({
      children:
        path.length === 1
          ? await Events()
          : await EventLayout({
              params,
              children:
                path[3] === "check-in" ? (
                  <AdminPage title="Check-in"><LiveGuests /></AdminPage>
                ) : path[3] === "guests" ? (
                  <AdminPage title="Guests"><AdminGuests rows={rows} pendingRows={pending} /></AdminPage>
                ) : path[3] ? (
                  await EventView({ params })
                ) : (
                  await Overview({ params })
                ),
            }),
    });
  } else if (path[0] === "login") content = <Login />;
  else if (path.includes("register"))
    content = (
      <main className="mx-auto max-w-xl p-5">
        <h1 className="text-3xl font-bold">Reserve your spot</h1>
        <RegistrationForm event={event} ready />
      </main>
    );
  else if (path[1] === "success")
    content = (
      <RegistrationConfirmation
        event={event}
        row={{ payment_status: "paid", attendee_status: "confirmed" }}
      />
    );
  else if (path[1] === "pending")
    content = (
      <RegistrationConfirmation
        event={event}
        row={{ payment_status: "pending", attendee_status: "confirmed" }}
      />
    );
  else if (path[1] === "feedback")
    content = (
      <main className="p-5">
        <FeedbackForm
          eventId={event.id}
          token="fixture"
          alreadySubmitted={false}
          existing={null}
        />
      </main>
    );
  else if (path[1] === "checkout")
    content = <h1>Checkout destination fixture</h1>;
  else
    content = (
      <LandingPage
        event={{ ...event, registrationOpen: path[1] !== "closed" }}
        sold={path[1] === "sold-out" ? event.capacity : 2}
      />
    );
  const tree = (
    <>
      <MotionPreferences />
      {content}
    </>
  );
  const container = document.getElementById("root")!;
  // Exercise matching initial markup/hydration; this is not a Next RSC transport test.
  container.innerHTML = renderToString(tree);
  hydrateRoot(container, tree, {
    onRecoverableError: (error) => {
      throw error;
    },
  });
}
void main();
