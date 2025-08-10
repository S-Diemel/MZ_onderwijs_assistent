// netlify/functions/download-citation.js
import { getStore } from "@netlify/blobs";

export const config = {
  path: "/api/citations/:fn", // pretty URL => /api/citations/myfile.pdf
};

export default async (req, ctx) => {
  const NETLIFY_SITE_ID = process.env.NETLIFY_SITE_ID;
  const NETLIFY_AUTH_TOKEN = process.env.NETLIFY_AUTH_TOKEN;
  const { fn } = ctx.params;
  const store = getStore({name: "citations"}); // your store name

  // Stream the blob + fetch metadata (like content type) in one go
  const found = await store.getWithMetadata(fn, { type: "stream" });
  if (!found) {
    return new Response("Not found", { status: 404 });
  }

  const { data, metadata } = found;
  const contentType = metadata?.contentType || "application/octet-stream";
  const filename = metadata?.filename || fn;

  return new Response(data, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
};
