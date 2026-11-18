import { NextResponse } from "next/server";
import { getStripe, stripeV2Options } from "@/lib/stripe";
import { getSupabaseAdmin, isValidEmail, normalizeEmail } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = normalizeEmail(body?.email);
    if (!isValidEmail(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: existing, error: lookupError } = await supabase
      .from("seller_connections").select("stripe_account_id").eq("email", email).maybeSingle();
    if (lookupError) throw lookupError;

    const stripe = getStripe();
    let accountId = existing?.stripe_account_id as string | undefined;
    if (!accountId) {
      const account = await stripe.v2.core.accounts.create({
        contact_email: email,
        dashboard: "express",
        identity: { country: "US" },
        defaults: { responsibilities: { fees_collector: "stripe", losses_collector: "stripe" } },
        configuration: { merchant: { capabilities: { card_payments: { requested: true } } } },
        metadata: { seller_email: email },
        include: ["configuration.merchant", "requirements", "defaults"],
      }, stripeV2Options);
      accountId = account.id;
      const { error } = await supabase.from("seller_connections").upsert({
        email, stripe_account_id: accountId, charges_enabled: false, details_submitted: false,
      }, { onConflict: "email" });
      if (error) throw error;
    }

    const origin = new URL(request.url).origin;
    const link = await stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          refresh_url: `${origin}/connect?email=${encodeURIComponent(email)}&status=refresh`,
          return_url: `${origin}/connect?email=${encodeURIComponent(email)}&status=return`,
        },
      },
    }, stripeV2Options);
    return NextResponse.json({ url: link.url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start Stripe onboarding." }, { status: 500 });
  }
}
