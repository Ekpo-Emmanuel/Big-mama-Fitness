import Stripe from "stripe";

const id = process.argv[2];
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const session = await stripe.checkout.sessions.retrieve(id, {
  expand: ["line_items.data.price.product"],
});
const product = session.line_items?.data[0]?.price?.product;
const productObj = product && typeof product === "object" ? product : null;
const price = session.line_items?.data[0]?.price;
console.log(
  JSON.stringify({
    id: session.id,
    mode: session.mode,
    currency: session.currency,
    amount_total: session.amount_total,
    status: session.status,
    payment_status: session.payment_status,
    branding: session.branding_settings ?? null,
    name: productObj && "name" in productObj ? productObj.name : null,
    description:
      productObj && "description" in productObj ? productObj.description : null,
    images:
      productObj && "images" in productObj ? productObj.images?.length : null,
    unit_amount: price?.unit_amount,
  }),
);
