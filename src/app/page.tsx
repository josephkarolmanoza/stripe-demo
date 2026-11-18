"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  Bell,
  ChevronDown,
  CircleUserRound,
  Heart,
  House,
  ImagePlus,
  MapPin,
  Menu,
  Search,
  SlidersHorizontal,
  Store,
  UsersRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

const categories = [
  "Vehicles", "Property Rentals", "Apparel", "Classifieds", "Electronics",
  "Entertainment", "Family", "Free Stuff", "Garden & Outdoor", "Hobbies",
  "Home Goods", "Home Improvement", "Home Sales", "Musical Instruments",
  "Office Supplies", "Pet Supplies", "Sporting Goods", "Toys & Games",
  "Buy and sell groups",
];

const listings = [
  { title: "iPhone 15 Pro · 256GB", price: "$780", place: "Palo Alto, CA", category: "Electronics", image: "photo-1592750475338-74b7b21085ab", tag: "Like new" },
  { title: "Vintage film camera", price: "$240", place: "Mountain View, CA", category: "Electronics", image: "photo-1516035069371-29a1b244cc32", tag: "Vintage find" },
  { title: "Studio headphones", price: "$115", place: "Redwood City, CA", category: "Electronics", image: "photo-1505740420928-5e560c06d30e", tag: "Great sound" },
  { title: "Mechanical keyboard", price: "$85", place: "Palo Alto, CA", category: "Electronics", image: "photo-1587829741301-dc798b83add3", tag: "Popular" },
  { title: "Instant camera bundle", price: "$95", place: "Menlo Park, CA", category: "Electronics", image: "photo-1516035069371-29a1b244cc32", tag: "Ready to use" },
  { title: "Minimal desk lamp", price: "$42", place: "Palo Alto, CA", category: "Home Goods", image: "photo-1507473885765-e6ed057f782c", tag: "Good condition" },
  { title: "Weekend road bike", price: "$320", place: "Stanford, CA", category: "Sporting Goods", image: "photo-1485965120184-e220f721d03e", tag: "Recently tuned" },
  { title: "Leather crossbody bag", price: "$68", place: "Palo Alto, CA", category: "Apparel", image: "photo-1548036328-c9fa89d128fa", tag: "Gently used" },
  { title: "Ceramic coffee set", price: "$36", place: "Los Altos, CA", category: "Home Goods", image: "photo-1514228742587-6b1558fcca3d", tag: "Handmade" },
  { title: "Portable bluetooth speaker", price: "$55", place: "Palo Alto, CA", category: "Electronics", image: "photo-1608043152269-423dbba4e7e1", tag: "Great condition" },
  { title: "Canvas weekend tote", price: "$28", place: "Mountain View, CA", category: "Apparel", image: "photo-1590874103328-eac38a683ce7", tag: "Local favorite" },
  { title: "Indoor olive tree", price: "$60", place: "Palo Alto, CA", category: "Garden & Outdoor", image: "photo-1501004318641-b39e6451bec6", tag: "Healthy & happy" },
  { title: "Instant film camera", price: "$74", place: "Sunnyvale, CA", category: "Electronics", image: "photo-1452780212940-6f5c0d14d848", tag: "Film included" },
  { title: "Woven lounge chair", price: "$180", place: "Palo Alto, CA", category: "Home Goods", image: "photo-1503602642458-232111445657", tag: "Pickup today" },
  { title: "Compact espresso maker", price: "$95", place: "Los Altos, CA", category: "Home Goods", image: "photo-1495474472287-4d71bcdd2085", tag: "Coffee ready" },
];

type Listing = {
  id?: string;
  title: string;
  price: string;
  place: string;
  category: string;
  image?: string;
  photoUrl?: string;
  tag: string;
  description?: string;
  email?: string;
  createdAt?: string;
  listedAt?: string;
  status?: "active" | "reserved" | "sold";
  reservedUntil?: string | null;
};

type SupabaseListingRow = {
  id: string;
  title: string;
  description: string;
  price: number | string;
  email: string;
  category: string;
  photo_url: string;
  created_at: string;
  status?: Listing["status"] | null;
  reserved_until?: string | null;
};


const sampleListingAges = ["Just now", "18 minutes ago", "2 hours ago", "5 hours ago", "Yesterday", "2 days ago", "3 days ago", "4 days ago", "1 week ago", "2 weeks ago", "2 weeks ago", "3 weeks ago", "3 weeks ago", "1 month ago", "1 month ago"];
const sampleListings: Listing[] = listings.map((item, index) => ({ ...item, listedAt: sampleListingAges[index] }));

function formatTimeAgo(timestamp?: string) {
  if (!timestamp) return "Just now";
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60_000));
  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes} ${elapsedMinutes === 1 ? "minute" : "minutes"} ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} ${elapsedHours === 1 ? "hour" : "hours"} ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) return `${elapsedDays} ${elapsedDays === 1 ? "day" : "days"} ago`;
  const elapsedWeeks = Math.floor(elapsedDays / 7);
  if (elapsedWeeks < 5) return `${elapsedWeeks} ${elapsedWeeks === 1 ? "week" : "weeks"} ago`;
  const elapsedMonths = Math.floor(elapsedDays / 30);
  return `${elapsedMonths} ${elapsedMonths === 1 ? "month" : "months"} ago`;
}

function ProductCard({ item, onOpen }: { item: Listing; onOpen: (item: Listing, source: HTMLElement) => void }) {
  const [saved, setSaved] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const isReserved = item.status === "reserved" && Boolean(item.reservedUntil) && new Date(item.reservedUntil as string).getTime() > Date.now();

  return (
    <article ref={cardRef} className="product-card">
      <div className="product-image-wrap">
        <button className="product-image-trigger" onClick={() => cardRef.current && onOpen(item, cardRef.current)} aria-label={`View ${item.title}`}>
          <img
            src={item.photoUrl ?? `https://images.unsplash.com/${item.image}?auto=format&fit=crop&w=760&q=85`}
            alt={item.title}
            className="product-image"
            loading="lazy"
          />
        </button>
        {(item.status === "sold" || isReserved) && <span className={cn("listing-state-badge", item.status === "sold" ? "is-sold" : "is-reserved")}>{item.status === "sold" ? "Sold" : "Reserved"}</span>}
        <button
          className={cn("save-button", saved && "is-saved")}
          onClick={() => setSaved(!saved)}
          aria-label={saved ? "Remove from saved items" : "Save item"}
        >
          <Heart size={19} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <button className="product-copy product-open-copy" onClick={() => cardRef.current && onOpen(item, cardRef.current)} aria-label={`View details for ${item.title}`}>
        <div className="product-price">{item.price}</div>
        <h3>{item.title}</h3>
        <p>{item.place} · {item.listedAt ?? formatTimeAgo(item.createdAt)}</p>
      </button>
    </article>
  );
}

function ListingModal({ item, sourceElement, onClose }: { item: Listing; sourceElement: HTMLElement | null; onClose: () => void }) {
  const [messageFormOpen, setMessageFormOpen] = useState(false);
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerMessage, setBuyerMessage] = useState("");
  const [messageStatus, setMessageStatus] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sellerCanAcceptPayments, setSellerCanAcceptPayments] = useState(false);
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const modalRef = useRef<HTMLElement>(null);
  const isSold = item.status === "sold";
  const isReserved = item.status === "reserved" && Boolean(item.reservedUntil) && new Date(item.reservedUntil as string).getTime() > Date.now();

  useEffect(() => {
    if (!item.email || !item.id || isSold || isReserved) return;
    let active = true;
    fetch(`/api/stripe/seller-status?email=${encodeURIComponent(item.email)}`)
      .then((response) => response.json())
      .then((data) => { if (active) setSellerCanAcceptPayments(Boolean(data.connected)); })
      .catch(() => { if (active) setSellerCanAcceptPayments(false); });
    return () => { active = false; };
  }, [item.email, item.id, isSold, isReserved]);

  async function handleBuyNow() {
    if (!item.id) return;
    setStartingCheckout(true);
    setCheckoutError("");
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId: item.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start checkout.");
      window.location.assign(data.url);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Could not start checkout.");
      setStartingCheckout(false);
    }
  }

  async function handleSendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessageStatus("");
    if (!supabase) {
      setMessageStatus("Supabase is not configured. Add the project URL and publishable key, then restart the app.");
      return;
    }

    setSendingMessage(true);
    const normalizedBuyerEmail = buyerEmail.trim().toLowerCase();
    const trimmedMessage = buyerMessage.trim();
    try {
      const { error } = await supabase.from("messages").insert({
        listing_id: item.id ?? null,
        listing_title: item.title,
        seller_email: item.email ?? null,
        buyer_email: normalizedBuyerEmail,
        message: trimmedMessage,
      });
      if (error) throw error;

      setBuyerMessage("");
      setMessageStatus("Message saved.");
    } catch (submitError) {
      setMessageStatus(submitError instanceof Error ? submitError.message : "Could not save your message. Please try again.");
    } finally {
      setSendingMessage(false);
    }
  }

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !sourceElement || !modalRef.current) return;
    const source = sourceElement.getBoundingClientRect();
    const target = modalRef.current.getBoundingClientRect();
    const translateX = source.left - target.left;
    const translateY = source.top - target.top;
    const scaleX = source.width / target.width;
    const scaleY = source.height / target.height;
    const startTransform = `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`;
    const animation = modalRef.current.animate(
      [{ transform: startTransform }, { transform: "translate(0, 0) scale(1, 1)" }],
      { duration: 440, easing: "cubic-bezier(.2,.75,.2,1)", fill: "both" },
    );
    return () => animation.cancel();
  }, [sourceElement]);

  const closeWithAnimation = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onClose();
      return;
    }
    const modal = modalRef.current;
    if (!modal || !sourceElement?.isConnected) {
      onClose();
      return;
    }
    const source = sourceElement.getBoundingClientRect();
    const target = modal.getBoundingClientRect();
    const closeTransform = `translate(${source.left - target.left}px, ${source.top - target.top}px) scale(${source.width / target.width}, ${source.height / target.height})`;
    const currentTransform = getComputedStyle(modal).transform;
    const animation = modal.animate(
      [{ transform: currentTransform === "none" ? "translate(0, 0) scale(1, 1)" : currentTransform }, { transform: closeTransform }],
      { duration: 360, easing: "cubic-bezier(.2,.75,.2,1)", fill: "both" },
    );
    animation.onfinish = onClose;
  }, [isClosing, onClose, sourceElement]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeWithAnimation();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeWithAnimation]);

  return (
    <div className={cn("modal-backdrop", isClosing && "is-closing")} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeWithAnimation(); }}>
      <section ref={modalRef} className={cn("listing-modal", isClosing && "is-closing")} role="dialog" aria-modal="true" aria-labelledby="listing-modal-title">
        <div className="modal-photo">
          <img src={item.photoUrl ?? `https://images.unsplash.com/${item.image}?auto=format&fit=crop&w=1500&q=90`} alt={item.title} />
          <button className="modal-close" onClick={closeWithAnimation} aria-label="Close listing details" autoFocus><X size={21} /></button>
          <span className="photo-count">1 / 1</span>
        </div>
        <div className="modal-details">
          <div className="modal-breadcrumb">Marketplace <span>·</span> {item.category}</div>
          <div className="modal-price">{item.price}</div>
          <h2 id="listing-modal-title">{item.title}</h2>
          <div className="modal-location"><MapPin size={15} /> {item.place} <span>·</span> Listed {item.listedAt ?? formatTimeAgo(item.createdAt)}</div>
          <div className="modal-condition"><span>Condition</span><strong>{item.tag}</strong></div>
          {isSold && <div className="listing-modal-state is-sold">This item has been sold.</div>}
          {isReserved && <div className="listing-modal-state is-reserved">Someone is checking out this item. Please check back shortly.</div>}
          <div className="modal-divider" />
          <h3>Description</h3>
          <p className="modal-description">{item.description || `${item.title} in ${item.tag.toLowerCase()} condition. A great local find in ${item.category.toLowerCase()}, ready for its next home. Pickup available around ${item.place}.`}</p>
          <div className="seller-card">
            <div className="seller-avatar">W</div>
            <div><strong>{item.email || "Wallmarkt neighbor"}</strong><span>Local seller · Joined recently</span></div>
          </div>
          {sellerCanAcceptPayments && !isSold && !isReserved && <Button className="message-seller" onClick={handleBuyNow} disabled={startingCheckout}>{startingCheckout ? "Opening checkout…" : "Buy now"}</Button>}
          {checkoutError && <p className="message-notice" role="alert">{checkoutError}</p>}
          {!messageFormOpen ? (
            <Button className="message-seller" onClick={() => setMessageFormOpen(true)}>Message seller</Button>
          ) : (
            <form className="message-compose" onSubmit={handleSendMessage}>
              <label className="form-field">Your email<input type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" value={buyerEmail} onChange={(event) => setBuyerEmail(event.target.value)} /></label>
              <label className="form-field">Message<textarea required minLength={2} maxLength={2000} rows={4} placeholder={`Hi, is ${item.title} still available?`} value={buyerMessage} onChange={(event) => setBuyerMessage(event.target.value)} /></label>
              {messageStatus && <p className="message-notice" role="status">{messageStatus}</p>}
              <Button className="message-seller" type="submit" disabled={sendingMessage}>{sendingMessage ? "Sending…" : "Send message"}</Button>
            </form>
          )}
          <p className="safety-note">Meet in a public place and review the item before you buy.</p>
        </div>
      </section>
    </div>
  );
}

function CreateListingModal({ onClose, onCreated }: { onClose: () => void; onCreated: (listing: Listing) => void }) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ title: "", description: "", price: "", email: "", category: "" });

  useEffect(() => {
    if (!photo) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, saving]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!supabase) {
      setError("Supabase is not configured yet. Add your project URL and anon key to .env.local, then restart the app.");
      return;
    }
    if (!photo) {
      setError("Choose a photo for your listing.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const extension = photo.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${crypto.randomUUID()}.${extension}`;
    setSaving(true);

    try {
      const { error: uploadError } = await supabase.storage
        .from("listing-photos")
        .upload(path, photo, { cacheControl: "3600", contentType: photo.type, upsert: false });
      if (uploadError) throw uploadError;

      const { data: photoData } = supabase.storage.from("listing-photos").getPublicUrl(path);
      const { data, error: insertError } = await supabase
        .from("listings")
        .insert({
          title: String(formData.get("title")).trim(),
          description: String(formData.get("description")).trim(),
          price: Number(formData.get("price")),
          email: String(formData.get("email")).trim().toLowerCase(),
          category: String(formData.get("category")),
          photo_url: photoData.publicUrl,
        })
        .select("id, title, description, price, email, category, photo_url, created_at")
        .single();
      if (insertError) throw insertError;

      onCreated({
        id: data.id,
        title: data.title,
        description: data.description,
        price: Number(data.price).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }),
        email: data.email,
        category: data.category,
        photoUrl: data.photo_url,
        createdAt: data.created_at,
        place: "Palo Alto, CA",
        tag: "New listing",
        status: "active",
        reservedUntil: null,
      });
    } catch (submitError) {
      const message = submitError instanceof Error
        ? submitError.message
        : submitError && typeof submitError === "object" && "message" in submitError && typeof submitError.message === "string"
          ? submitError.message
          : "Could not save the listing. Check your Supabase setup and try again.";
      setError(message);
      setSaving(false);
    }
  }

  return (
    <div className="create-listing-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section className="create-listing-dialog" role="dialog" aria-modal="true" aria-labelledby="create-listing-title">
        <div className="create-listing-header">
          <a className="create-brand" href="#" onClick={(event) => { event.preventDefault(); onClose(); }}><span className="brand-mark">W</span><strong>Wallmarkt</strong></a>
          <h2 id="create-listing-title">Create listing</h2>
          <button type="button" className="form-close" onClick={onClose} disabled={saving} aria-label="Close form"><X size={20} /></button>
        </div>
        <div className="create-listing-workspace">
        <form className="create-listing-form" onSubmit={handleSubmit}>
          <label className="form-field">Photos</label>
          <label className="photo-upload">
            {preview ? <img src={preview} alt="Listing photo preview" /> : <span className="photo-placeholder"><ImagePlus size={25} /><strong>Add a photo</strong><small>JPG, PNG, or WebP · up to 10 MB</small></span>}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (!file.type.startsWith("image/")) { setError("Choose an image file."); return; }
              if (file.size > 10 * 1024 * 1024) { setError("Photo must be 10 MB or smaller."); return; }
              setError("");
              setPhoto(file);
            }} />
          </label>
          <label className="form-field">Title *<input name="title" required maxLength={120} placeholder="What are you selling?" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
          <label className="form-field">Category *<select name="category" required value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}><option value="" disabled>Select a category</option>{categories.filter((name) => name !== "Buy and sell groups").map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
          <label className="form-field">Price *<span className="price-input"><b>$</b><input name="price" type="number" min="0" max="10000000" step="0.01" required placeholder="0.00" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} /></span></label>
          <label className="form-field">Location<input value="Palo Alto, CA" readOnly /></label>
          <label className="form-field">Contact Email *<input name="email" type="email" required maxLength={254} placeholder="you@example.com" autoComplete="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></label>
          <label className="form-field">Description<textarea name="description" maxLength={2000} rows={4} placeholder="Describe your item..." value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button type="submit" className="submit-listing" disabled={saving}>{saving ? "Saving listing…" : "Publish listing"}</Button>
        </form>
        <aside className="listing-preview"><h2>Preview</h2><article className="listing-preview-card"><div className="listing-preview-photo">{preview ? <img src={preview} alt="Preview of your listing" /> : <div className="preview-placeholder" />}</div><div className="listing-preview-copy"><h3>{draft.title || "Title"}</h3><strong>{draft.price ? Number(draft.price).toLocaleString("en-US", { style: "currency", currency: "USD" }) : "Price"}</strong><p>Listed just now<br />in Palo Alto, CA{draft.category ? ` · ${draft.category}` : ""}</p><b>Seller Information</b><p>{draft.email || "seller@email.com"}</p><div className="preview-description">{draft.description || "Your item description will appear here."}</div></div></article></aside>
        </div>
      </section>
    </div>
  );
}

export default function Home() {
  const [category, setCategory] = useState("All categories");
  const [query, setQuery] = useState("");
  const [sortNewest, setSortNewest] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [sourceElement, setSourceElement] = useState<HTMLElement | null>(null);
  const [createListingOpen, setCreateListingOpen] = useState(false);
  const [userListings, setUserListings] = useState<Listing[]>([]);
  const [listingLoadError, setListingLoadError] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setListingLoadError("Supabase isn’t configured. Add its public URL and key, then restart the app.");
      return;
    }
    let active = true;
    const loadListings = async () => {
      const currentResult = await client
        .from("listings")
        .select("id, title, description, price, email, category, photo_url, created_at, status, reserved_until")
        .order("created_at", { ascending: false });
      let rows = currentResult.data as SupabaseListingRow[] | null;
      let error = currentResult.error;

      // Older versions of this app have listings but predate the payment-state columns.
      // Retry with the original columns so existing marketplace posts stay visible.
      if (error?.code === "42703") {
        const legacyResult = await client
          .from("listings")
          .select("id, title, description, price, email, category, photo_url, created_at")
          .order("created_at", { ascending: false });
        rows = legacyResult.data as SupabaseListingRow[] | null;
        error = legacyResult.error;
      }

      if (!active) return;
      if (error || !rows) {
        console.error("Could not load marketplace listings:", error);
        setListingLoadError("We couldn’t load listings from Supabase. Check that the listings table is readable and try refreshing.");
        return;
      }
      setListingLoadError("");
      const loaded: Listing[] = rows.map((row) => ({
          id: row.id,
          title: row.title,
          description: row.description,
          price: Number(row.price).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }),
          email: row.email,
          category: row.category,
          photoUrl: row.photo_url,
          createdAt: row.created_at,
          place: "Palo Alto, CA",
          tag: "Local listing",
          status: row.status ?? "active",
          reservedUntil: row.reserved_until ?? null,
        }));
      setUserListings((current) => [...current, ...loaded.filter((listing) => !current.some((item) => item.id === listing.id))]);
    };
    void loadListings();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !accountMenuRef.current?.contains(event.target)) setAccountMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountMenuOpen]);

  const results = useMemo(() => {
    let items = [...userListings, ...sampleListings].filter((item) =>
      (category === "All categories" || item.category === category) &&
      `${item.title} ${item.category} ${item.place}`.toLowerCase().includes(query.toLowerCase()),
    );
    if (sortNewest) items = [...items].reverse();
    return items;
  }, [category, query, sortNewest, userListings]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <a href="#marketplace" className="brand" aria-label="Wallmarkt home">
            <span className="brand-mark">W</span>
            <span className="brand-name">Wallmarkt</span>
          </a>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? "Collapse filters" : "Expand filters"}
            aria-expanded={sidebarOpen}
            aria-controls="marketplace-sidebar"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={21} />}
          </button>
          <label className="search-box">
            <Search size={19} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Marketplace" aria-label="Search listings" />
          </label>
        </div>

        <nav className="main-nav" aria-label="Main navigation">
          <a href="#home" className="nav-item"><House size={22} /><span>Home</span></a>
          <a href="#marketplace" className="nav-item selected"><Store size={22} /><span>Marketplace</span></a>
          <a href="#groups" className="nav-item"><UsersRound size={22} /><span>Groups</span></a>
        </nav>

        <div className="account-actions">
          <Button className="sell-button" onClick={() => setCreateListingOpen(true)}>+ Create new listing</Button>
          <button className="round-action" aria-label="Notifications"><Bell size={19} /></button>
          <div className="account-menu-wrap" ref={accountMenuRef}>
            <button
              type="button"
              className="round-action account-button"
              aria-label="Profile options"
              aria-expanded={accountMenuOpen}
              aria-controls="profile-menu"
              onClick={() => setAccountMenuOpen((open) => !open)}
            ><CircleUserRound size={23} /></button>
            {accountMenuOpen && (
              <div className="account-menu" id="profile-menu" aria-label="Profile options">
                <span className="account-menu-title">Seller tools</span>
                <a className="account-menu-connect" href="/connect" onClick={() => setAccountMenuOpen(false)}>
                  <Store size={16} /><span>Connect with Stripe</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className={cn("marketplace-layout", !sidebarOpen && "sidebar-closed")} id="marketplace">
        {sidebarOpen && (
          <aside className="sidebar" id="marketplace-sidebar">
            <h1>Marketplace</h1>
            <div className="sidebar-search-label">Filters</div>
            <button className="location-filter">
              <span className="location-icon"><MapPin size={17} /></span>
              <span><strong>Palo Alto, California</strong><small>Within 15 miles</small></span>
              <ChevronDown size={16} className="location-chevron" />
            </button>
            <div className="sidebar-divider" />
            <div className="category-heading"><h2>Categories</h2><button onClick={() => setCategory("All categories")}>See all</button></div>
            <div className="category-list">
              <button className={cn("category-link", category === "All categories" && "active")} onClick={() => setCategory("All categories")}>
                <span className="category-glyph">⌂</span> All categories
              </button>
              {categories.map((name, index) => (
                <button key={name} onClick={() => setCategory(name)} className={cn("category-link", category === name && "active")}>
                  <span className={`category-glyph glyph-${index % 6}`}>{["▣", "⌂", "◇", "▤", "◉", "✦"][index % 6]}</span>{name}
                </button>
              ))}
            </div>
            <div className="sidebar-footer">Wallmarkt · Buy and sell locally</div>
          </aside>
        )}

        <section className="market-content">
          <div className="content-heading">
            <div>
              <div className="breadcrumb">Browse locally <span>›</span> {category === "All categories" ? "Marketplace" : category}</div>
              <h2>{category === "All categories" ? "Today's picks" : category}</h2>
              <p>Discover great finds from people near you.</p>
            </div>
            <Button variant="outline" className="listing-filter" onClick={() => setSortNewest(!sortNewest)}>
              <ArrowDownUp size={16} /> {sortNewest ? "Recently listed" : "Recommended"} <ChevronDown size={15} />
            </Button>
          </div>

          <div className="results-bar">
            <span>{results.length} items near Palo Alto</span>
            <button onClick={() => setSortNewest(!sortNewest)}><SlidersHorizontal size={15} /> Sort and filter</button>
          </div>

          {listingLoadError && <p className="listing-load-error" role="alert">{listingLoadError}</p>}

          {results.length ? (
            <div className="product-grid">{results.map((item) => <ProductCard key={item.title} item={item} onOpen={(listing, source) => { setSourceElement(source); setSelectedListing(listing); }} />)}</div>
          ) : (
            <div className="empty-state"><Search size={30} /><h3>No listings found</h3><p>Try another search or choose a different category.</p><Button variant="outline" onClick={() => { setQuery(""); setCategory("All categories"); }}>Clear search</Button></div>
          )}
        </section>
      </div>
      {selectedListing && <ListingModal key={selectedListing.id ?? selectedListing.title} item={selectedListing} sourceElement={sourceElement} onClose={() => { setSelectedListing(null); setSourceElement(null); }} />}
      {createListingOpen && <CreateListingModal onClose={() => setCreateListingOpen(false)} onCreated={(listing) => { setUserListings((current) => [listing, ...current]); setCategory("All categories"); setQuery(""); setCreateListingOpen(false); }} />}
    </main>
  );
}
