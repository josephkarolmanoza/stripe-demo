"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck, CreditCard, LockKeyhole, Mail, ShieldCheck, Store, WalletCards } from "lucide-react";

export default function ConnectPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState<"success" | "info" | "error">("info");
  const [busy, setBusy] = useState(false);
  const [returnedFromStripe, setReturnedFromStripe] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryEmail = params.get("email");
    if (queryEmail) setEmail(queryEmail);
    setReturnedFromStripe(params.get("status") === "return");
  }, []);

  useEffect(() => {
    if (!returnedFromStripe || !email) return;
    let active = true;
    fetch(`/api/stripe/seller-status?email=${encodeURIComponent(email)}`)
      .then((response) => response.json())
      .then((data) => {
        if (!active) return;
        setStatusKind(data.connected ? "success" : "info");
        setStatus(data.connected ? "Stripe is connected. Listings with this email can accept Buy Now payments." : "Stripe is still reviewing your account. You can return here to continue setup.");
      })
      .catch(() => {
        if (!active) return;
        setStatusKind("error");
        setStatus("Could not check the Stripe account yet. Please try again.");
      });
    return () => { active = false; };
  }, [email, returnedFromStripe]);

  async function connect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/stripe/connect", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not connect to Stripe.");
      window.location.assign(data.url);
    } catch (error) {
      setStatusKind("error");
      setStatus(error instanceof Error ? error.message : "Could not connect to Stripe.");
      setBusy(false);
    }
  }

  return (
    <div className="connect-shell">
      <header className="connect-topbar">
        <div className="connect-topbar-inner">
          <a href="/" className="brand connect-brand" aria-label="Wallmarkt home">
            <span className="brand-mark">W</span>
            <span className="brand-name">Wallmarkt</span>
          </a>
          <a href="/" className="connect-back-link"><ArrowLeft size={16} /><span>Back to Marketplace</span></a>
        </div>
      </header>

      <main className="connect-main">
        <div className="connect-page-heading">
          <span className="connect-eyebrow">SELLER TOOLS</span>
          <h1>Get paid for the things you sell</h1>
          <p>Connect Stripe to let buyers purchase your Wallmarkt listings securely.</p>
        </div>

        <div className="connect-grid">
          <section className="connect-overview-card" aria-labelledby="connect-overview-title">
            <div className="connect-illustration" aria-hidden="true">
              <div className="connect-illustration-orbit orbit-one" />
              <div className="connect-illustration-orbit orbit-two" />
              <div className="connect-illustration-center"><WalletCards size={39} strokeWidth={1.7} /></div>
              <div className="connect-illustration-float float-card"><CreditCard size={19} /><span>Secure checkout</span><BadgeCheck size={17} /></div>
              <div className="connect-illustration-float float-payout"><span className="payout-dot"><ArrowRight size={15} /></span><span>Seller payout</span><strong>✓</strong></div>
            </div>
            <div className="connect-overview-copy">
              <span className="connect-card-kicker">SIMPLE AND SECURE</span>
              <h2 id="connect-overview-title">A smoother way to sell locally</h2>
              <p>Once connected, every listing using your seller email can offer a Buy Now option.</p>
            </div>
            <div className="connect-benefits">
              <div className="connect-benefit">
                <span className="connect-benefit-icon"><CreditCard size={19} /></span>
                <div><strong>Checkout buyers trust</strong><span>Payments are handled securely by Stripe.</span></div>
              </div>
              <div className="connect-benefit">
                <span className="connect-benefit-icon"><WalletCards size={19} /></span>
                <div><strong>Get paid through Stripe</strong><span>Stripe manages verification and payouts.</span></div>
              </div>
              <div className="connect-benefit">
                <span className="connect-benefit-icon"><ShieldCheck size={19} /></span>
                <div><strong>Your details stay protected</strong><span>Bank and identity details go directly to Stripe.</span></div>
              </div>
            </div>
            <div className="connect-fee-note"><span>Platform fee</span><strong>10%</strong><span>of completed payments</span></div>
          </section>

          <section className="connect-form-card" aria-labelledby="connect-form-title">
            <div className="connect-form-card-head">
              <span className="connect-form-icon"><Store size={21} /></span>
              <div><span className="connect-card-kicker">WALLMARKT PAYMENTS</span><h2 id="connect-form-title">Connect with Stripe</h2></div>
            </div>
            <p className="connect-form-intro">Use the same email address that appears on your listings.</p>

            <form onSubmit={connect} className="connect-form">
              <label htmlFor="seller-email">Seller email</label>
              <span className="connect-input-wrap">
                <Mail size={18} aria-hidden="true" />
                <input
                  id="seller-email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </span>
              <button className="connect-submit" type="submit" disabled={busy}>
                <span>{busy ? "Opening Stripe…" : "Continue with Stripe"}</span>
                {!busy && <ArrowRight size={18} />}
              </button>
            </form>

            {status && <div className={`connect-status connect-status-${statusKind}`} role={statusKind === "error" ? "alert" : "status"}>
              {statusKind === "success" ? <BadgeCheck size={19} /> : statusKind === "error" ? <LockKeyhole size={18} /> : <ShieldCheck size={18} />}
              <span>{status}</span>
            </div>}

            <div className="connect-security-note"><LockKeyhole size={16} /><span>Stripe handles identity checks and payout details. Wallmarkt never sees your bank information.</span></div>
            <p className="connect-terms">By continuing, you’ll be redirected to Stripe to complete your account setup.</p>
          </section>
        </div>
        <footer className="connect-footer"><a href="/">Wallmarkt</a><span>·</span><span>Buy and sell with your community</span></footer>
      </main>
    </div>
  );
}
