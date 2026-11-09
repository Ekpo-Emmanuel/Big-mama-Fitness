"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/lib/convex";
import { initialEvent, type DanceEvent } from "@/lib/event";
import {
  adminButton,
  adminField,
  adminLabel,
  adminPanel,
  adminSecondary,
} from "@/components/admin-ui";
import { AdminHintedField } from "@/components/admin-field-hint";
import { AdminFormAlert } from "@/components/admin-form-alert";
import { adminErrorMessage } from "@/lib/admin-error";

function formatBoardDate(date: string) {
  if (!date) return "Pick a date";
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatBoardTime(start: string, end: string) {
  if (!start || !end) return "Set class times";
  return `${start} – ${end}`;
}

function SectionTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm font-normal leading-relaxed text-ink/65">
        {hint}
      </p>
    </div>
  );
}

function wallDate(iso: string | undefined) {
  return iso?.slice(0, 10) || "";
}

function wallTime(iso: string | undefined, fallback = "") {
  return iso?.slice(11, 16) || fallback;
}

export function AdminNewEventForm({
  template,
}: {
  template?: DanceEvent | null;
}) {
  const event = template?.id ? template : initialEvent;
  const router = useRouter();
  const duplicate = useMutation(api.events.duplicateEvent);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"draft" | "publish" | "">("");
  const [date, setDate] = useState(wallDate(event.startsAt));
  const [startTime, setStartTime] = useState(wallTime(event.startsAt));
  const [endTime, setEndTime] = useState(wallTime(event.endsAt, "18:30"));
  const [price, setPrice] = useState(((event.priceCents || 0) / 100).toFixed(2));
  const boardDate = useMemo(() => formatBoardDate(date), [date]);
  const boardTime = useMemo(
    () => formatBoardTime(startTime, endTime),
    [startTime, endTime],
  );

  async function create(form: FormData, publish: boolean) {
    setError("");
    setPending(publish ? "publish" : "draft");
    if (!date || !startTime || !endTime) {
      setPending("");
      setError("Date, doors, and end time are required.");
      return;
    }
    if (endTime < startTime) {
      setPending("");
      setError("End time must be at or after doors.");
      return;
    }
    const priceCents = Math.round(Number(price) * 100);
    if (!Number.isFinite(priceCents) || priceCents < 1) {
      setPending("");
      setError("Ticket price must be at least $0.01 CAD.");
      return;
    }
    const capacity = Number(form.get("capacity") || 0);
    const targetAttendance = Number(form.get("targetAttendance") || 0);
    if (!capacity || capacity < 1 || capacity > 20) {
      setPending("");
      setError("Capacity must be between 1 and 20.");
      return;
    }
    if (targetAttendance > capacity) {
      setPending("");
      setError("Attendance target cannot be higher than capacity.");
      return;
    }
    if (!String(form.get("addressLine1") || "").trim()) {
      setPending("");
      setError("Street address is required.");
      return;
    }
    if (!String(form.get("instructorName") || "").trim()) {
      setPending("");
      setError("Instructor name is required.");
      return;
    }
    const offsetMatch = event.startsAt?.match(/([+-]\d{2}:\d{2})$/);
    const offset = offsetMatch?.[1] || "-08:00";
    const startsAt = `${date}T${startTime}:00${offset}`;
    const endsAt = `${date}T${endTime}:00${offset}`;
    const waiverVersion = String(form.get("waiverVersion") || "").trim();
    const waiverText = String(form.get("waiverText") || "").trim();
    if (Boolean(waiverVersion) !== Boolean(waiverText)) {
      setPending("");
      setError("Waiver needs both a version name and the full text, or leave both empty.");
      return;
    }
    try {
      const created = await duplicate({
        sourceEventId: event.id,
        startsAt,
        endsAt,
        workoutStartsAt: startsAt,
        workoutEndsAt: endsAt,
        name: String(form.get("name") || "") || undefined,
        venueName: String(form.get("venueName") || "").trim(),
        addressLine1: String(form.get("addressLine1") || "").trim(),
        city: String(form.get("city") || "").trim(),
        province: String(form.get("province") || "").trim(),
        postalCode: String(form.get("postalCode") || "").trim(),
        capacity,
        targetAttendance,
        priceCents,
        instructorName: String(form.get("instructorName") || "") || undefined,
        instructorBio: String(form.get("instructorBio") || "") || undefined,
        waiverVersion: waiverVersion || undefined,
        waiverText: waiverText || undefined,
        publish,
      });
      router.push(`/admin/events/${created.id}/details`);
      router.refresh();
    } catch (caught) {
      setError(adminErrorMessage(caught, "Could not create event."));
      setPending("");
    }
  }

  const busy = Boolean(pending);

  return (
    <form className="pb-36 lg:pb-8">
      <div className="overflow-hidden rounded-[1.75rem] bg-ink text-cream">
        <p className="px-5 pt-5 text-[11px] font-semibold tracking-[0.2em] uppercase text-sun">
          {pending === "draft" ? "Saving draft" : "Next class"}
        </p>
        <p className="px-5 pt-2 font-display text-3xl uppercase leading-none tracking-wide sm:text-4xl">
          {boardDate}
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-3 pb-5">
          <p className="text-lg text-lilac">{boardTime}</p>
          <p className="text-sm font-semibold text-sun">
            ${price || "0.00"} CAD
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink/70">
        Starts from {event.name}. Change anything below. Guests on the old
        class stay there.
      </p>
      <div className="mt-4">
        <AdminFormAlert message={error} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2 lg:items-start">
        <section className={adminPanel}>
          <SectionTitle
            title="When and where"
            hint="Guests see this date, time, and venue."
          />
          <div className="grid gap-4">
            <label className={adminLabel}>
              Date
              <input
                name="date"
                type="date"
                required
                className={adminField}
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2">
              <label className={adminLabel}>
                Doors
                <input
                  name="startTime"
                  type="time"
                  required
                  className={adminField}
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                />
              </label>
              <label className={adminLabel}>
                End
                <input
                  name="endTime"
                  type="time"
                  required
                  className={adminField}
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                />
              </label>
            </div>
            <label className={adminLabel}>
              Event name
              <input
                name="name"
                className={adminField}
                defaultValue={event.name}
                autoComplete="off"
              />
            </label>
            <label className={adminLabel}>
              Street address
              <input
                name="addressLine1"
                required
                className={adminField}
                defaultValue={event.addressLine1}
                placeholder="1969 Boxwood Rd"
                autoComplete="street-address"
              />
            </label>
            <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-3">
              <label className={`${adminLabel} min-[400px]:col-span-1`}>
                City
                <input
                  name="city"
                  required
                  className={adminField}
                  defaultValue={event.city}
                  autoComplete="address-level2"
                />
              </label>
              <label className={adminLabel}>
                Province
                <input
                  name="province"
                  required
                  className={adminField}
                  defaultValue={event.province}
                  autoComplete="address-level1"
                />
              </label>
              <label className={adminLabel}>
                Postal code
                <input
                  name="postalCode"
                  required
                  className={adminField}
                  defaultValue={event.postalCode}
                  autoComplete="postal-code"
                />
              </label>
            </div>
            <label className={adminLabel}>
              Studio
              <input
                name="venueName"
                className={adminField}
                defaultValue={event.venueName}
                placeholder="1"
                autoComplete="off"
              />
              <span className="font-normal text-ink/65">
                Optional. Room or studio number at this address, like 1 or
                Studio 1.
              </span>
            </label>
            <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2">
              <AdminHintedField
                id="capacity"
                label="Capacity"
                term="capacity"
                hint="Maximum tickets you can sell. Checkout stops at this number. Guests see remaining spots from this. Highest allowed is 20."
              >
                <input
                  id="capacity"
                  name="capacity"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={20}
                  className={adminField}
                  defaultValue={event.capacity}
                />
              </AdminHintedField>
              <AdminHintedField
                id="targetAttendance"
                label="Attendance target"
                term="attendance target"
                hint="Number you hope to fill. For your planning only. Does not stop sales. Must be at or below capacity."
              >
                <input
                  id="targetAttendance"
                  name="targetAttendance"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={20}
                  className={adminField}
                  defaultValue={event.targetAttendance}
                />
              </AdminHintedField>
            </div>
          </div>
        </section>

        <section className={adminPanel}>
          <SectionTitle
            title="Ticket"
            hint="Price guests pay at checkout. CAD only."
          />
          <label className={adminLabel}>
            Price
            <span className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-ink/55">
                $
              </span>
              <input
                name="price"
                type="number"
                inputMode="decimal"
                min={0.01}
                step={0.01}
                required
                className={`${adminField} pl-7`}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </span>
            <span className="font-normal text-ink/65">Canadian dollars</span>
          </label>
        </section>

        <section className={adminPanel}>
          <SectionTitle
            title="Instructor"
            hint="Name and short bio on the public class page."
          />
          <div className="grid gap-4">
            <label className={adminLabel}>
              Instructor name
              <input
                name="instructorName"
                required
                className={adminField}
                defaultValue={event.instructorName}
                autoComplete="name"
              />
            </label>
            <label className={adminLabel}>
              Bio
              <textarea
                name="instructorBio"
                rows={5}
                className={`${adminField} min-h-32 resize-y`}
                defaultValue={event.instructorBio}
              />
            </label>
          </div>
        </section>

        <section className={adminPanel}>
          <SectionTitle
            title="Waiver"
            hint="New guests accept this text. People who already paid keep the copy they signed."
          />
          <div className="grid gap-4">
            <label className={adminLabel}>
              Version name
              <input
                name="waiverVersion"
                className={adminField}
                defaultValue={event.waiverVersion}
                autoComplete="off"
              />
            </label>
            <label className={adminLabel}>
              Waiver text
              <textarea
                name="waiverText"
                rows={10}
                className={`${adminField} min-h-48 resize-y font-mono text-sm leading-relaxed`}
                defaultValue={event.waiverText}
              />
            </label>
          </div>
        </section>
      </div>

      <p className="mt-5 text-sm leading-relaxed text-ink/70">
        Save as draft keeps this class off the public site. Open registration
        lists it and lets guests buy tickets.
      </p>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ink/10 bg-cream/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:static lg:mt-6 lg:border-0 lg:bg-transparent lg:p-0">
        <div className="mx-auto grid max-w-4xl gap-2">
          {error ? (
            <p className="text-sm text-amber-950 lg:hidden" role="status">
              {error}
            </p>
          ) : null}
        <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-wrap">
          <button
            type="submit"
            className={`${adminButton} order-1 col-span-2 min-h-12 lg:order-3 lg:ml-auto lg:flex-none`}
            disabled={busy}
            formAction={(form) => create(form, true)}
          >
            {pending === "publish" ? "Opening…" : "Open registration"}
          </button>
          <button
            type="submit"
            className={`${adminSecondary} order-2 min-h-12 lg:order-2`}
            disabled={busy}
            formAction={(form) => create(form, false)}
          >
            {pending === "draft" ? "Saving draft…" : "Save as draft"}
          </button>
          <Link
            href="/admin"
            className={`${adminSecondary} order-3 min-h-12 lg:order-1 lg:flex-none`}
          >
            Cancel
          </Link>
        </div>
        </div>
      </div>
    </form>
  );
}

export function SetFeaturedButton({ eventId }: { eventId: string }) {
  const setFeatured = useMutation(api.events.setFeaturedEvent);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="grid gap-1">
      <button
        type="button"
        className={adminSecondary}
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            await setFeatured({ eventId });
            router.refresh();
          } catch (caught) {
            setError(
              adminErrorMessage(caught, "Could not set homepage event."),
            );
            setPending(false);
          }
        }}
      >
        {pending ? "Saving…" : "Show on homepage"}
      </button>
      {error ? <p className="text-xs text-amber-900">{error}</p> : null}
    </div>
  );
}
