import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id") ?? "";
  if (!/^cs_[a-zA-Z0-9_]{10,250}$/.test(sessionId)) {
    return NextResponse.json({ error: "Invalid checkout session." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: order, error } = await supabase
      .from("orders")
      .select("listing_id, status, amount_total, currency, created_at")
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle();
    if (error) throw error;
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    const { data: listing, error: listingError } = await supabase
      .from("listings").select("title, photo_url").eq("id", order.listing_id).maybeSingle();
    if (listingError) throw listingError;

    return NextResponse.json({
      status: order.status,
      order: {
        listingTitle: listing?.title ?? "Marketplace item",
        photoUrl: listing?.photo_url ?? null,
        amountTotal: Number(order.amount_total),
        currency: order.currency,
        createdAt: order.created_at,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not look up this order." }, { status: 500 });
  }
}
