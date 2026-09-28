import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function quoted(listing: string, key: string) {
  return listing.match(new RegExp(key + " = '([^']*)'"))?.[1] || "";
}

function main() {
  const envPath = join(process.cwd(), ".env.local");
  const listing = execSync("stripe config --list", { encoding: "utf8" });
  const secret = quoted(listing, "test_mode_api_key");
  const publishable =
    quoted(listing, "test_mode_pub_key") ||
    quoted(listing, "test_mode_publishable_key");
  const secretOk = secret.startsWith("sk_test_") || secret.startsWith("rk_test_");
  const publishableOk = publishable.startsWith("pk_test_");
  if (!secretOk || !publishableOk) {
    const account = quoted(listing, "account_id");
    const name = quoted(listing, "display_name");
    if (account || name) {
      throw new Error(
        "Stripe CLI is logged in" +
          (name ? " to " + name : "") +
          (account ? " (" + account + ")" : "") +
          " but config has no sandbox API keys. " +
          "This CLI stores an OAuth session in the OS credential store and does not write test_mode_api_key. " +
          "Open that sandbox in the Dashboard (not live mode), then Developers, API keys. " +
          "Put the secret key in .env.local as STRIPE_SECRET_KEY and the publishable key as NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY. " +
          "Use sk_test_ or rk_test_, and pk_test_. Do not use live keys. " +
          "Or save them for this script with: stripe config --set test_mode_api_key <key> and stripe config --set test_mode_pub_key <pk_test_key>.",
      );
    }
    throw new Error(
      "Stripe CLI is not logged in with test-mode keys. Run stripe login.",
    );
  }
  let text = readFileSync(envPath, "utf8");
  function set(key: string, value: string) {
    const line = key + "=" + value;
    const pattern = new RegExp("^" + key + "=.*$", "m");
    if (pattern.test(text)) text = text.replace(pattern, line);
    else text += (text.endsWith("\n") ? "" : "\n") + line + "\n";
  }
  set("STRIPE_SECRET_KEY", secret);
  set("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", publishable);
  if (!/^APP_URL=/m.test(text)) set("APP_URL", "http://localhost:3000");
  writeFileSync(envPath, text);
  console.log(
    "Wrote Stripe test keys from CLI into .env.local (sk_test / pk_test only).",
  );
}

main();
