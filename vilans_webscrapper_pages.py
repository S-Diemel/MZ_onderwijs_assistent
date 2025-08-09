
import os
import time
import base64
from pathlib import Path
from typing import List, Optional

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, ElementClickInterceptedException
from selenium.webdriver.common.keys import Keys
from webdriver_manager.chrome import ChromeDriverManager

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

HEADER_LABELS = [
    "Wat is het?",
    "Zorgproces",
    "Doelgroep",
    "Waardebepaling",
    "Financiering",
    "Wet- en regelgeving",
    "Implementatie",
]


def build_driver(headless: bool = True) -> webdriver.Chrome:
    options = webdriver.ChromeOptions()
    if headless:
        # Nieuwe headless modus is stabieler (Chrome 109+)
        options.add_argument("--headless=new")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-dev-shm-usage")
    # Voor sommige sites helpt dit tegen anti-bot popups
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)

    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    driver.execute_cdp_cmd("Page.enable", {})  # nodig voor printToPDF
    return driver


def wait_ready(driver: webdriver.Chrome, timeout: int = 20):
    WebDriverWait(driver, timeout).until(
        lambda d: d.execute_script("return document.readyState") == "complete"
    )


def try_accept_cookies(driver: webdriver.Chrome, timeout: int = 5):
    try:
        # Wacht tot de knop in de DOM staat
        btn = WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((By.ID, "cookiescript_accept"))
        )

        # Scroll in beeld zodat click() niet blokkeert
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", btn)

        # Wacht tot klikbaar
        btn = WebDriverWait(driver, timeout).until(
            EC.element_to_be_clickable((By.ID, "cookiescript_accept"))
        )

        try:
            btn.click()
        except:
            # Fallback als click niet werkt — ENTER simuleren
            btn.send_keys(Keys.ENTER)

        # Wacht tot overlay weg is
        WebDriverWait(driver, 5).until_not(
            EC.presence_of_element_located((By.ID, "cookiescript_injected"))
        )
    except TimeoutException:
        print("CookieScript accept-knop niet gevonden of niet weggegaan.")


def find_header_elements(driver: webdriver.Chrome, labels: List[str]):
    found = []
    for label in labels:
        # 1) Exacte match op gangbare header/knop elementen
        xpath_exact = (
            "//*[self::h1 or self::h2 or self::h3 or self::h4 or self::button or self::a or self::summary or @role='button']"
            f"[normalize-space(.)='{label}']"
        )
        elems = driver.find_elements(By.XPATH, xpath_exact)

        # 2) Zo niet gevonden: 'contains' (case-insensitive)
        if not elems:
            xpath_contains = (
                "//*[self::h1 or self::h2 or self::h3 or self::h4 or self::button or self::a or self::summary or @role='button']"
                f"[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{label.lower()}')]"
            )
            elems = driver.find_elements(By.XPATH, xpath_contains)

        if elems:
            found.append((label, elems[0]))
    return found


def click_or_scroll_to(driver: webdriver.Chrome, element):
    driver.execute_script("arguments[0].scrollIntoView({behavior:'instant', block:'center'});", element)
    try:
        WebDriverWait(driver, 5).until(EC.element_to_be_clickable(element))
        element.click()
    except (TimeoutException, ElementClickInterceptedException):
        # Als klikken niet kan (alleen header), dan is scrollen voldoende
        pass
    time.sleep(0.3)  # kleine pauze voor eventuele accordion-animaties


def save_pdf_via_cdp(driver: webdriver.Chrome, out_path: Path, landscape: bool = False):
    # A4 in inches (breedte x hoogte) – printBackground=True voor CSS backgrounds
    pdf_obj = driver.execute_cdp_cmd(
        "Page.printToPDF",
        {
            "landscape": landscape,
            "printBackground": True,
            "paperWidth": 8.27,
            "paperHeight": 11.69,
            # marges iets kleiner dan standaard
            "marginTop": 0.4,
            "marginBottom": 0.4,
            "marginLeft": 0.4,
            "marginRight": 0.4,
            # schaal 1.0 houdt layout in stand
            "scale": 1.0,
            # 'preferCSSPageSize': True  # zet aan als de site @page gebruikt
        },
    )
    pdf_b64 = pdf_obj.get("data", "")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "wb") as f:
        f.write(base64.b64decode(pdf_b64))


def sanitize_filename(name: str) -> str:
    keep = "-_.() abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    cleaned = "".join(c for c in name if c in keep).strip()
    return cleaned or "pagina"


def scrape_and_save(
        url: str,
        output_folder: str,
        filename: Optional[str] = None,
        headless: bool = True,
):
    driver = build_driver(headless=headless)
    try:
        driver.get(url)
        wait_ready(driver, 25)
        try_accept_cookies(driver)

        # headers zoeken en openen/erheen scrollen
        headers = find_header_elements(driver, HEADER_LABELS)
        for label, el in headers:
            click_or_scroll_to(driver, el)

        # bestandsnaam bepalen
        title = driver.title or "pagina"
        base = filename or sanitize_filename(title)
        out_path = Path(output_folder) / f"{base}.pdf"

        # PDF genereren en opslaan
        save_pdf_via_cdp(driver, out_path)
        print(f"PDF opgeslagen: {out_path}")

    finally:
        driver.quit()

def main():
    for url in tech_urls:
        name = url.split("/")[-1]
        scrape_and_save(url, r"C:\Users\20203666\Documents\RIF\vilans webscrapped pages", f'Vilans kennisbank {name}')

if __name__ == "__main__":
    main()


