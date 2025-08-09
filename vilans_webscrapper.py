import os, re, requests, time
from urllib.parse import urlparse
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from urllib.parse import urlencode, urljoin


INDEX = "https://www.vilans.nl/kennisbank-digitale-zorg/technologieen"
OUT_DIR = r"C:\Users\20203666\Documents\RIF\vilans webscrapped"
HEADERS = {"User-Agent": "Mozilla/5.0 (VilansScraper/1.1)"}
EXT_RE = re.compile(r"\.(pdf|docx?|xlsx?|pptx?|csv|txt)(?:$|[?#])", re.I)

os.makedirs(OUT_DIR, exist_ok=True)


def expand_all_accordions(page):
    # Click every collapsed toggle we can find; ignore failures.
    toggles = page.query_selector_all(".repeatable.accordion .nav-link.nav-button-link")
    for t in toggles:
        try:
            # Only click if it's collapsed
            aria = t.get_attribute("aria-expanded")
            if aria == "false" or aria is None:
                t.click(timeout=1000)
                # wait a beat for content to attach
                page.wait_for_timeout(150)  # small delay is enough on this site
        except Exception:
            pass
def extract_sections_up_to_downloads(page):
    """
    Returns list of dicts: [{"id": "...", "title": "...", "text": "..."}]
    for all .content-section-block sections that appear before #downloads.
    """
    return page.evaluate(r"""
    () => {
      const out = [];
      const blocks = Array.from(document.querySelectorAll(".content-section-block"));
      for (const el of blocks) {
        const id = el.id || "";
        if (id.toLowerCase() === "downloads") break;

        const headerSpan = el.querySelector(".tab h2 span");
        const title = headerSpan ? headerSpan.textContent.trim() : "";

        // The body text usually sits under .repeatable-content .info
        const info = el.querySelector(".repeatable-content .info");
        let text = "";
        if (info) {
          // get visible-ish text, but innerText is fine here (preserves line breaks)
          text = info.innerText.replace(/\s+\n/g, "\n").trim();
        }
        if (title || text) {
          out.push({ id, title, text });
        }
      }
      return out;
    }
    """)
def save_text_up_to_downloads_from_page(page, title_slug):
    # make sure everything is expanded so lazy blocks are in DOM
    expand_all_accordions(page)
    sections = extract_sections_up_to_downloads(page)

    # Build a readable plaintext: H2-style header lines + body
    lines = []
    for sec in sections:
        if sec["title"]:
            lines.append(sec["title"])
            lines.append("-" * len(sec["title"]))
        if sec["text"]:
            lines.append(sec["text"])
        lines.append("")  # blank line between sections

    path = os.path.join(OUT_DIR, f"{title_slug}.txt")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines).strip())

def get_cloudinary_form_downloads(page):
    """
    Return list of dicts: {url, filename} extracted from
    <form action="/umbraco/api/cloudinarydownloads/Download" ...>
    with hidden inputs PublicId / ResourceType / FileName.
    """
    forms = page.eval_on_selector_all(
        "form[action*='cloudinarydownloads']",
        r"""
        els => els.map(f => {
            const data = {};
            f.querySelectorAll('input[name]').forEach(i => { data[i.name] = i.value; });
            return {
                action: f.action,
                method: (f.method || 'get').toLowerCase(),
                fields: data
            };
        })
        """
    )

    out = []
    for f in forms:
        # Only handle GET-like forms; Umbraco’s endpoint typically uses GET here.
        params = f.get("fields", {})
        fname = params.get("FileName") or "download"
        action = f.get("action") or ""
        # Ensure absolute URL
        action_abs = urljoin(page.url, action)
        url = action_abs
        if f.get("method") == "get":
            url = action_abs + "?" + urlencode(params, doseq=True)
        out.append({"url": url, "filename": fname})
    return out

def ensure_downloads_expanded(page):
    try:
        # If collapsed, this click will reveal the content; ignore errors.
        page.click("#downloads-inner-toggle", timeout=2000)
        page.wait_for_selector("#downloads-inner-collapse.show, #downloads-inner-collapse[aria-expanded='true']", timeout=2000)
    except Exception:
        pass
def slug(s, n=120):
    s = re.sub(r"\s+", "-", s.strip().lower())
    s = re.sub(r"[^a-z0-9._-]", "", s)
    return (s or "item")[:n]

def save_text_up_to_downloads(rendered_html, title_slug):
    s = BeautifulSoup(rendered_html, "lxml")
    container = s.select_one("article, main, .rich-text, .content, .prose") or s.body or s
    text = container.get_text("\n", strip=True)
    # cut at the first "Downloads" heading-like occurrence
    m = re.search(r"\n?downloads\s*\n", text, flags=re.I)
    if m: text = text[:m.start()].strip()
    path = os.path.join(OUT_DIR, f"{title_slug}.txt")
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)

def download(url, dest, referer):
    if os.path.exists(dest):  # skip existing
        return
    with requests.get(url, headers={**HEADERS, "Referer": referer}, stream=True, timeout=90) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_content(1024 * 32):
                if chunk: f.write(chunk)

def get_all_tech_links(page):
    page.goto(INDEX, wait_until="networkidle")
    # collect all anchors that point to detail pages
    hrefs = page.eval_on_selector_all(
        "a[href*='/kennisbank-digitale-zorg/technologieen/']",
        "els => els.map(a => a.href)"
    )
    norm = []
    seen = set()
    for h in hrefs:
        h = h.split("?")[0].rstrip("/")
        if h.rstrip("/") == INDEX.rstrip("/"): continue
        if "/kennisbank-digitale-zorg/technologieen/" in urlparse(h).path and h not in seen:
            seen.add(h); norm.append(h)
    return norm

def get_file_links_for_page(page):
    # from the rendered DOM, grab any href that looks like a real file
    return page.eval_on_selector_all(
        "a[href]",
        r"""
        els => els
            .map(a => a.href)
            .filter(u => /\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|csv|txt|png|jpe?g|gif|webp)(?:$|[?#])/i.test(u))
        """
    )

def scrape_detail(page, url):
    page.goto(url, wait_until="networkidle")

    # Make sure "Downloads" (accordion) is open so forms are in the DOM
    ensure_downloads_expanded(page)

    html = page.content()

    # title
    s = BeautifulSoup(html, "lxml")
    ttag = s.find("h1") or s.title
    title = (ttag.get_text(strip=True) if ttag else url).strip()
    tslug = slug(title)

    # text up to "Downloads"
    save_text_up_to_downloads_from_page(page, tslug)

    # 1) Regular file-like hrefs already in the DOM
    href_files = get_file_links_for_page(page)  # your existing function

    # 2) Umbraco/Cloudinary form-based downloads
    form_files = get_cloudinary_form_downloads(page)  # new function

    # Normalize to a common list of (final_url, suggested_name)
    items = []
    seen = set()

    # from anchors: infer filename from URL
    for fu in href_files:
        name = os.path.basename(urlparse(fu).path) or "file"
        name = name.split("?")[0].split("#")[0]
        if fu not in seen:
            seen.add(fu)
            items.append((fu, name))

    # from forms: use provided FileName; url points to the Umbraco endpoint
    for obj in form_files:
        fu = obj["url"]
        name = obj["filename"]
        if fu not in seen:
            seen.add(fu)
            items.append((fu, name))

    # download files flat into OUT_DIR; prefix with tech slug to avoid clashes
    count = 0
    for fu, name in items:
        base, ext = os.path.splitext(name)
        # If the form-provided name lacks an extension, try to guess from URL
        if not ext:
            path_ext = os.path.splitext(urlparse(fu).path)[1]
            ext = path_ext or ".bin"
        fname = f"{tslug}--{slug(base, 100)}{ext.lower()}"
        dest = os.path.join(OUT_DIR, fname)
        try:
            download(fu, dest, referer=url)
            count += 1
        except requests.HTTPError as e:
            print(f"HTTP error {e.response.status_code} for {fu}")
        except Exception as e:
            print(f"failed: {fu} -> {e}")

    print(f"✔ {title} — saved text + {count} file(s)")


def main():
    with sync_playwright() as p:
        browser = p.firefox.launch(headless=True)
        page = browser.new_page(user_agent=HEADERS["User-Agent"])
        links = get_all_tech_links(page)
        if not links:
            # fallback: the example you provided
            links = ["https://www.vilans.nl/kennisbank-digitale-zorg/technologieen/asset-tracking-hulpmiddelen"]
        print(f"Found {len(links)} tech pages")
        for i, u in enumerate(sorted(set(links)), 1):
            print(f"[{i}/{len(links)}] {u}")
            try:
                scrape_detail(page, u)
            except Exception as e:
                print("Error on", u, ":", e)
                # continue to next item
                continue
        browser.close()
    print("Done. Files in:", OUT_DIR)

if __name__ == "__main__":
    main()