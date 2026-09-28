export function publicSiteOrigin() {
  const value =
    process.env.SITE_URL || process.env.APP_URL || "http://localhost:3000";
  return new URL(value).origin;
}
