/* Returns live shipping options for the cart and address entered on the cart page */
import { cleanAddress } from "../lib/catalog.mjs";
import { getRates, RateError } from "../lib/rates.mjs";

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const address = cleanAddress(body.address);
  if (!address) return json({ error: "Please fill in your full shipping address." }, 400);
  const lines = Array.isArray(body.lines) ? body.lines.slice(0, 40) : [];
  if (!lines.length) return json({ error: "Your cart is empty." }, 400);
  try {
    const options = await getRates(address, lines);
    return json({ options: options.map(({ id, label, days, amount }) => ({ id, label, days, amount })) });
  } catch (err) {
    if (err instanceof RateError) return json({ error: err.message }, 400);
    console.error("shipping-rates", err);
    return json({ error: "We couldn't get shipping rates right now. Please try again." }, 500);
  }
};

export const config = { path: "/api/shipping-rates" };
