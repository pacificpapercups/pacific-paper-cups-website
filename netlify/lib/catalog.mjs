/* Prices the checkout server trusts. Keep these in sync with CATALOG in shop.js (prices are per case, in dollars). */
export const CATALOG = {
  cups: {
    name: "Custom Paper Cups",
    sizes: {
      "8oz":  { label: "8 oz",  casePack: 1000, plain: 40, printed: 120 },
      "12oz": { label: "12 oz", casePack: 1000, plain: 45, printed: 130 },
      "14oz": { label: "14 oz", casePack: 1000, plain: 50, printed: 140 }
    }
  },
  flat: {
    name: "Flat Top Container",
    sizes: {
      "50oz": { label: "50 oz", casePack: 150, plain: 45, printed: 55 },
      "75oz": { label: "75 oz", casePack: 120, plain: 45, printed: 55 }
    }
  },
  bags: {
    name: "Kraft Paper Bags",
    sizes: {
      small:  { label: "Small",  casePack: 250, plain: 67.5, printed: 82.5 },
      medium: { label: "Medium", casePack: 250, plain: 70,   printed: 90 },
      large:  { label: "Large",  casePack: 250, plain: 75,   printed: 100 }
    }
  }
};

/* Delivery options. Keep in sync with SHIPPING in shop.js. */
export const PICKUP_ADDRESS = "5800 S Hoover St, Los Angeles, CA 90044";
export const SHIPPING = {
  pickup: { label: "Free pickup", detail: "Pick up at " + PICKUP_ADDRESS, perCase: 0 },
  la:     { label: "Free local delivery", detail: "Los Angeles County", perCase: 0 },
  us:     { label: "Standard shipping", detail: "Anywhere in the U.S.", perCase: 15 }
};

/* Los Angeles County ZIP codes start with 900-908, 910-918, or 935 */
export function isLAZip(zip) {
  const z = String(zip || "").trim();
  if (!/^\d{5}$/.test(z)) return false;
  const p = Number(z.slice(0, 3));
  return (p >= 900 && p <= 908) || (p >= 910 && p <= 918) || p === 935;
}
