import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getConnectedAccountPaymentStatus, getStripe } from "@/lib/stripe";
import { getSupabaseAdmin, normalizeEmail } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const signingSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  if (!signingSecret) return NextResponse.json({ error: "Webhook signing secret is not configured." }, { status: 500 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, signingSecret);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      const { chargesEnabled, detailsSubmitted } = await getConnectedAccountPaymentStatus(account.id);
      const { error } = await supabase.from("seller_connections").update({
        charges_enabled: chargesEnabled,
        details_submitted: detailsSubmitted,
      }).eq("stripe_account_id", account.id);
      if (error) throw error;
    }

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "paid") {
        if (!event.account || session.amount_total === null || !session.currency) {
          throw new Error("Paid Checkout session is missing connected-account or amount details.");
        }
        const paymentIntentId = typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null;
        const buyerEmail = normalizeEmail(session.customer_details?.email ?? session.customer_email);
        const { error } = await supabase.rpc("complete_marketplace_order", {
          p_session_id: session.id,
          p_stripe_account_id: event.account,
          p_payment_intent_id: paymentIntentId,
          p_buyer_email: buyerEmail,
          p_amount_total: session.amount_total,
          p_currency: session.currency,
        });
        if (error) throw error;
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const requestId = session.metadata?.reservation_token;
      if (requestId) {
        const { error } = await supabase.rpc("release_marketplace_listing", {
          p_request_id: requestId,
          p_status: "expired",
        });
        if (error) throw error;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing failed", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
