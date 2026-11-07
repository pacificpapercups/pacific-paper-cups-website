/* Live carrier rates from Shippo for a cart and a ship-to address.
   Needs the SHIPPO_API_KEY environment variable in Netlify. */
import { CATALOG, SHIP_FROM, HANDLING_FEE, MAX_PARCEL_CASES, RATE_OPTIONS } from "./catalog.mjs";

export class RateError extends Error {}

/* One parcel per case, using the carton size and weight from the catalog */
export function parcelsFor(lines) {
  const parcels = [];
  for (const l of lines) {
    const s = CATALOG[l.id] && CATALOG[l.id].sizes[l.size];
    const qty = Math.floor(Number(l.qty));
    if (!s || !s.box || !(qty >= 1)) throw new RateError("Something in your cart can't be shipped. Please refresh the cart.");
    for (let i = 0; i < qty; i++) {
      parcels.push({
        length: String(s.box[0]), width: String(s.box[1]), height: String(s.box[2]), distance_unit: "in",
        weight: String(s.lb), mass_unit: "lb"
      });
    }
  }
  if (parcels.length > MAX_PARCEL_CASES) {
    throw new RateError(`Orders over ${MAX_PARCEL_CASES} cases ship by freight. Please request a quote and we'll send you a freight rate.`);
  }
  return parcels;
}

/* Returns up to RATE_OPTIONS cheapest services: [{ id, carrier, service, label, days, amount }] (amount in dollars) */
export async function getRates(address, lines) {
  const key = process.env.SHIPPO_API_KEY;
  if (!key) throw new RateError("Shipping rates aren't set up yet. Please choose pickup or request a quote.");
  const parcels = parcelsFor(lines);

  const res = await fetch("https://api.goshippo.com/shipments/", {
    method: "POST",
    headers: { Authorization: `ShippoToken ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      address_from: SHIP_FROM,
      address_to: {
        name: address.name, company: address.company, street1: address.street1, street2: address.street2,
        city: address.city, state: address.state, zip: address.zip, country: "US",
        phone: address.phone || undefined
      },
      parcels,
      async: false
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Shippo error", res.status, JSON.stringify(data).slice(0, 500));
    throw new RateError("We couldn't get shipping rates right now. Please try again in a moment.");
  }

  const seen = new Set();
  const options = (data.rates || [])
    .filter(r => r && r.currency === "USD" && Number(r.amount) > 0 && r.servicelevel && r.servicelevel.token)
    .map(r => ({
      id: `${r.provider}:${r.servicelevel.token}`,
      carrier: r.provider,
      service: r.servicelevel.name || r.servicelevel.token,
      days: Number(r.estimated_days) || null,
      amount: Math.round((Number(r.amount) + HANDLING_FEE) * 100) / 100
    }))
    .sort((a, b) => a.amount - b.amount)
    .filter(o => (seen.has(o.id) ? false : seen.add(o.id)))
    .slice(0, RATE_OPTIONS)
    .map(o => ({ ...o, label: `${o.carrier} ${o.service}`.replace(/\s+/g, " ").trim() }));

  if (!options.length) {
    const msg = (data.messages || []).map(m => m && m.text).filter(Boolean).join(" ").slice(0, 300);
    if (msg) console.error("Shippo messages", msg);
    throw new RateError("We couldn't find shipping rates for that address. Please double check it, or choose pickup.");
  }
  return options;
}
