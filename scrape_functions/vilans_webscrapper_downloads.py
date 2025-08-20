import os
import re
import time
from urllib.parse import urlparse, urljoin, urlencode
import requests
from bs4 import BeautifulSoup

INDEX = "https://www.vilans.nl/kennisbank-digitale-zorg/technologieen"
OUT_DIR = r"C:\Users\20203666\Documents\RIF\vilans webscrapped downloads"
HEADERS = {"User-Agent": "Mozilla/5.0 (VilansScraper/1.1)"}

EXT_RE = re.compile(r"\.(pdf|docx?|xlsx?|pptx?)(?:$|[?#])", re.I)
os.makedirs(OUT_DIR, exist_ok=True)
tech_urls = [
    "https://www.vilans.nl/kennisbank-digitale-zorg/technologieen/asset-tracking-hulpmiddelen",
    "https://www.vilans.nl/kennisbank-digitale-zorg/technologieen/automatisch-douchesysteem",
    "https://www.vilans.nl/kennisbank-digitale-zorg/technologieen/bedsensor",
    "https://www.vilans.nl/kennisbank-digitale-zorg/technologieen/beeldschermzorg",
    "https://www.vilans.nl/kennisbank-digitale-zorg/technologieen/dagstructuurrobot",
    "https://www.vilans.nl/kennisbank-digitale-zorg/technologieen/ecd-elektronisch-clientendossier",
    "https://www.vilans.nl/kennisbank-digitale-zorg/technologieen/elektrisch-aantrekhulpmiddel-voor-steunkous",
    "https://www.vilans.nl/kennisbank-digitale-zorg/technologieen/elektronisch-toegangsbeheer",
    "https://www.vilans.nl/kennisbank-digitale-zorg/technologieen/exoskelet",
    "https://www.vilans.nl/kennisbank-digitale-zorg/technologieen/externe-leefcirkel",
    "https://www.vilans.nl/kennisbank-digitale-zorg/technologieen/heupairbag",
    "https://www.vilans.nl/kennisbank-digitale-zorg/technologieen/innovatieve-hoeslakens",
    "https://www.vilans.nl/kennisbank-digitale-zorg/technologieen/interactieve-belevingen",
    "https://www.vilans.nl/kennisbank-digitale-zorg/technologieen/leefpatroonmonitoring",
    "https://www.vilans.nl/kennisbank-digitale-zorg/technologieen/medicijndispenser-met-check-op-afstand",
    "https://www.vilans.nl/kennisbank-digitale-zorg/technologieen/plannen-zorg-met-ai",
    "https://www.vilans.nl/kennisbank-digitale-zorg/technologieen/robotdieren",
    "https://www.vilans.nl/kennisbank-digitale-zorg/technologieen/slim-incontinentiemateriaal",
    "https://www.vilans.nl/kennisbank-digitale-zorg/technologieen/smart-glass",
    "https://www.vilans.nl/kennisbank-digitale-zorg/technologieen/spraakgestuurd-rapporteren",
    "https://www.vilans.nl/kennisbank-digitale-zorg/technologieen/stressherkenningssok",
    "https://www.vilans.nl/kennisbank-digitale-zorg/technologieen/wondzorg-op-afstand"
]

# --------- helpers ---------

def slug(s, n=120):
    s = re.sub(r"\s+", "-", (s or "").strip().lower())
    s = re.sub(r"[^a-z0-9._-]", "", s)
    return (s or "item")[:n]

def fetch(url, session, **kwargs):
    r = session.get(url, headers=HEADERS, timeout=60, **kwargs)
    r.raise_for_status()
    return r

def download(url, dest, referer, session):
    if os.path.exists(dest):
        return
    with session.get(url, headers={**HEADERS, "Referer": referer}, stream=True, timeout=90) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_content(1024 * 32):
                if chunk:
                    f.write(chunk)



def get_file_links_from_html(html, base_url):
    soup = BeautifulSoup(html, "lxml")
    links = []
    for a in soup.select("a[href]"):
        href = a.get("href")
        if not href:
            continue
        abs_url = urljoin(base_url, href)
        if EXT_RE.search(abs_url):
            links.append(abs_url)
    return links

def get_cloudinary_form_downloads_from_html(html, base_url):
    """
    Extracts forms pointing to Umbraco Cloudinary download endpoint.
    Returns list of dicts: {url, filename}
    """
    soup = BeautifulSoup(html, "lxml")
    out = []
    for f in soup.select("form[action*='cloudinarydownloads']"):
        action = f.get("action") or ""
        method = (f.get("method") or "get").lower()
        fields = {}
        for i in f.select("input[name]"):
            fields[i.get("name")] = i.get("value") or ""
        file_name = fields.get("FileName") or "download"

        # Only include PDFs (case-insensitive)
        if not file_name.lower().endswith(".pdf"):
            continue

        action_abs = urljoin(base_url, action)
        final_url = action_abs
        if method == "get":
            final_url = action_abs + "?" + urlencode(fields, doseq=True)
        out.append({"url": final_url, "filename": file_name})
    return out

# --------- scraping ---------

def scrape_detail(url, session):
    r = fetch(url, session)
    html = r.text
    soup = BeautifulSoup(html, "lxml")

    # Title
    ttag = soup.find("h1") or soup.find("title")
    title = (ttag.get_text(strip=True) if ttag else url).strip()
    tslug = slug(title)

    # Collect file-like links
    href_files = get_file_links_from_html(html, url)

    # Collect Umbraco/Cloudinary form downloads
    form_files = get_cloudinary_form_downloads_from_html(html, url)

    # Normalize (final_url, filename)
    items, seen = [], set()

    # From anchors: infer filename from URL path
    for fu in href_files:
        name = os.path.basename(urlparse(fu).path) or "file"
        name = name.split("?")[0].split("#")[0]
        if fu not in seen:
            seen.add(fu)
            items.append((fu, name))

    # From forms: use provided FileName
    for obj in form_files:
        fu = obj["url"]
        name = obj["filename"]
        if fu not in seen:
            seen.add(fu)
            items.append((fu, name))

    # Download
    count = 0
    for fu, name in items:
        base, ext = os.path.splitext(name)
        if not ext:
            path_ext = os.path.splitext(urlparse(fu).path)[1]
            ext = path_ext or ".bin"
        fname = f"{tslug}--{slug(base, 100)}{ext.lower()}"
        dest = os.path.join(OUT_DIR, fname)
        try:
            download(fu, dest, referer=url, session=session)
            count += 1
        except requests.HTTPError as e:
            print(f"HTTP error {e.response.status_code} for {fu}")
        except Exception as e:
            print(f"failed: {fu} -> {e}")

    print(f"✔ {title} — saved text + {count} file(s)")

def main():
    with requests.Session() as session:
        # 1) collect all detail links
        idx = fetch(INDEX, session)
        links = tech_urls
        print(f"Found {len(links)} tech pages")
        for i, u in enumerate(sorted(set(links)), 1):
            print(f"[{i}/{len(links)}] {u}")
            try:
                scrape_detail(u, session)
                # be polite; optional light delay
                time.sleep(0.5)
            except Exception as e:
                print("Error on", u, ":", e)
                continue

    print("Done. Files in:", OUT_DIR)

if __name__ == "__main__":
    main()
