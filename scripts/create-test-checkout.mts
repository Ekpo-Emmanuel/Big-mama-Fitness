const version = process.argv[2];
const response = await fetch(
  "http://localhost:3000/api/events/afro-oct-2026/checkout",
  {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify({
      firstName: "Stripe",
      lastName: "Sandbox",
      email: "stripe-sandbox-test@example.com",
      phone: "2505550199",
      marketingConsent: false,
      waiverAccepted: true,
      waiverVersion: version,
      referralSource: "",
      requestKey: crypto.randomUUID(),
      attribution: {},
    }),
  },
);
const text = await response.text();
let url = "";
try {
  url = JSON.parse(text).url || "";
} catch {
  url = "";
}
const session = url.match(/cs_test_[A-Za-z0-9]+/)?.[0] || "";
console.log(JSON.stringify({ status: response.status, session, body: session ? undefined : text.slice(0, 300) }));
