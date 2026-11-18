import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getConnectedAccountPaymentStatus, getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "Could not start checkout.";
}

function checkoutErrorResponse(error: unknown) {
  const detail = errorMessage(error);
  const known: Record<string, { message: string; status: number }> = {
    LISTING_NOT_FOUND: { message: "Listing not found.", status: 404 },
    LISTING_SOLD: { message: "This listing has already sold.", status: 409 },
    LISTING_RESERVED: { message: "Someone is already checking out this listing.", status: 409 },
    SELLER_NOT_READY: { message: "This seller's Stripe account cannot accept payments right now.", status: 409 },
    PRICE_BELOW_MINIMUM: { message: "The listing price is below Stripe's minimum charge.", status: 400 },
  };
  const issue = Object.entries(known).find(([code]) => detail.includes(code))?.[1];
  return NextResponse.json({ error: issue?.message ?? detail }, { status: issue?.status ?? 500 });
}

export async function POST(request: Request) {
  let requestId: string | null = null;
  let sessionId: string | null = null;
  let connectedAccountId: string | null = null;
  let attached = false;
  const supabase = (() => {
    try { return getSupabaseAdmin(); } catch { return null; }
  })();

  try {
    const body = await request.json();
    const listingId = typeof body?.listingId === "string" ? body.listingId : "";
    if (!/^[0-9a-f-]{36}$/i.test(listingId)) return NextResponse.json({ error: "Invalid listing." }, { status: 400 });
    if (!supabase) throw new Error("Supabase server access is not configured.");

    const { data: listing, error: listingError } = await supabase
      .from("listings").select("id, title, price, email, status").eq("id", listingId).maybeSingle();
    if (listingError) throw listingError;
    if (!listing) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    if (listing.status === "sold") return NextResponse.json({ error: "This listing has already sold." }, { status: 409 });

    const email = String(listing.email).trim().toLowerCase();
    const { data: seller, error: sellerError } = await supabase
      .from("seller_connections")
      .select("stripe_account_id, charges_enabled, details_submitted")
      .eq("email", email).maybeSingle();
    if (sellerError) throw sellerError;
    if (!seller?.stripe_account_id || !seller.charges_enabled || !seller.details_submitted) {
      return NextResponse.json({ error: "This seller has not completed Stripe setup." }, { status: 409 });
    }

    const stripeAccountId = seller.stripe_account_id;
    connectedAccountId = stripeAccountId;
    const { chargesEnabled } = await getConnectedAccountPaymentStatus(stripeAccountId);
    if (!chargesEnabled) return NextResponse.json({ error: "This seller's Stripe account cannot accept payments right now." }, { status: 409 });

    requestId = randomUUID();
    const { data: reservation, error: reserveError } = await supabase.rpc("reserve_marketplace_listing", {
      p_listing_id: listing.id,
      p_request_id: requestId,
      p_stripe_account_id: stripeAccountId,
    });
    if (reserveError) throw reserveError;

    const order = reservation as { amount_total: number; application_fee_amount: number; title: string; seller_email: string };
    const origin = new URL(request.url).origin;
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      allowed_payment_method_types: ["card"],
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      customer_creation: "always",
      line_items: [{ quantity: 1, price_data: {
        currency: "usd",
        unit_amount: order.amount_total,
        product_data: { name: String(order.title).slice(0, 200) },
      } }],
      payment_intent_data: {
        application_fee_amount: order.application_fee_amount,
        metadata: { listing_id: listing.id, reservation_token: requestId },
      },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancelled?listing_id=${encodeURIComponent(listing.id)}`,
      metadata: {
        listing_id: listing.id,
        seller_email: order.seller_email,
        reservation_token: requestId,
      },
    }, { stripeAccount: stripeAccountId });

    sessionId = session.id;
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");

    const { error: attachError } = await supabase.rpc("attach_marketplace_checkout_session", {
      p_request_id: requestId,
      p_session_id: session.id,
    });
    if (attachError) throw attachError;
    attached = true;

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (requestId && supabase && !attached) {
      if (sessionId && connectedAccountId) {
        try { await getStripe().checkout.sessions.expire(sessionId, {}, { stripeAccount: connectedAccountId }); } catch { /* Session may already be complete or expired. */ }
      }
      try { await supabase.rpc("release_marketplace_listing", { p_request_id: requestId, p_status: "failed" }); } catch { /* Reservation expires automatically. */ }
    }
    return checkoutErrorResponse(error);
  }
}
