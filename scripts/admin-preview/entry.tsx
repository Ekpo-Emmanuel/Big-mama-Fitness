import React from "react";
import { createRoot } from "react-dom/client";
import "../../app/globals.css";
import "@fontsource/anton/latin-400.css";
import Events from "../../app/admin/(protected)/page";
import Overview from "../../app/admin/(protected)/events/[id]/page";
import EventView from "../../app/admin/(protected)/events/[id]/[view]/page";
import EventLayout from "../../app/admin/(protected)/events/[id]/layout";
import AdminLayout from "../../app/admin/(protected)/layout";
import Login from "../../app/login/page";
import Loading from "../../app/admin/(protected)/loading";
import ErrorPage from "../../app/admin/(protected)/error";
import { rows } from "./fixtures";
const root = createRoot(document.getElementById("root")!);
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  if (typeof input === "string" && input.startsWith("/api/admin/attendees/")) {
    if (new URLSearchParams(location.search).has("failure"))
      return Response.json(
        { error: "Connection interrupted. Try again." },
        { status: 503 },
      );
    const row = rows.find((row) => input.endsWith(row.id));
    const action = new URLSearchParams(init?.body as URLSearchParams).get(
      "action",
    );
    if (row && action === "check_in") {
      row.attendee_status = "checked_in";
      row.checked_in_at = new Date().toISOString();
    }
    if (row && action === "undo_check_in") {
      row.attendee_status = "confirmed";
      row.checked_in_at = null;
    }
    return Response.json({ ok: true });
  }
  return originalFetch(input, init);
};
async function render() {
  const path = location.pathname.split("/").filter(Boolean);
  let content;
  if (path[0] === "login") content = <Login />;
  else if (path[1] === "loading")
    content = await AdminLayout({ children: <Loading /> });
  else if (path[1] === "error")
    content = await AdminLayout({
      children: (
        <ErrorPage error={new Error("test")} retry={() => location.reload()} />
      ),
    });
  else if (path.length <= 1)
    content = await AdminLayout({ children: await Events() });
  else {
    const params = Promise.resolve({ id: "preview", view: path[3] || "" });
    content = await AdminLayout({
      children: await EventLayout({
        params,
        children: path[3]
          ? await EventView({ params })
          : await Overview({ params }),
      }),
    });
  }
  root.render(content);
}
window.addEventListener("preview-refresh", render);
render();
