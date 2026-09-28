export function productionEmailRuntime() {
  if (process.env.VERCEL_ENV === "preview") return false;
  if (process.env.ALLOW_EMAIL_TEST_REDIRECT === "true") return false;
  return (
    process.env.EMAIL_PRODUCTION === "true" ||
    process.env.VERCEL_ENV === "production"
  );
}

export function assertProductionEmailSafety() {
  if (!productionEmailRuntime()) return;
  if (process.env.EMAIL_TEST_REDIRECT?.trim()) {
    throw new Error(
      "EMAIL_TEST_REDIRECT must not be set in production. Unset it so guest addresses receive mail.",
    );
  }
  const from = (process.env.EMAIL_FROM || "").trim().toLowerCase();
  if (from.includes("onboarding@resend.dev")) {
    throw new Error(
      "EMAIL_FROM must be a verified production sender. Do not use onboarding@resend.dev in production.",
    );
  }
}
