import { ArrowLeft, CircleX } from "lucide-react";

export default function CheckoutCancelledPage() {
  return (
    <main className="checkout-result-shell">
      <header className="checkout-result-topbar">
        <a className="brand" href="/"><span className="brand-mark">W</span><span className="brand-name">Wallmarkt</span></a>
      </header>
      <section className="checkout-result-card">
        <div className="checkout-result-icon is-cancelled"><CircleX size={34} /></div>
        <span className="connect-card-kicker">WALLMARKT PAYMENTS</span>
        <h1>Checkout was cancelled</h1>
        <p className="checkout-result-message">No payment was taken. You can return to the marketplace and try again.</p>
        <a href="/" className="checkout-back-link"><ArrowLeft size={16} /> Back to Marketplace</a>
      </section>
      <footer className="connect-footer"><span>Wallmarkt</span><span>·</span><span>Buy and sell with your community</span></footer>
    </main>
  );
}
