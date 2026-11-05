/* Starts a Stripe Checkout session for the cart.
   Prices come from netlify/lib/catalog.mjs, never from the browser.
   Needs the STRIPE_SECRET_KEY environment variable in Netlify. */
import { CATALOG, SHIPPING, isLAZip, PICKUP_ADDRESS } from "../lib/catalog.mjs";

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

/* Stripe's API takes form encoding with bracket keys, e.g. line_items[0][quantity]=2 */
function encode(obj, prefix, out) {
  out = out || new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") encode(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

const cut = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
const ART_ID = /^[a-f0-9-]{20,60}$/;

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return json({ error: "Online checkout isn't set up yet. Please request a quote instead." }, 500);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }

  const lines = Array.isArray(body.lines) ? body.lines.slice(0, 40) : [];
  if (!lines.length) return json({ error: "Your cart is empty." }, 400);

  const origin = new URL(req.url).origin;
  const lineItems = [];
  const metadata = {};
  let cases = 0, artCount = 0;

  for (const [n, l] of lines.entries()) {
    const p = CATALOG[l.id];
    const s = p && p.sizes[l.size];
    const finish = l.finish === "printed" ? "printed" : "plain";
    const qty = Math.floor(Number(l.qty));
    if (!s || !(qty >= 1 && qty <= 999)) return json({ error: "Something in your cart is no longer available. Please refresh the cart." }, 400);
    const price = s[finish];
    if (price == null) return json({ error: "One item needs a quote. Please remove it or request a quote." }, 400);
    cases += qty;

    let desc = `${s.casePack.toLocaleString("en-US")} per case, ${finish === "printed" ? "custom print" : "plain"}`;
    let summary = `${p.name}, ${s.label}, ${finish}, ${qty} case${qty === 1 ? "" : "s"} @ $${price.toFixed(2)}`;
    if (finish === "printed" && l.art && ART_ID.test(l.art)) {
      artCount += 1;
      const logoUrl = `${origin}/api/artwork?id=${l.art}&file=logo`;
      const mockUrl = `${origin}/api/artwork?id=${l.art}&file=mockup`;
      desc += ". Your artwork is attached to this order.";
      summary += ` | logo: ${cut(l.logoName, 60)}`;
      if (artCount <= 15) {
        metadata[`art_${artCount}_logo`] = logoUrl;
        metadata[`art_${artCount}_mockup`] = mockUrl;
      }
    } else if (finish === "printed") {
      desc += ". We'll contact you for artwork.";
    }
    if (n < 15) metadata[`item_${n + 1}`] = cut(summary, 490);

    lineItems.push({
      quantity: qty,
      price_data: {
        currency: "usd",
        unit_amount: Math.round(price * 100),
        product_data: { name: `${p.name}, ${s.label}${finish === "printed" ? " (Custom Print)" : ""}`, description: desc }
      }
    });
  }

  const method = SHIPPING[body.delivery] ? body.delivery : null;
  if (!method) return json({ error: "Please choose pickup or delivery." }, 400);
  const zip = cut(body.zip, 10);
  if (method === "la" && !isLAZip(zip)) {
    return json({ error: "Free local delivery is for Los Angeles County ZIP codes. Please choose pickup or standard shipping." }, 400);
  }
  const ship = SHIPPING[method];
  const shipCents = Math.round(ship.perCase * cases * 100);

  metadata.delivery = ship.label + (method === "pickup" ? ` (${PICKUP_ADDRESS})` : "");
  if (zip) metadata.delivery_zip = zip;
  if (body.notes) metadata.notes = cut(body.notes, 490);
  metadata.source = "pacificpapercups.com";

  const params = {
    mode: "payment",
    line_items: lineItems,
    success_url: `${origin}/order-success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/cart.html`,
    phone_number_collection: { enabled: true },
    billing_address_collection: "auto",
    custom_fields: [
      { key: "company", label: { type: "custom", custom: "Company name" }, type: "text", optional: true }
    ],
    shipping_options: [{
      shipping_rate_data: {
        type: "fixed_amount",
        display_name: ship.label + (method === "pickup" ? " at 5800 S Hoover St, LA" : ""),
        fixed_amount: { amount: shipCents, currency: "usd" }
      }
    }],
    metadata,
    payment_intent_data: { description: "Website order", metadata }
  };
  if (method !== "pickup") params.shipping_address_collection = { allowed_countries: ["US"] };

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: encode(params)
  });
  const session = await res.json();
  if (!res.ok) {
    console.error("Stripe error", session && session.error);
    return json({ error: "We couldn't start checkout. Please try again in a moment." }, 502);
  }
  return json({ url: session.url });
};

export const config = { path: "/api/checkout" };
