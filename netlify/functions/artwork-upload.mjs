/* Saves a customer's logo file and preview mockup so they travel with the order.
   The browser sends JSON with the files as base64 text (more reliable than multipart uploads on Netlify).
   Files are kept in Netlify Blobs under a random id. */
import { getStore } from "@netlify/blobs";

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const MAX_BYTES = 5 * 1024 * 1024;
const OK_TYPES = /^image\/(png|jpeg|svg\+xml|webp|gif)$/;

function decode(file) {
  if (!file || typeof file.data !== "string") return null;
  const type = String(file.type || "");
  const buf = Buffer.from(file.data, "base64");
  return buf.length ? { type, buf } : null;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body;
  try {
    body = await req.json();
  } catch (err) {
    console.error("artwork-upload: bad body", err && err.message);
    return json({ error: "Your logo couldn't be uploaded. Please try again." }, 400);
  }

  const logo = decode(body.logo);
  const mockup = decode(body.mockup);
  if (!logo) return json({ error: "Missing logo file." }, 400);
  if (!OK_TYPES.test(logo.type)) return json({ error: "Your logo must be a PNG, JPG, SVG, WEBP, or GIF image." }, 400);
  if (logo.buf.length + (mockup ? mockup.buf.length : 0) > MAX_BYTES) {
    return json({ error: "Your logo file is too large. Please use a file under 3 MB." }, 413);
  }

  try {
    const id = crypto.randomUUID();
    const store = getStore("artwork");
    const name = String(body.name || "logo").replace(/[^\w.\- ]+/g, "").slice(0, 80) || "logo";
    await store.set(`${id}/logo`, logo.buf.buffer.slice(logo.buf.byteOffset, logo.buf.byteOffset + logo.buf.length), { metadata: { name, type: logo.type } });
    if (mockup) {
      await store.set(`${id}/mockup`, mockup.buf.buffer.slice(mockup.buf.byteOffset, mockup.buf.byteOffset + mockup.buf.length), { metadata: { name: "mockup.png", type: mockup.type || "image/png" } });
    }
    return json({ id });
  } catch (err) {
    console.error("artwork-upload: storage error", err && err.message);
    return json({ error: "Your logo couldn't be saved. Please try again in a moment." }, 500);
  }
};

export const config = { path: "/api/artwork-upload" };
