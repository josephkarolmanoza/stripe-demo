import Stripe from "stripe";

let stripe: Stripe | null = null;
export const stripeV2Options = { apiVersion: "2026-10-28.preview" };

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY.");
  if (!stripe) stripe = new Stripe(secretKey);
  return stripe;
}

export async function getConnectedAccountPaymentStatus(accountId: string) {
  const account = await getStripe().v2.core.accounts.retrieve(
    accountId,
    { include: ["configuration.merchant"] },
    stripeV2Options,
  );
  const chargesEnabled = account.configuration?.merchant?.capabilities?.card_payments?.status === "active";
  return { chargesEnabled, detailsSubmitted: chargesEnabled };
}
