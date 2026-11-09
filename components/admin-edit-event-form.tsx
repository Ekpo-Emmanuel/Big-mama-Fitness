"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/lib/convex";
import type { DanceEvent, EventStatus } from "@/lib/event";
import { adminButton } from "@/components/admin-ui";
import { AdminHintedField } from "@/components/admin-field-hint";
import { AdminFormAlert } from "@/components/admin-form-alert";
import { adminErrorMessage } from "@/lib/admin-error";

const field =
  "rounded-xl border border-ink/15 px-3 py-2 text-sm";

function wallParts(iso: string) {
  return {
    date: iso.slice(0, 10),
    time: iso.slice(11, 16),
    offset: iso.match(/([+-]\d{2}:\d{2})$/)?.[1] || "-08:00",
  };
}

function combine(date: string, time: string, offset: string) {
  return `${date}T${time}:00${offset}`;
}

export function AdminEditEventForm({ event }: { event: DanceEvent }) {
  const router = useRouter();
  const update = useMutation(api.events.updateEvent);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const start = wallParts(event.startsAt);
  const end = wallParts(event.endsAt);
  const workoutStart = wallParts(event.workoutStartsAt);
  const workoutEnd = wallParts(event.workoutEndsAt);

  async function onSubmit(form: FormData) {
    setError("");
    setPending(true);
    const date = String(form.get("date") || "");
    const offset = start.offset;
    const status = String(form.get("status") || event.status) as EventStatus;
    const isPublished = form.get("isPublished") === "on";
    try {
      await update({
        eventId: event.id,
        slug: String(form.get("slug") || event.slug),
        name: String(form.get("name") || ""),
        shortName: String(form.get("shortName") || ""),
        headline: String(form.get("headline") || ""),
        subheadline: String(form.get("subheadline") || ""),
        description: String(form.get("description") || ""),
        startsAt: combine(date, String(form.get("startTime") || ""), offset),
        endsAt: combine(date, String(form.get("endTime") || ""), offset),
        workoutStartsAt: combine(
          date,
          String(form.get("workoutStartTime") || ""),
          offset,
        ),
        workoutEndsAt: combine(
          date,
          String(form.get("workoutEndTime") || ""),
          offset,
        ),
        venueName: String(form.get("venueName") || ""),
        addressLine1: String(form.get("addressLine1") || ""),
        city: String(form.get("city") || ""),
        province: String(form.get("province") || ""),
        postalCode: String(form.get("postalCode") || ""),
        capacity: Number(form.get("capacity") || 0),
        targetAttendance: Number(form.get("targetAttendance") || 0),
        priceCents: Math.round(Number(form.get("price") || 0) * 100),
        instructorName: String(form.get("instructorName") || ""),
        instructorBio: String(form.get("instructorBio") || ""),
        contactEmail: String(form.get("contactEmail") || ""),
        status,
        isPublished,
        registrationOpen: form.get("registrationOpen") === "on",
        waiverVersion: String(form.get("waiverVersion") || ""),
        waiverText: String(form.get("waiverText") || ""),
      });
      router.refresh();
      setPending(false);
    } catch (caught) {
      setError(adminErrorMessage(caught, "Could not save event."));
      setPending(false);
    }
  }

  return (
    <form action={onSubmit} className="grid gap-5">
      <AdminFormAlert message={error} />
      <section className="grid gap-3">
        <h3 className="text-sm font-semibold">The event</h3>
        <label className="grid gap-1 text-sm">
          Event name
          <input name="name" required className={field} defaultValue={event.name} />
        </label>
        <label className="grid gap-1 text-sm">
          Short name
          <input
            name="shortName"
            required
            className={field}
            defaultValue={event.shortName}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Public URL slug
          <input name="slug" required className={field} defaultValue={event.slug} />
        </label>
        <label className="grid gap-1 text-sm">
          Headline
          <input
            name="headline"
            required
            className={field}
            defaultValue={event.headline}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Subheadline
          <textarea
            name="subheadline"
            required
            rows={3}
            className={field}
            defaultValue={event.subheadline}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Description
          <textarea
            name="description"
            rows={4}
            className={field}
            defaultValue={event.description}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Date
          <input
            name="date"
            type="date"
            required
            className={field}
            defaultValue={start.date}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm">
            Doors
            <input
              name="startTime"
              type="time"
              required
              className={field}
              defaultValue={start.time}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Event end
            <input
              name="endTime"
              type="time"
              required
              className={field}
              defaultValue={end.time}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Workout start
            <input
              name="workoutStartTime"
              type="time"
              required
              className={field}
              defaultValue={workoutStart.time}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Workout end
            <input
              name="workoutEndTime"
              type="time"
              required
              className={field}
              defaultValue={workoutEnd.time}
            />
          </label>
        </div>
      </section>
      <section className="grid gap-3">
        <h3 className="text-sm font-semibold">Location</h3>
        <label className="grid gap-1 text-sm">
          Street address
          <input
            name="addressLine1"
            required
            className={field}
            defaultValue={event.addressLine1}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Studio
          <input
            name="venueName"
            className={field}
            defaultValue={event.venueName}
            placeholder="1"
          />
          <span className="font-normal text-ink/65">
            Optional. Room or studio number at this address.
          </span>
        </label>
        <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-3">
          <label className="grid gap-1 text-sm">
            City
            <input name="city" required className={field} defaultValue={event.city} />
          </label>
          <label className="grid gap-1 text-sm">
            Province
            <input
              name="province"
              required
              className={field}
              defaultValue={event.province}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Postal code
            <input
              name="postalCode"
              required
              className={field}
              defaultValue={event.postalCode}
            />
          </label>
        </div>
      </section>
      <section className="grid gap-3">
        <h3 className="text-sm font-semibold">Registration</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm">
            Price (CAD)
            <input
              name="price"
              type="number"
              min={0.01}
              step={0.01}
              required
              className={field}
              defaultValue={(event.priceCents / 100).toFixed(2)}
            />
          </label>
          <AdminHintedField
            id="edit-capacity"
            label="Capacity"
            term="capacity"
            hint="Maximum tickets you can sell. Checkout stops at this number. Guests see remaining spots from this. Highest allowed is 20."
          >
            <input
              id="edit-capacity"
              name="capacity"
              type="number"
              min={1}
              max={20}
              required
              className={field}
              defaultValue={event.capacity}
            />
          </AdminHintedField>
          <AdminHintedField
            id="edit-targetAttendance"
            label="Attendance target"
            term="attendance target"
            hint="Number you hope to fill. For your planning only. Does not stop sales. Must be at or below capacity."
          >
            <input
              id="edit-targetAttendance"
              name="targetAttendance"
              type="number"
              min={0}
              max={20}
              required
              className={field}
              defaultValue={event.targetAttendance}
            />
          </AdminHintedField>
          <label className="grid gap-1 text-sm">
            Status
            <select name="status" className={field} defaultValue={event.status}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="sold_out">Sold out</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input name="isPublished" type="checkbox" defaultChecked={event.isPublished} />
          Listed on public site
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            name="registrationOpen"
            type="checkbox"
            defaultChecked={event.registrationOpen}
          />
          Registration open
        </label>
      </section>
      <section className="grid gap-3">
        <h3 className="text-sm font-semibold">Instructor</h3>
        <label className="grid gap-1 text-sm">
          Instructor name
          <input
            name="instructorName"
            required
            className={field}
            defaultValue={event.instructorName}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Bio
          <textarea
            name="instructorBio"
            rows={3}
            className={field}
            defaultValue={event.instructorBio}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Contact email
          <input
            name="contactEmail"
            type="email"
            className={field}
            defaultValue={event.contactEmail}
          />
        </label>
      </section>
      <section className="grid gap-3">
        <h3 className="text-sm font-semibold">Waiver</h3>
        <label className="grid gap-1 text-sm">
          Waiver version
          <input
            name="waiverVersion"
            className={field}
            defaultValue={event.waiverVersion}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Waiver text
          <textarea
            name="waiverText"
            rows={10}
            className={`${field} font-mono text-xs`}
            defaultValue={event.waiverText}
          />
        </label>
        <p className="text-xs text-ink/65">
          Existing guests keep the waiver they already accepted. New checkouts use
          this text.
        </p>
      </section>
      <button type="submit" className={adminButton} disabled={pending}>
        {pending ? "Saving…" : "Save event details"}
      </button>
    </form>
  );
}
