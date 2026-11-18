import Stripe from "stripe";

const apiKey = process.env.STRIPE_SECRET_KEY;
if (!apiKey) {
  throw new Error("STRIPE_SECRET_KEY is missing. Add your Stripe test secret to .env.local.");
}

const stripe = new Stripe(apiKey);
const url = "https://stripe-demo-green.vercel.app/api/stripe/webhook";
const enabledEvents = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.expired",
  "account.updated",
];
const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
const existing = endpoints.data.find((item) => item.url === url && !item.livemode);

if (existing) {
  await stripe.webhookEndpoints.update(existing.id, { enabled_events: enabledEvents });
  console.log("Updated existing sandbox webhook endpoint:", url);
  console.log("Its signing secret is unchanged; keep the current STRIPE_WEBHOOK_SECRET.");
} else {
  const endpoint = await stripe.webhookEndpoints.create({ url, connect: true, enabled_events: enabledEvents });
  console.log("Webhook endpoint registered:", endpoint.url);
  console.log("Signing secret (save as STRIPE_WEBHOOK_SECRET):", endpoint.secret);
}
