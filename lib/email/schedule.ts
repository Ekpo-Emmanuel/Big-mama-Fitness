const HOUR = 60 * 60 * 1000;

export function reminderDueTimes(startsAt: string) {
  const start = Date.parse(startsAt);
  return {
    reminder_24: start - 24 * HOUR,
    reminder_3: start - 3 * HOUR,
  };
}

export function followupDueAt(endsAt: string) {
  return Date.parse(endsAt) + 2 * HOUR;
}

export function postPaymentEmailJobs(
  event: { startsAt: string; endsAt: string },
  now = Date.now(),
) {
  const reminders = reminderDueTimes(event.startsAt);
  return [
    { kind: "organizer", dueAt: now },
    { kind: "reminder_24", dueAt: reminders.reminder_24 },
    { kind: "reminder_3", dueAt: reminders.reminder_3 },
    { kind: "followup", dueAt: followupDueAt(event.endsAt) },
  ].filter((job) => job.dueAt >= now - 1000);
}
