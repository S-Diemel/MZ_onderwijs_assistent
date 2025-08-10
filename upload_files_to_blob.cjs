// upload-folder-to-blobs.js
require('dotenv').config();
const { readdir, readFile } = require("fs").promises;
const { join, relative } = require("path");
const { getStore } = require("@netlify/blobs");
const mime = require("mime-types");

function normalizeKey(k) {
  try { k = decodeURIComponent(k); } catch {}
  return k.replace(/\\/g, "/");
}
function baseNameFromKey(k) {
  const n = normalizeKey(k);
  return n.split("/").pop();
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...await walk(p));
    } else if (entry.isFile()) {
      out.push(p);
    }
  }
  return out;
}

async function listAll(store) {
  const items = [];
  let cursor;
  do {
    const page = await store.list({ cursor });
    for (const item of page.blobs || []) {
      items.push({
        key: item.key,
        normKey: normalizeKey(item.key),
        base: baseNameFromKey(item.key)
      });
    }
    cursor = page.cursor;
  } while (cursor);
  return items;
}

async function dedupeStoreByBasename(store, preferredPrefix = "") {
  const preferredPrefixNorm = preferredPrefix ? normalizeKey(preferredPrefix.replace(/\/?$/, "/")) : "";
  const items = await listAll(store);
  const groups = new Map();
  for (const it of items) {
    const arr = groups.get(it.base) || [];
    arr.push(it);
    groups.set(it.base, arr);
  }

  let deletions = 0;
  for (const [base, arr] of groups.entries()) {
    if (arr.length <= 1) continue;

    let keep = null;
    if (preferredPrefixNorm) {
      const underPref = arr.filter(it => it.normKey.startsWith(preferredPrefixNorm));
      if (underPref.length) {
        keep = underPref.sort((a, b) => a.normKey.length - b.normKey.length || a.normKey.localeCompare(b.normKey))[0];
      }
    }
    if (!keep) {
      keep = arr.sort((a, b) => a.normKey.length - b.normKey.length || a.normKey.localeCompare(b.normKey))[0];
    }

    for (const it of arr) {
      if (it.key === keep.key) continue;
      await store.delete(it.key);
      console.log(`[dedupe] Deleted duplicate "${base}": ${it.key}`);
      deletions++;
    }
    console.log(`[dedupe] Kept: ${keep.key}`);
  }
  console.log(`[dedupe] Deleted ${deletions} duplicate blobs.`);
}

async function removeBlobsNotInLocal(store, localFilesSet) {
  const allItems = await listAll(store);
  let removed = 0;
  for (const item of allItems) {
    const filename = item.base;
    if (!localFilesSet.has(filename)) {
      await store.delete(item.key);
      console.log(`[cleanup] Removed from blob (not in local): ${item.key}`);
      removed++;
    }
  }
  console.log(`[cleanup] Removed ${removed} blobs not in local folder.`);
}

async function main() {
  const [, , folderArg, storeName, prefixArg] = process.argv;
  if (!folderArg || !storeName) {
    console.error("Usage: node upload-folder-to-blobs.js <folder> <storeName> [prefix]");
    process.exit(1);
  }

  const root = folderArg;
  const prefix = prefixArg ?? "";
  const site_id = process.env.NETLIFY_SITE_ID
  const auth_token = process.env.NETLIFY_AUTH_TOKEN
  console.log(auth_token)
  const store = getStore({
    name: storeName,
    siteID: site_id,
    token:  auth_token,
  });

  // Scan local files first
  console.log(`Scanning local folder: ${root}`);
  const localFiles = await walk(root);
  const localFileNames = new Set(localFiles.map(p => p.split(/[/\\]/).pop()));
  console.log(`Found ${localFiles.length} local files.`);

  // Step 1: Deduplicate blobs
  console.log(`[step] Deduplicating blobs...`);
  await dedupeStoreByBasename(store, prefix);

  // Step 2: Remove blobs not in local
  console.log(`[step] Removing blobs not in local...`);
  await removeBlobsNotInLocal(store, localFileNames);

  // Step 3: Upload missing files
  console.log(`[step] Uploading missing files...`);
  const existingItems = await listAll(store);
  const existing = new Set(existingItems.map(it => it.normKey));

  let uploaded = 0, skipped = 0;
  for (const fullPath of localFiles) {
    const relKey = relative(root, fullPath).replace(/\\/g, "/");
    const key = prefix ? `${prefix.replace(/\/?$/, "/")}${relKey}` : relKey;
    const normKey = normalizeKey(key);

    if (existing.has(normKey)) {
      skipped++;
      continue;
    }

    const buf = await readFile(fullPath);
    const contentType = mime.lookup(fullPath) || "application/octet-stream";
    const filename = relKey.split("/").pop();

    await store.set(key, buf, { metadata: { contentType, filename } });
    console.log(`[upload] ${filename}`);
    uploaded++;
    if (uploaded % 25 === 0) console.log(`Uploaded ${uploaded}…`);
  }

  console.log(`Done. Uploaded: ${uploaded}, skipped: ${skipped}.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


// node upload_files_to_blob.cjs "C:\Users\20203666\Documents\RIF\RIF_alle_documenten" citations

// dit werkte wel vgm
 // npm install @netlify/blobs
//npx netlify login
 // npx netlify link