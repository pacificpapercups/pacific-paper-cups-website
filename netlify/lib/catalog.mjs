/* Prices the checkout server trusts. Keep these in sync with CATALOG in shop.js (prices are per case, in dollars).
   box = shipping carton size in inches [length, width, height], lb = weight of one full case in pounds.
   Boxes come from the spec sheets. Cup and bag cartons are ESTIMATES: weigh and measure a real case and update them. */
export const CATALOG = {
  cups: {
    name: "Custom Paper Cups",
    sizes: {
      "8oz":  { label: "8 oz",  casePack: 1000, plain: 40, printed: 120, box: [18, 15, 18], lb: 15 },
      "12oz": { label: "12 oz", casePack: 1000, plain: 45, printed: 130, box: [20, 16, 22], lb: 21 },
      "14oz": { label: "14 oz", casePack: 1000, plain: 50, printed: 140, box: [20, 16, 24], lb: 23 }
    }
  },
  flat: {
    name: "Flat Top Container",
    sizes: {
      "50oz": { label: "50 oz", casePack: 150, plain: 45, printed: 55, box: [23, 20, 10], lb: 13.4 },
      "75oz": { label: "75 oz", casePack: 120, plain: 45, printed: 55, box: [23, 20, 10], lb: 13 }
    }
  },
  bags: {
    name: "Kraft Paper Bags",
    sizes: {
      small:  { label: "Small",  casePack: 250, plain: 67.5, printed: 82.5, box: [21, 13, 13], lb: 30 },
      medium: { label: "Medium", casePack: 250, plain: 70,   printed: 90, box: [23, 13, 15], lb: 36 },
      large:  { label: "Large",  casePack: 250, plain: 75,   printed: 100, box: [25, 16, 16], lb: 42 }
    }
  }
};

/* Delivery options. Keep labels in sync with shop.js. */
export const PICKUP_ADDRESS = "5800 S Hoover St, Los Angeles, CA 90044";
export const SHIPPING = {
  pickup: { label: "Free pickup" },
  la:     { label: "Free local delivery" },
  us:     { label: "Shipping" }
};

/* Where shipments leave from (used for live carrier rates) */
export const SHIP_FROM = {
  name: "Pacific Paper Cups & More",
  company: "Lezo Investment Group Inc",
  street1: "5800 S Hoover St",
  city: "Los Angeles",
  state: "CA",
  zip: "90044",
  country: "US",
  phone: "8185901573",
  email: "pacificpapercups@gmail.com"
};

/* Added on top of the carrier rate for each shipped order, in dollars. 0 = none. */
export const HANDLING_FEE = 0;
/* Orders bigger than this many cases need a freight quote instead of parcel shipping. */
export const MAX_PARCEL_CASES = 15;
/* How many of the cheapest carrier options to offer. */
export const RATE_OPTIONS = 3;

/* Los Angeles County ZIP codes start with 900-908, 910-918, or 935 */
export function isLAZip(zip) {
  const z = String(zip || "").trim();
  if (!/^\d{5}$/.test(z)) return false;
  const p = Number(z.slice(0, 3));
  return (p >= 900 && p <= 908) || (p >= 910 && p <= 918) || p === 935;
}

export const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

/* Cleans up a shipping address sent from the cart page. Returns null if something required is missing. */
export function cleanAddress(a) {
  if (!a || typeof a !== "object") return null;
  const t = (v, n) => String(v || "").replace(/\s+/g, " ").trim().slice(0, n);
  const out = {
    name: t(a.name, 80), company: t(a.company, 80), street1: t(a.street1, 100), street2: t(a.street2, 100),
    city: t(a.city, 60), state: t(a.state, 2).toUpperCase(), zip: t(a.zip, 5), phone: t(a.phone, 20).replace(/[^\d+()\- ]/g, "")
  };
  if (!out.name || !out.street1 || !out.city || !US_STATES.includes(out.state) || !/^\d{5}$/.test(out.zip)) return null;
  return out;
}
