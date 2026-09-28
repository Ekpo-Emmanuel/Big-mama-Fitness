import Stripe from "stripe";

const id = process.argv[2];
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const method = await stripe.paymentMethods.create({
  type: "card",
  card: { token: "tok_visa" },
});
const body = new URLSearchParams({
  payment_method: method.id,
  expected_amount: "1000",
  expected_payment_method_type: "card",
});
const response = await fetch(
  "https://api.stripe.com/v1/payment_pages/" + id + "/confirm",
  {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.STRIPE_SECRET_KEY,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  },
);
const text = await response.text();
let parsed: { status?: string; payment_status?: string; error?: { message?: string } } =
  {};
try {
  parsed = JSON.parse(text);
} catch {
  parsed = {};
}
console.log(
  JSON.stringify({
    http: response.status,
    status: parsed.status,
    payment_status: parsed.payment_status,
    error: parsed.error?.message,
  }),
);
