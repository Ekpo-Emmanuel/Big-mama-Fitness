import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

type Mode = "dev" | "prod";

/** Canonical production app origin (www). Apex redirects here. */
export const PROD_ORIGIN = "https://www.bigmamafit.ca";

function mode(): Mode {
  const arg = process.argv[2];
  if (arg === "dev" || arg === "prod") return arg;
  throw new Error("Usage: npm run env:dev:check | npm run env:prod:check");
}

function readEnvFile(fileName: string, key: string) {
  const path = join(process.cwd(), fileName);
  if (!existsSync(path)) return "";
  const text = readFileSync(path, "utf8");
  const match = text.match(new RegExp("^" + key + "=(.*)$", "m"));
  return (match?.[1] || "").trim().replace(/^["']|["']$/g, "");
}

function readLocal(key: string) {
  return readEnvFile(".env.local", key);
}

function readProductionTemplate(key: string) {
  // Prefer .env.production so --env-file=.env.local does not poison prod URL checks.
  const fromFile = readEnvFile(".env.production", key);
  if (fromFile) return fromFile;
  return process.env[key]?.trim() || "";
}

function runConvex(args: string, timeoutMs = 45000) {
  try {
    return execSync("npx convex " + args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: timeoutMs,
      windowsHide: true,
    });
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    const out = (err.stdout || "") + (err.stderr || "");
    if (out.trim()) return out;
    throw error;
  }
}

function convexNames(target: Mode) {
  const flag = target === "prod" ? " --prod" : "";
  const out = runConvex("env list --names-only" + flag);
  return new Set(
    out
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^[A-Z0-9_]+$/.test(line)),
  );
}

function convexGet(target: Mode, key: string) {
  const flag = target === "prod" ? " --prod" : "";
  try {
    return runConvex("env get " + key + flag).trim();
  } catch {
    return "";
  }
}

function fail(message: string): never {
  console.error("FAIL: " + message);
  process.exit(1);
}

function ok(message: string) {
  console.log("OK: " + message);
}

function requireProdOrigin(label: string, value: string) {
  if (value !== PROD_ORIGIN) {
    fail(
      label +
        " must be " +
        PROD_ORIGIN +
        " (got '" +
        (value || "(empty)") +
        "'). Apex https://bigmamafit.ca must 301 to www.",
    );
  }
  ok(label + " is " + PROD_ORIGIN);
}

function main() {
  const target = mode();
  const deployment = readLocal("CONVEX_DEPLOYMENT");
  const appUrl = readLocal("APP_URL");
  const authUrl = readLocal("BETTER_AUTH_URL");
  const stripe = readLocal("STRIPE_SECRET_KEY");
  const names = convexNames(target);
  const siteUrl = convexGet(target, "SITE_URL");

  if (target === "dev") {
    if (!deployment.startsWith("dev:"))
      fail("CONVEX_DEPLOYMENT must start with dev: for local work.");
    ok("CONVEX_DEPLOYMENT is " + deployment);
    if (appUrl !== "http://localhost:3000")
      fail("APP_URL must be http://localhost:3000 in local .env.local.");
    ok("APP_URL is localhost");
    if (authUrl && authUrl !== "http://localhost:3000")
      fail("BETTER_AUTH_URL must be http://localhost:3000 for local login.");
    ok("BETTER_AUTH_URL is localhost");
    if (siteUrl !== "http://localhost:3000")
      fail(
        "Convex SITE_URL is '" +
          siteUrl +
          "'. Dev must use http://localhost:3000 or Better Auth returns 403.",
      );
    ok("Convex SITE_URL is localhost");
    if (stripe && !stripe.startsWith("sk_test_") && !stripe.startsWith("rk_test_"))
      fail("Local STRIPE_SECRET_KEY must be sk_test_ or rk_test_.");
    if (stripe) ok("Local Stripe key is test-mode");
    if (names.has("EMAIL_PRODUCTION"))
      fail("EMAIL_PRODUCTION must not be set on the Convex dev deployment.");
    ok("EMAIL_PRODUCTION absent on Convex dev");
    if (names.has("EMAIL_TEST_REDIRECT"))
      console.log(
        "NOTE: EMAIL_TEST_REDIRECT is set on Convex. All mail goes to that inbox. Unset for real recipients.",
      );
    else ok("EMAIL_TEST_REDIRECT unset (real recipients)");
    console.log("Dev environment check passed.");
    return;
  }

  if (!deployment.includes("prod") && !process.env.ALLOW_PROD_ENV_CHECK)
    console.log(
      "NOTE: .env.local still points at " +
        (deployment || "(unset)") +
        ". Prod check uses Convex --prod + .env.production / process.env for host URLs.",
    );

  requireProdOrigin(
    "Host APP_URL (.env.production or process.env)",
    readProductionTemplate("APP_URL"),
  );
  requireProdOrigin(
    "Host BETTER_AUTH_URL (.env.production or process.env)",
    readProductionTemplate("BETTER_AUTH_URL"),
  );
  requireProdOrigin("Prod Convex SITE_URL", siteUrl);

  if (!names.has("EMAIL_PRODUCTION"))
    fail("Prod Convex must set EMAIL_PRODUCTION=true.");
  ok("EMAIL_PRODUCTION is set on prod");
  if (names.has("EMAIL_TEST_REDIRECT"))
    fail("Prod Convex must not set EMAIL_TEST_REDIRECT.");
  ok("EMAIL_TEST_REDIRECT absent on prod");
  if (names.has("ALLOW_EMAIL_TEST_REDIRECT"))
    fail("Prod Convex must not set ALLOW_EMAIL_TEST_REDIRECT.");
  ok("ALLOW_EMAIL_TEST_REDIRECT absent on prod");
  const from = convexGet(target, "EMAIL_FROM").toLowerCase();
  if (from.includes("onboarding@resend.dev"))
    fail("Prod EMAIL_FROM must not use onboarding@resend.dev.");
  if (!from) fail("Prod EMAIL_FROM is missing.");
  ok("Prod EMAIL_FROM is set");
  console.log(
    "Prod environment check passed (canonical " +
      PROD_ORIGIN +
      "; apex redirects to www).",
  );
}

main();
