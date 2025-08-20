from __future__ import annotations
from openai import OpenAI
from pathlib import Path
from typing import Iterable, Dict, List, Set, Tuple, Optional
import itertools

def sync_vector_store_with_folder(
        folder: str | Path,
        vector_store_id: str,
        *,
        include_ext: Optional[Iterable[str]] = None,   # e.g. {".pdf", ".txt", ".md"}
        recursive: bool = True,
        delete_extra: bool = True,
        chunk_size: int = 20,                          # upload N files per batch
        dry_run: bool = False,
        client: Optional[OpenAI] = None,
) -> Dict[str, object]:
    """
    Synchronize a vector store's file list with a local folder (by filename).

    - Uploads files present in `folder` but not in the vector store (filename match).
    - Deletes files present in the vector store but not in `folder` (filename match).

    Parameters
    ----------
    folder : str | Path
        Local folder to mirror.
    vector_store_id : str
        Target vector store id (e.g. "vs_123").
    include_ext : iterable[str] | None
        If provided, only files with these (lowercased) extensions are considered.
        Example: {".pdf", ".txt", ".docx"}
    recursive : bool
        If True, searches folder recursively; otherwise only top-level files.
    delete_extra : bool
        If True, delete vector-store files that are not in the local folder.
    chunk_size : int
        Max number of files to upload in a single batch.
    dry_run : bool
        If True, only reports what would happen; no changes are made.
    client : OpenAI | None
        Optionally pass an existing OpenAI client; otherwise one is created
        using environment configuration.

    Returns
    -------
    dict
        {
          "to_upload": [local_path_str, ...],
          "uploaded": [file_id, ...],
          "to_delete": [file_id, ...],
          "deleted": [file_id, ...],
          "kept": [filename, ...],  # filenames already present
          "vector_store_id": str
        }
    """
    client = client or OpenAI()

    folder = Path(folder).expanduser().resolve()
    if not folder.exists() or not folder.is_dir():
        raise ValueError(f"Folder not found or not a directory: {folder}")

    # ---------- gather local files ----------
    if recursive:
        local_files = [p for p in folder.rglob("*") if p.is_file()]
    else:
        local_files = [p for p in folder.iterdir() if p.is_file()]

    if include_ext:
        allowed = {e.lower() for e in include_ext}
        local_files = [p for p in local_files if p.suffix.lower() in allowed]

    # Map by *filename* (basename). If duplicates exist, keep first & warn.
    name_to_local: Dict[str, Path] = {}
    duplicates = []
    for p in local_files:
        name = p.name
        if name not in name_to_local:
            name_to_local[name] = p
        else:
            duplicates.append(str(p))

    if duplicates:
        print("⚠️ Duplicate filenames detected locally (only first occurrence will be used):")
        for d in duplicates:
            print("   -", d)

    local_names: Set[str] = set(name_to_local.keys())

    # ---------- list vector store files (handle pagination) ----------

    after = None
    page = client.vector_stores.files.list(
        vector_store_id=vector_store_id,
        limit=100,
    )

    name_to_remote_ids = {}
    for file in page:
        file_id = file.id
        try:
            file_name = client.files.retrieve(file_id=file_id).filename
            print(file_name)
        except:
            print(f'\nERROR: {file_id}\n')
            continue
        if file_name not in name_to_remote_ids.keys():
            name_to_remote_ids[file_name] = [file_id]
        else:
            name_to_remote_ids[file_name].append(file_id)
        if getattr(page, "has_more", False):
            after = getattr(page, "last_id", None)
            if not after:
                break
        else:
            break


    remote_names: Set[str] = set(name_to_remote_ids.keys())

    # ---------- compute deltas ----------
    names_to_add = sorted(local_names - remote_names)
    names_to_keep = sorted(local_names & remote_names)
    names_to_remove = sorted(remote_names - local_names)

    to_upload_paths = [str(name_to_local[n]) for n in names_to_add]
    to_delete_ids = list(itertools.chain.from_iterable(name_to_remote_ids[n] for n in names_to_remove))

    result = {
        "to_upload": to_upload_paths,
        "uploaded": [],
        "to_delete": names_to_remove if delete_extra else [],
        "deleted": [],
        "kept": names_to_keep,
        "vector_store_id": vector_store_id,
    }

    # ---------- perform uploads ----------

    if to_upload_paths and not dry_run:
        # Upload in chunks to avoid large single requests
        for path in to_upload_paths:
            try:
                open_file = open(path, "rb")
                file_upload = client.files.create(
                    file=open_file,
                    purpose='assistants'
                )
                vector_store_file = client.vector_stores.files.create(
                    vector_store_id=vector_store_id,
                    file_id=file_upload.id,
                )
                print(vector_store_file)
            except:
                try:
                    open_file.close()
                except Exception:
                    pass

    # ---------- perform deletions ----------
    if delete_extra and to_delete_ids and not dry_run:
        for fid in to_delete_ids:
            _ = client.vector_stores.files.delete(
                vector_store_id=vector_store_id,
                file_id=fid,
            )
            _ = client.files.delete(
                file_id=fid
            )
            result["deleted"].append(fid)

    # ---------- user-friendly summary ----------
    print(f"Vector store: {vector_store_id}")
    print(f"Kept ({len(names_to_keep)}): {', '.join(names_to_keep) or '—'}")
    print(f"To upload ({len(to_upload_paths)}): {', '.join(Path(p).name for p in to_upload_paths) or '—'}")
    if delete_extra:
        print(f"To delete ({len(to_delete_ids)}): {len(to_delete_ids) or 0} file(s)")
    if dry_run:
        print("Dry-run mode: no changes were made.")

    return result

from openai import OpenAI
from dotenv import load_dotenv
from openai import OpenAI
import os

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


result = sync_vector_store_with_folder(
    folder="C:\\Users\\20203666\\Documents\\RIF\\RIF_alle_documenten",
    vector_store_id=os.getenv("VECTOR_STORE_ID"),
    recursive=True,
    delete_extra=True,
    dry_run=False,                         # set True to preview
    client=client
)

