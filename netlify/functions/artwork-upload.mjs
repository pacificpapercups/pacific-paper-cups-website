/* Saves a customer's logo file and preview mockup so they travel with the order.
   Files are kept in Netlify Blobs under a random id. */
import { getStore } from "@netlify/blobs";

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const MAX_BYTES = 5 * 1024 * 1024;
const OK_TYPES = /^image\/(png|jpeg|svg\+xml|webp|gif)$/;

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let form;
  try { form = await req.formData(); } catch { return json({ error: "Upload failed" }, 400); }
  const logo = form.get("logo");
  const mockup = form.get("mockup");
  if (!logo || typeof logo === "string") return json({ error: "Missing logo file" }, 400);
  if (!OK_TYPES.test(logo.type || "")) return json({ error: "Logo must be a PNG, JPG, SVG, WEBP, or GIF image" }, 400);
  if (logo.size + (mockup && mockup.size ? mockup.size : 0) > MAX_BYTES) {
    return json({ error: "Your logo file is too large. Please use a file under 4 MB." }, 413);
  }

  const id = crypto.randomUUID();
  const store = getStore("artwork");
  const name = String(form.get("name") || logo.name || "logo").replace(/[^\w.\- ]+/g, "").slice(0, 80) || "logo";
  await store.set(`${id}/logo`, await logo.arrayBuffer(), { metadata: { name, type: logo.type } });
  if (mockup && typeof mockup !== "string" && mockup.size) {
    await store.set(`${id}/mockup`, await mockup.arrayBuffer(), { metadata: { name: "mockup.png", type: mockup.type || "image/png" } });
  }
  return json({ id });
};

export const config = { path: "/api/artwork-upload" };
