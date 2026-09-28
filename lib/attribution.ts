export const utmKeys = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
] as const;
export type Attribution = Partial<Record<(typeof utmKeys)[number], string>> & {
  client_id?: string;
  session_id?: number;
};
export const campaigns = {
  "poster-gym": {
    utm_source: "poster",
    utm_medium: "qr",
    utm_campaign: "october17",
    utm_content: "gym_lobby",
  },
  "poster-workplace": {
    utm_source: "poster",
    utm_medium: "qr",
    utm_campaign: "october17",
    utm_content: "workplace",
  },
  "poster-cafe": {
    utm_source: "poster",
    utm_medium: "qr",
    utm_campaign: "october17",
    utm_content: "cafe",
  },
  instagram: {
    utm_source: "instagram",
    utm_medium: "social",
    utm_campaign: "october17",
    utm_content: "profile",
  },
  facebook: {
    utm_source: "facebook",
    utm_medium: "social",
    utm_campaign: "october17",
    utm_content: "post",
  },
  "direct-message": {
    utm_source: "direct-message",
    utm_medium: "message",
    utm_campaign: "october17",
    utm_content: "invite",
  },
};
export function cleanAttribution(input: Record<string, unknown>): Attribution {
  const result: Attribution = {};
  for (const key of utmKeys) {
    const value = input[key];
    if (typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value))
      result[key] = value;
  }
  if (
    typeof input.client_id === "string" &&
    /^\d{1,12}\.\d{1,12}$/.test(input.client_id)
  )
    result.client_id = input.client_id;
  if (
    typeof input.session_id === "number" &&
    Number.isSafeInteger(input.session_id) &&
    input.session_id > 0
  )
    result.session_id = input.session_id;
  return result;
}
export function analyticsAttribution(input: Attribution) {
  const result: Attribution = {};
  for (const key of utmKeys) {
    const value = input[key];
    if (value && Object.values(campaigns).some((c) => c[key] === value))
      result[key] = value;
  }
  return result;
}
type AnalyticsSession = { id: number; lastSeen: number };
let sessionMemory: AnalyticsSession | undefined;
export function sessionFor(
  previous: AnalyticsSession | undefined,
  now: number,
): AnalyticsSession {
  const active =
    previous &&
    Number.isSafeInteger(previous.id) &&
    previous.id > 0 &&
    Number.isFinite(previous.lastSeen) &&
    now - previous.lastSeen >= 0 &&
    now - previous.lastSeen < 30 * 60000;
  return { id: active ? previous.id : Math.floor(now / 1000), lastSeen: now };
}
function withSession(value: Attribution): Attribution {
  let previous = sessionMemory;
  try {
    const saved = sessionStorage.getItem("afro_analytics_session");
    if (saved) previous = JSON.parse(saved);
  } catch {}
  sessionMemory = sessionFor(previous, Date.now());
  try {
    sessionStorage.setItem(
      "afro_analytics_session",
      JSON.stringify(sessionMemory),
    );
  } catch {}
  return { ...value, session_id: sessionMemory.id };
}

let memory: { expires: number; value: Attribution } | undefined;
export function getAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  try {
    const saved = localStorage.getItem("afro_first_touch");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.expires > Date.now())
        return withSession(cleanAttribution(parsed.value));
    }
  } catch {}
  if (memory && memory.expires > Date.now()) return withSession(memory.value);
  const query = Object.fromEntries(new URLSearchParams(window.location.search));
  const numbers = crypto.getRandomValues(new Uint32Array(1));
  const now = Math.floor(Date.now() / 1000);
  const ga = document.cookie
    .split("; ")
    .find((c) => c.startsWith("_ga="))
    ?.split("=")[1]
    ?.split(".")
    .slice(-2)
    .join(".");
  const value = cleanAttribution({
    ...query,
    client_id: ga || numbers[0] + "." + now,
    session_id: now,
  });
  memory = { expires: Date.now() + 30 * 86400000, value };
  try {
    localStorage.setItem("afro_first_touch", JSON.stringify(memory));
  } catch {}
  return withSession(value);
}
