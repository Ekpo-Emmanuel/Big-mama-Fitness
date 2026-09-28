export function uniqueEmails(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed || !trimmed.includes("@")) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    recipients.push(trimmed);
  }
  return recipients;
}
