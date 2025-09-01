
import {createRequire as ___nfyCreateRequire} from "module";
import {fileURLToPath as ___nfyFileURLToPath} from "url";
import {dirname as ___nfyPathDirname} from "path";
let __filename=___nfyFileURLToPath(import.meta.url);
let __dirname=___nfyPathDirname(___nfyFileURLToPath(import.meta.url));
let require=___nfyCreateRequire(import.meta.url);


// netlify/functions/download-citation.js
import { getStore } from "@netlify/blobs";
var config = {
  path: "/api/citations/:fn"
  // pretty URL => /api/citations/myfile.pdf
};
var download_citation_default = async (req, ctx) => {
  const NETLIFY_SITE_ID = process.env.NETLIFY_SITE_ID;
  const NETLIFY_AUTH_TOKEN = process.env.NETLIFY_AUTH_TOKEN;
  const { fn } = ctx.params;
  const store = getStore({ name: "citations" });
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
      "Cache-Control": "private, max-age=0, must-revalidate"
    }
  });
};
export {
  config,
  download_citation_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibmV0bGlmeS9mdW5jdGlvbnMvZG93bmxvYWQtY2l0YXRpb24uanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8vIG5ldGxpZnkvZnVuY3Rpb25zL2Rvd25sb2FkLWNpdGF0aW9uLmpzXHJcbmltcG9ydCB7IGdldFN0b3JlIH0gZnJvbSBcIkBuZXRsaWZ5L2Jsb2JzXCI7XHJcblxyXG5leHBvcnQgY29uc3QgY29uZmlnID0ge1xyXG4gIHBhdGg6IFwiL2FwaS9jaXRhdGlvbnMvOmZuXCIsIC8vIHByZXR0eSBVUkwgPT4gL2FwaS9jaXRhdGlvbnMvbXlmaWxlLnBkZlxyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgYXN5bmMgKHJlcSwgY3R4KSA9PiB7XHJcbiAgY29uc3QgTkVUTElGWV9TSVRFX0lEID0gcHJvY2Vzcy5lbnYuTkVUTElGWV9TSVRFX0lEO1xyXG4gIGNvbnN0IE5FVExJRllfQVVUSF9UT0tFTiA9IHByb2Nlc3MuZW52Lk5FVExJRllfQVVUSF9UT0tFTjtcclxuICBjb25zdCB7IGZuIH0gPSBjdHgucGFyYW1zO1xyXG4gIGNvbnN0IHN0b3JlID0gZ2V0U3RvcmUoe25hbWU6IFwiY2l0YXRpb25zXCJ9KTsgLy8geW91ciBzdG9yZSBuYW1lXHJcblxyXG4gIC8vIFN0cmVhbSB0aGUgYmxvYiArIGZldGNoIG1ldGFkYXRhIChsaWtlIGNvbnRlbnQgdHlwZSkgaW4gb25lIGdvXHJcbiAgY29uc3QgZm91bmQgPSBhd2FpdCBzdG9yZS5nZXRXaXRoTWV0YWRhdGEoZm4sIHsgdHlwZTogXCJzdHJlYW1cIiB9KTtcclxuICBpZiAoIWZvdW5kKSB7XHJcbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKFwiTm90IGZvdW5kXCIsIHsgc3RhdHVzOiA0MDQgfSk7XHJcbiAgfVxyXG5cclxuICBjb25zdCB7IGRhdGEsIG1ldGFkYXRhIH0gPSBmb3VuZDtcclxuICBjb25zdCBjb250ZW50VHlwZSA9IG1ldGFkYXRhPy5jb250ZW50VHlwZSB8fCBcImFwcGxpY2F0aW9uL29jdGV0LXN0cmVhbVwiO1xyXG4gIGNvbnN0IGZpbGVuYW1lID0gbWV0YWRhdGE/LmZpbGVuYW1lIHx8IGZuO1xyXG5cclxuICByZXR1cm4gbmV3IFJlc3BvbnNlKGRhdGEsIHtcclxuICAgIGhlYWRlcnM6IHtcclxuICAgICAgXCJDb250ZW50LVR5cGVcIjogY29udGVudFR5cGUsXHJcbiAgICAgIFwiQ29udGVudC1EaXNwb3NpdGlvblwiOiBgYXR0YWNobWVudDsgZmlsZW5hbWU9XCIke2VuY29kZVVSSUNvbXBvbmVudChmaWxlbmFtZSl9XCJgLFxyXG4gICAgICBcIkNhY2hlLUNvbnRyb2xcIjogXCJwcml2YXRlLCBtYXgtYWdlPTAsIG11c3QtcmV2YWxpZGF0ZVwiLFxyXG4gICAgfSxcclxuICB9KTtcclxufTtcclxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7OztBQUNBLFNBQVMsZ0JBQWdCO0FBRWxCLElBQU0sU0FBUztBQUFBLEVBQ3BCLE1BQU07QUFBQTtBQUNSO0FBRUEsSUFBTyw0QkFBUSxPQUFPLEtBQUssUUFBUTtBQUNqQyxRQUFNLGtCQUFrQixRQUFRLElBQUk7QUFDcEMsUUFBTSxxQkFBcUIsUUFBUSxJQUFJO0FBQ3ZDLFFBQU0sRUFBRSxHQUFHLElBQUksSUFBSTtBQUNuQixRQUFNLFFBQVEsU0FBUyxFQUFDLE1BQU0sWUFBVyxDQUFDO0FBRzFDLFFBQU0sUUFBUSxNQUFNLE1BQU0sZ0JBQWdCLElBQUksRUFBRSxNQUFNLFNBQVMsQ0FBQztBQUNoRSxNQUFJLENBQUMsT0FBTztBQUNWLFdBQU8sSUFBSSxTQUFTLGFBQWEsRUFBRSxRQUFRLElBQUksQ0FBQztBQUFBLEVBQ2xEO0FBRUEsUUFBTSxFQUFFLE1BQU0sU0FBUyxJQUFJO0FBQzNCLFFBQU0sY0FBYyxVQUFVLGVBQWU7QUFDN0MsUUFBTSxXQUFXLFVBQVUsWUFBWTtBQUV2QyxTQUFPLElBQUksU0FBUyxNQUFNO0FBQUEsSUFDeEIsU0FBUztBQUFBLE1BQ1AsZ0JBQWdCO0FBQUEsTUFDaEIsdUJBQXVCLHlCQUF5QixtQkFBbUIsUUFBUSxDQUFDO0FBQUEsTUFDNUUsaUJBQWlCO0FBQUEsSUFDbkI7QUFBQSxFQUNGLENBQUM7QUFDSDsiLAogICJuYW1lcyI6IFtdCn0K
