# Wallmarkt

A neighborhood marketplace built with Next.js 15, React 19, Tailwind CSS 4, and shadcn/ui conventions.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Browse categories, search listings, change the sort order, and save items with the heart button.

Product photos are served by Unsplash. The listing data is sample content in `src/app/page.tsx`.

## Supabase listings

Copy `.env.example` to `.env.local` and set your Supabase project URL and anon key. Run `supabase/schema.sql` in the Supabase SQL Editor to create the listings table, storage bucket, and public listing policies. Restart the development server, then use **Create new listing** to upload a photo and publish a listing.

Buyer messages are saved in the `messages` table created by the same SQL file. The current message form stores messages in Supabase without sending email notifications.

## Stripe Connect and Buy Now

Run the updated `supabase/schema.sql` to add listing status/reservation fields, the private `seller_connections` mapping, private `orders`, and the checkout RPCs. Configure `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` in `.env.local`; all three must remain server-side. Sellers can visit `/connect`, enter the same email used on their listings, and complete Stripe Express onboarding through Accounts v2. Existing and future listings with that email show **Buy now** after Stripe enables card payments. Checkout creates a direct charge on the seller's connected account and applies a 10% platform fee.

Run `node --env-file=.env.local scripts/create-webhook.mjs` once to register or update the Connect webhook at the public Vercel URL. It listens for Checkout completion, expiration, and connected-account updates. The signing secret is printed only when a new endpoint is created; updating an existing endpoint preserves its secret. The webhook marks paid orders, marks listings sold, and releases expired reservations. Buyers are redirected to `/checkout/success`, which waits for the webhook-confirmed order.

The current email-only flow does not verify mailbox ownership. Anyone who knows a seller's listing email can start or resume onboarding for that email. Add an email verification step before using this flow with real sellers or live payments. Stripe account links expire and may be requested again from `/connect`.
