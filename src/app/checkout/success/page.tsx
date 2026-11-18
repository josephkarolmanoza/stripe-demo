"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, Clock3, Store } from "lucide-react";

type Confirmation = {
  status: "pending" | "paid" | "expired" | "failed";
  order: { listingTitle: string; photoUrl: string | null; amountTotal: number; currency: string };
};

export default function CheckoutSuccessPage() {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [message, setMessage] = useState("Checking your payment…");
  const [timedOut, setTimedOut] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get("session_id");
    if (!sessionId) {
      setMessage("We couldn’t find the checkout session for this page.");
      return;
    }

    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const checkOrder = async () => {
      try {
        const response = await fetch(`/api/orders/confirmation?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not confirm your order.");
        if (!active) return;
        setConfirmation(data as Confirmation);
        if (data.status === "paid") {
          setMessage("");
          setTimedOut(false);
          return;
        }
        if (data.status === "expired" || data.status === "failed") {
          setMessage("This checkout wasn’t completed. The listing is available again.");
          return;
        }
        if (attempts++ < 20) {
          timer = setTimeout(checkOrder, 1500);
        } else {
          setTimedOut(true);
          setMessage("Your payment is still processing. You can refresh this page in a moment.");
        }
      } catch (error) {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "Could not confirm your order.");
        setTimedOut(true);
      }
    };
    void checkOrder();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [retry]);

  const paid = confirmation?.status === "paid";
  const amount = confirmation?.order.amountTotal !== undefined
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: confirmation.order.currency.toUpperCase() }).format(confirmation.order.amountTotal / 100)
    : null;

  return (
    <main className="checkout-result-shell">
      <header className="checkout-result-topbar">
        <a className="brand" href="/"><span className="brand-mark">W</span><span className="brand-name">Wallmarkt</span></a>
        <span className="checkout-result-market"><Store size={17} /> Marketplace</span>
      </header>
      <section className="checkout-result-card" aria-live="polite">
        <div className={`checkout-result-icon ${paid ? "is-paid" : "is-pending"}`}>
          {paid ? <BadgeCheck size={34} /> : <Clock3 size={32} />}
        </div>
        <span className="connect-card-kicker">WALLMARKT PAYMENTS</span>
        <h1>{paid ? "Your purchase is confirmed" : "Confirming your purchase"}</h1>
        <p className="checkout-result-message">{message}</p>
        {confirmation?.order && (
          <div className="checkout-order-summary">
            {confirmation.order.photoUrl && <img src={confirmation.order.photoUrl} alt="" />}
            <div><strong>{confirmation.order.listingTitle}</strong><span>{amount}</span></div>
            {paid && <b className="checkout-paid-tag">PAID</b>}
          </div>
        )}
        {timedOut && <button type="button" className="checkout-retry" onClick={() => { setConfirmation(null); setTimedOut(false); setRetry((value) => value + 1); }}>Check again</button>}
        <a href="/" className="checkout-back-link"><ArrowLeft size={16} /> Back to Marketplace</a>
      </section>
      <footer className="connect-footer"><span>Wallmarkt</span><span>·</span><span>Buy and sell with your community</span></footer>
    </main>
  );
}
