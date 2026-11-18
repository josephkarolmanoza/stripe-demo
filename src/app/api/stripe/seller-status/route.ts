import { NextResponse } from "next/server";
import { getConnectedAccountPaymentStatus } from "@/lib/stripe";
import { getSupabaseAdmin, isValidEmail, normalizeEmail } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const email = normalizeEmail(new URL(request.url).searchParams.get("email"));
  if (!isValidEmail(email)) return NextResponse.json({ connected: false }, { status: 400 });

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("seller_connections")
      .select("stripe_account_id")
      .eq("email", email)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ connected: false });

    const { chargesEnabled, detailsSubmitted } = await getConnectedAccountPaymentStatus(data.stripe_account_id);
    const { error: updateError } = await supabase.from("seller_connections").update({
      charges_enabled: chargesEnabled,
      details_submitted: detailsSubmitted,
    }).eq("email", email);
    if (updateError) throw updateError;
    return NextResponse.json({ connected: Boolean(chargesEnabled && detailsSubmitted) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not check seller status." }, { status: 500 });
  }
}
