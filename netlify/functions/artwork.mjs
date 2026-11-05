/* Lets the Pacific Paper Cups team download a customer's logo or mockup from the link in the Stripe order. */
import { getStore } from "@netlify/blobs";

export default async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  const file = url.searchParams.get("file") === "mockup" ? "mockup" : "logo";
  if (!/^[a-f0-9-]{20,60}$/.test(id)) return new Response("Not found", { status: 404 });
  const found = await getStore("artwork").getWithMetadata(`${id}/${file}`, { type: "arrayBuffer" });
  if (!found) return new Response("Not found", { status: 404 });
  const meta = found.metadata || {};
  const name = String(meta.name || file).replace(/"/g, "");
  return new Response(found.data, {
    headers: {
      "content-type": meta.type || "application/octet-stream",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "private, max-age=0"
    }
  });
};

export const config = { path: "/api/artwork" };
