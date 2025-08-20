from __future__ import annotations
from openai import OpenAI
from pathlib import Path
from typing import Iterable, Dict, List, Set, Tuple, Optional
import os
import tempfile
import itertools
import requests
import msal

# =========================
# Microsoft Graph helpers
# =========================
GRAPH_SCOPE = ["https://graph.microsoft.com/.default"]
GRAPH_BASE  = "https://graph.microsoft.com/v1.0"

def _get_graph_token(
        tenant_id: str,
        client_id: str,
        client_secret: str,
) -> str:
    app = msal.ConfidentialClientApplication(
        client_id=client_id,
        client_credential=client_secret,
        authority=f"https://login.microsoftonline.com/{tenant_id}",
    )
    result = app.acquire_token_silent(GRAPH_SCOPE, account=None)
    if not result:
        result = app.acquire_token_for_client(scopes=GRAPH_SCOPE)
    if "access_token" not in result:
        raise RuntimeError(f"Failed to acquire Graph token: {result.get('error_description')}")
    return result["access_token"]

def _resolve_site_id(hostname: str, site_path: str, token: str) -> str:
    # site_path example: "sites/MySiteName" or "MySiteName"
    site_path = site_path if site_path.startswith("sites/") else f"sites/{site_path}"
    url = f"{GRAPH_BASE}/sites/{hostname}:/{site_path}"
    r = requests.get(url, headers={"Authorization": f"Bearer {token}"})
    r.raise_for_status()
    return r.json()["id"]

def _resolve_drive_id(site_id: str, token: str, *, drive_id: Optional[str] = None, library_name: Optional[str] = None) -> str:
    if drive_id:
        return drive_id
    if library_name:
        url = f"{GRAPH_BASE}/sites/{site_id}/drives"
        r = requests.get(url, headers={"Authorization": f"Bearer {token}"})
        r.raise_for_status()
        for d in r.json().get("value", []):
            if d.get("name") == library_name:
                return d["id"]
        raise ValueError(f"Document library named '{library_name}' not found on site {site_id}")
    # fallback to default "Documents" drive
    url = f"{GRAPH_BASE}/sites/{site_id}/drive"
    r = requests.get(url, headers={"Authorization": f"Bearer {token}"})
    r.raise_for_status()
    return r.json()["id"]

def _list_folder_files_nonrecursive(
        drive_id: str,
        folder_path: str,
        token: str,
) -> List[Dict[str, str]]:
    """
    Returns list of dicts: {"name": str, "id": str, "size": int}
    Only files directly in the folder (no subfolders).
    """
    # Remove leading/trailing slashes for consistency
    folder_path = folder_path.strip("/")

    # children endpoint (non-recursive)
    url = f"{GRAPH_BASE}/drives/{drive_id}/root:/{folder_path}:/children?$top=999"
    r = requests.get(url, headers={"Authorization": f"Bearer {token}"})
    r.raise_for_status()
    items = r.json().get("value", [])

    files = []
    for it in items:
        # Keep only entries that are files (have 'file' facet)
        if "file" in it:
            files.append({
                "name": it["name"],
                "id": it["id"],
                "size": it.get("size", 0),
            })
    return files

def _download_drive_item_content(
        drive_id: str,
        item_id: str,
        token: str,
        dest_path: str,
) -> None:
    """
    Downloads the file bytes to dest_path using the /content endpoint.
    """
    url = f"{GRAPH_BASE}/drives/{drive_id}/items/{item_id}/content"
    with requests.get(url, headers={"Authorization": f"Bearer {token}"}, stream=True) as r:
        r.raise_for_status()
        with open(dest_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)

# =========================
# Sync with Vector Store
# =========================
def sync_vector_store_with_sharepoint_folder(
        *,
        # SharePoint / Graph inputs
        tenant_id: str,
        client_id: str,
        client_secret: str,
        hostname: str,              # e.g. "contoso.sharepoint.com"
        site_path: str,             # e.g. "sites/TeamSite" (or "TeamSite")
        folder_path: str,           # e.g. "Shared Documents/MyFolder" or "Documents/MyFolder"
        drive_id: Optional[str] = None,
        library_name: Optional[str] = None,  # if you don't know drive_id, give the doc library's display name
        # Vector store inputs
        vector_store_id: str,
        include_ext: Optional[Iterable[str]] = None,  # e.g. {".pdf", ".txt", ".md"}
        delete_extra: bool = True,
        dry_run: bool = False,
        client: Optional[OpenAI] = None,
) -> Dict[str, object]:
    """
    Synchronize a vector store's file list with a single SharePoint folder (non-recursive).

    - Uploads files in the SharePoint folder that are not in the vector store (filename match).
    - Deletes vector-store files not present in that SharePoint folder (filename match).
    """
    client = client or OpenAI()

    # --- Auth to Graph and locate drive/folder ---
    token = _get_graph_token(tenant_id, client_id, client_secret)
    site_id = _resolve_site_id(hostname, site_path, token)
    drive_id = _resolve_drive_id(site_id, token, drive_id=drive_id, library_name=library_name)

    sp_files = _list_folder_files_nonrecursive(drive_id, folder_path, token)

    if include_ext:
        allowed = {e.lower() for e in include_ext}
        sp_files = [f for f in sp_files if Path(f["name"]).suffix.lower() in allowed]

    # Map SharePoint files by filename
    name_to_sp: Dict[str, Dict[str, str]] = {}
    duplicates = []
    for f in sp_files:
        nm = f["name"]
        if nm not in name_to_sp:
            name_to_sp[nm] = f
        else:
            duplicates.append(nm)
    if duplicates:
        print("⚠️ Duplicate filenames in SharePoint folder (ignoring later duplicates):")
        for d in duplicates:
            print("   -", d)

    sp_names: Set[str] = set(name_to_sp.keys())

    # --- List vector store files (with pagination) ---
    name_to_remote_ids: Dict[str, List[str]] = {}
    after: Optional[str] = None
    while True:
        page = client.vector_stores.files.list(
            vector_store_id=vector_store_id,
            limit=100,
            after=after
        )
        # The OpenAI SDK returns an iterable page; support both .data and direct iteration
        records = getattr(page, "data", None) or list(page)
        for vs_file in records:
            file_id = vs_file.id
            try:
                fmeta = client.files.retrieve(file_id=file_id)
                file_name = getattr(fmeta, "filename", None) or getattr(fmeta, "name", None)
                if not file_name:
                    # last resort – skip if we can't figure out the filename
                    continue
            except Exception as e:
                print(f"ERROR retrieving filename for {file_id}: {e}")
                continue
            name_to_remote_ids.setdefault(file_name, []).append(file_id)

        if getattr(page, "has_more", False):
            after = getattr(page, "last_id", None)
            if not after:
                break
        else:
            break

    remote_names: Set[str] = set(name_to_remote_ids.keys())

    # --- compute deltas ---
    names_to_add = sorted(sp_names - remote_names)
    names_to_keep = sorted(sp_names & remote_names)
    names_to_remove = sorted(remote_names - sp_names)

    to_delete_ids = list(itertools.chain.from_iterable(name_to_remote_ids[n] for n in names_to_remove))

    result = {
        "to_upload": names_to_add,                 # filenames from SharePoint
        "uploaded": [],                            # populated with OpenAI file IDs
        "to_delete": names_to_remove if delete_extra else [],
        "deleted": [],
        "kept": names_to_keep,
        "vector_store_id": vector_store_id,
        "sharepoint_folder": folder_path,
    }

    # --- perform uploads (download from SP -> temp file -> upload to OpenAI -> attach to vector store) ---
    if names_to_add and not dry_run:
        for nm in names_to_add:
            item = name_to_sp[nm]
            # Download to temp file so we can give OpenAI a file handle
            suffix = Path(nm).suffix or ""
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp_path = tmp.name
            try:
                _download_drive_item_content(drive_id, item["id"], token, tmp_path)
                with open(tmp_path, "rb") as fh:
                    uploaded = client.files.create(file=fh, purpose="assistants")
                _ = client.vector_stores.files.create(
                    vector_store_id=vector_store_id,
                    file_id=uploaded.id,
                )
                result["uploaded"].append(uploaded.id)
            finally:
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass

    # --- perform deletions ---
    if delete_extra and to_delete_ids and not dry_run:
        for fid in to_delete_ids:
            try:
                _ = client.vector_stores.files.delete(
                    vector_store_id=vector_store_id,
                    file_id=fid,
                )
            except Exception as e:
                print(f"Warning: failed to detach file {fid} from vector store: {e}")
            try:
                _ = client.files.delete(file_id=fid)
                result["deleted"].append(fid)
            except Exception as e:
                print(f"Warning: failed to delete file {fid} from OpenAI storage: {e}")

    # --- user-friendly summary ---
    print(f"Vector store: {vector_store_id}")
    print(f"SharePoint folder: {folder_path}")
    print(f"Kept ({len(names_to_keep)}): {', '.join(names_to_keep) or '—'}")
    print(f"To upload ({len(names_to_add)}): {', '.join(names_to_add) or '—'}")
    if delete_extra:
        print(f"To delete ({len(to_delete_ids)}): {len(to_delete_ids) or 0} file(s)")
    if dry_run:
        print("Dry-run mode: no changes were made.")

    return result

# =========================
# Example usage
# =========================
if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()

    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    result = sync_vector_store_with_sharepoint_folder(
        tenant_id=os.getenv("MS_TENANT_ID"),
        client_id=os.getenv("MS_CLIENT_ID"),
        client_secret=os.getenv("MS_CLIENT_SECRET"),
        hostname=os.getenv("SP_HOSTNAME"),          # e.g. "contoso.sharepoint.com"
        site_path=os.getenv("SP_SITE_PATH"),        # e.g. "sites/TeamSite"
        folder_path=os.getenv("SP_FOLDER_PATH"),    # e.g. "Shared Documents/RIF_alle_documenten"
        # Optional: use one of the next two to pick the document library
        drive_id=os.getenv("SP_DRIVE_ID"),          # if you already know it
        # library_name="Documents",                 # or the display name of the library
        vector_store_id=os.getenv("VECTOR_STORE_ID"),
        include_ext={".pdf", ".txt", ".md"},        # Optional filter
        delete_extra=True,
        dry_run=False,
        client=client,
    )
    print(result)
