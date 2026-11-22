"""
TransitPlanner usage video with Playwright.
Part 1: default settings (automatic start, reading the plot, selecting, details, export).
Part 2: adjusting settings (location + horizon, equipment, nights, filters, mode, UTC,
export settings, Setup page, night mode).

Usage:
  npm run build && npx vite preview --port 4173      # serve the production build
  python3 tools/demo-video/record_demo.py hr OUTDIR  # or: en
  ffmpeg -ss 0.6 -i OUTDIR/raw-hr/*.webm -c:v libx264 -crf 21 -pix_fmt yuv420p -movflags +faststart transitplanner-upute-hr.mp4
Needs Python Playwright and Google Chrome (/usr/bin/google-chrome; set CHROME to override).
Captions are drawn into the page (bottom bar) together with a visible cursor; geolocation is
granted for Rijeka so the automatic first start is shown.
"""
import os
import json
import math
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

LANG = sys.argv[1] if len(sys.argv) > 1 else "en"
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "demo-video-out")
OUT.mkdir(parents=True, exist_ok=True)
BASE = os.environ.get("BASE_URL", "http://localhost:4173/")
W, H = 1440, 900

T = {
    "title": ("TransitPlanner", "TransitPlanner"),
    "p1": ("Upute za korištenje · 1. dio: zadane postavke", "How to use · Part 1: default settings"),
    "p2": ("2. dio: podešavanje postavki", "Part 2: adjusting the settings"),
    "s1": ("Pri prvom otvaranju preglednik pita za lokaciju. Dopustite jednom.", "On first open the browser asks for your location. Allow it once."),
    "s2": ("Sve ostalo je automatski: večeras + 2 noći, izračun i najbolji raspored bez preklapanja.", "Everything else is automatic: tonight plus 2 nights, computed, best conflict-free plan selected."),
    "s3": ("Traka postavki pokazuje što je planer pretpostavio: lokaciju, opremu, noći i filtre.", "The settings strip shows what the planner assumed: location, equipment, nights and filters."),
    "s4": ("Veliki broj su zakazani tranziti. Ispod: prvi ulaz u tranzit i broj kandidata.", "The big number is the scheduled transits; below it, the first ingress and the number of candidates."),
    "s5": ("Svaka noć je jedan graf: po jedna crta za svaki tranzit, a udubljenje je sam tranzit.", "Each night is one plot: one line per transit, and the dip is the transit itself."),
    "s6": ("Bijelo podebljano = zakazano. Sivo isprekidano = kandidat koji se preklapa sa zakazanim.", "Bold white = scheduled. Grey dashed = a candidate that overlaps a scheduled one."),
    "s7": ("Klik na crtu zakazuje tranzit. Tranziti koji se preklapaju sami izlaze iz plana.", "Click a line to schedule it. Overlapping transits leave the plan by themselves."),
    "s8": ("Klik na ime otvara detalje desno: vremena, nesigurnost, dubinu, visinu i Mjesec.", "Click a name for details on the right: times, uncertainty, depth, altitude and the Moon."),
    "s9": ("Ispod su predviđena svjetlosna krivulja i putanja objekta po nebu.", "Below are the predicted light curve and the target's track across the sky."),
    "s10": ("„Reset to best plan“ poništava ručne izmjene.", "“Reset to best plan” drops your manual changes."),
    "s11": ("Izvoz: „Export“ pa format. Datoteka se odmah preuzima.", "Export: click Export and choose a format. The file downloads at once."),
    "s12": ("Ekos/KStars, NINA, tablica (CSV), kalendar, JSON ili poveznica za dijeljenje.", "Ekos/KStars, NINA, spreadsheet (CSV), calendar, JSON or a share link."),
    "s13": ("Klik na „Location“: naziv, koordinate, nadmorska visina i vremenska zona.", "Click Location: name, coordinates, elevation and time zone."),
    "s14": ("Pod „Local horizon“ upišite prepreke kao azimut,visina: drveće, zgrade.", "Under Local horizon, enter obstructions as azimuth,altitude: trees, buildings."),
    "s15": ("Plan se odmah ponovno izračunava. Nema gumba „Izračunaj“.", "The plan recomputes at once. There is no Compute button."),
    "s16": ("„Equipment“: odaberite preset, pametni teleskop ili složite svoj postav.", "Equipment: choose a preset, a smart telescope, or build your own setup."),
    "s17": ("Izvedene vrijednosti (f-broj, mjerilo, vidno polje) računaju se iz senzora.", "Derived values (focal ratio, plate scale, field of view) come from the sensor."),
    "s18": ("Pod „Mount, overheads and exposure“: montaža, prekretanje meridijana, navođenje, ekspozicije.", "Under Mount, overheads and exposure: mount type, meridian flip, slew time, exposures."),
    "s19": ("„Nights“: broj noći (1–14) i definicija mraka.", "Nights: number of nights (1–14) and the darkness definition."),
    "s20": ("„Filters“: magnituda, dubina, visina, pokrivenost i pravilo za prekretanje meridijana.", "Filters: magnitude, depth, altitude, coverage and the meridian-flip rule."),
    "s21": ("Ispod piše koliko je događaja koji filtar izbacio, pa znate što olabaviti.", "Below, you see how many events each filter removed, so you know what to loosen."),
    "s22": ("Način rada jednim klikom: Photometry (znanost) ili Showcase (javna promatranja).", "Mode in one click: Photometry (science) or Showcase (outreach)."),
    "s23": ("Vremena po lokalnom vremenu ili u UTC-u.", "Times in local time or UTC."),
    "s24": ("„Export settings“: vremenska zona računala uz teleskop, verzija KStarsa, NINA predložak.", "Export settings: the telescope computer's time zone, KStars version, NINA template."),
    "s25": ("Stranica „Setup“: sve postavke na jednom mjestu; svaka stavka otvara svoj prozor.", "The Setup page: every setting in one place; each line opens its window."),
    "s26": ("Crveni noćni način čuva prilagodbu oka na mrak uz teleskop.", "Red night mode protects your dark adaptation at the telescope."),
    "end": ("Gotovo. Detaljne upute: docs/upute.md", "Done. Full guide: docs/user-guide.md"),
    "step1": ("1 · Zadane postavke", "1 · Default settings"),
    "step2": ("2 · Podešavanje postavki", "2 · Adjusting settings"),
}
L = 0 if LANG == "hr" else 1


def t(key):
    return T[key][L]


OVERLAY_JS = r"""
(() => {
  const css = `
  #demo-cursor{position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border:1.5px solid #ecebe6;border-radius:50%;
    background:rgba(236,235,230,.12);z-index:2147483647;pointer-events:none;transition:transform 40ms linear;box-shadow:0 0 0 1px rgba(0,0,0,.6)}
  #demo-cursor::after{content:'';position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;border-radius:50%;background:#ecebe6}
  .demo-ripple{position:fixed;width:16px;height:16px;margin:-8px 0 0 -8px;border:2px solid #e8402c;border-radius:50%;z-index:2147483646;pointer-events:none;
    animation:demo-r 520ms ease-out forwards}
  @keyframes demo-r{to{transform:scale(3.2);opacity:0}}
  #demo-cap{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);max-width:1100px;display:flex;align-items:stretch;z-index:2147483645;
    pointer-events:none;background:rgba(11,11,10,.94);border:1px solid #43433f;font-family:'Archivo Variable',Archivo,sans-serif;opacity:0;transition:opacity 220ms ease-out}
  #demo-cap.on{opacity:1}
  #demo-cap .txt{padding:14px 22px;display:flex;flex-direction:column;gap:6px}
  #demo-cap .step{font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-stretch:112%;color:#9b9a94;font-weight:500}
  #demo-cap .main{font-size:20px;line-height:1.3;color:#ecebe6}
  #demo-cap .blk{width:12px;background:#e8402c;flex-shrink:0}
  #demo-title{position:fixed;inset:0;z-index:2147483644;background:#0b0b0a;display:flex;flex-direction:column;justify-content:center;padding:0 140px;gap:26px;
    font-family:'Archivo Variable',Archivo,sans-serif;opacity:0;pointer-events:none;transition:opacity 380ms ease-out}
  #demo-title.on{opacity:1}
  #demo-title .strip{display:flex;gap:6px}
  #demo-title .strip span{width:44px;height:14px}
  #demo-title .big{font-size:120px;font-stretch:125%;font-weight:500;letter-spacing:-.01em;color:#ecebe6;line-height:.95}
  #demo-title .small{font-size:16px;letter-spacing:.16em;text-transform:uppercase;font-stretch:112%;color:#9b9a94;font-weight:500}`;
  function ensure() {
    if (document.getElementById('demo-cursor')) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const c = document.createElement('div'); c.id = 'demo-cursor'; document.body.appendChild(c);
    const cap = document.createElement('div'); cap.id = 'demo-cap';
    cap.innerHTML = '<div class="txt"><span class="step"></span><span class="main"></span></div><div class="blk"></div>';
    document.body.appendChild(cap);
    const ti = document.createElement('div'); ti.id = 'demo-title';
    ti.innerHTML = '<div class="strip"><span style="background:#6f6e69"></span><span style="background:#2f5ed8"></span><span style="background:#e8b713"></span><span style="background:#e8402c"></span><span style="background:#ecebe6"></span></div><div class="big"></div><div class="small"></div>';
    document.body.appendChild(ti);
    document.addEventListener('mousemove', (e) => { c.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`; }, true);
    document.addEventListener('mousedown', (e) => {
      const r = document.createElement('div'); r.className = 'demo-ripple';
      r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; document.body.appendChild(r);
      setTimeout(() => r.remove(), 600);
    }, true);
  }
  window.__demo = {
    caption(step, text) { ensure(); const cap = document.getElementById('demo-cap'); cap.querySelector('.step').textContent = step; cap.querySelector('.main').textContent = text; cap.classList.add('on'); },
    hide() { const cap = document.getElementById('demo-cap'); if (cap) cap.classList.remove('on'); },
    title(big, small) { ensure(); const ti = document.getElementById('demo-title'); ti.querySelector('.big').textContent = big; ti.querySelector('.small').textContent = small; ti.classList.add('on'); },
    untitle() { const ti = document.getElementById('demo-title'); if (ti) ti.classList.remove('on'); },
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensure); else ensure();
})();
"""


class Demo:
    def __init__(self, page):
        self.p = page
        self.x, self.y = W / 2, H / 2
        self.step = t("step1")

    def wait(self, ms):
        self.p.wait_for_timeout(ms)

    def cap(self, key, hold=3600):
        self.p.evaluate("([s, x]) => window.__demo.caption(s, x)", [self.step, t(key)])
        self.wait(hold)

    def title(self, big, small, hold=2600):
        self.p.evaluate("([b, s]) => window.__demo.title(b, s)", [big, small])
        self.wait(hold)
        self.p.evaluate("() => window.__demo.untitle()")
        self.wait(450)

    def move_xy(self, x, y):
        d = math.hypot(x - self.x, y - self.y)
        steps = max(8, min(40, int(d / 18)))
        self.p.mouse.move(x, y, steps=steps)
        self.x, self.y = x, y

    def move(self, loc, dx=0.5, dy=0.5):
        loc.scroll_into_view_if_needed()
        b = loc.bounding_box()
        self.move_xy(b["x"] + b["width"] * dx, b["y"] + b["height"] * dy)
        return b

    def click(self, loc, dx=0.5, dy=0.5, pause=260):
        self.move(loc, dx, dy)
        self.wait(pause)
        self.p.mouse.down()
        self.p.mouse.up()
        self.wait(350)

    def type_into(self, loc, text, delay=85):
        self.click(loc)
        self.p.keyboard.press("Control+A")
        self.p.keyboard.type(text, delay=delay)
        self.wait(300)

    def smooth_scroll_to(self, selector, block="start", wait=1100):
        self.p.evaluate("([s, b]) => document.querySelector(s).scrollIntoView({behavior: 'smooth', block: b})", [selector, block])
        self.wait(wait)

    def scroll_by(self, dy, wait=900):
        self.p.evaluate("(d) => window.scrollBy({top: d, behavior: 'smooth'})", dy)
        self.wait(wait)


def strip_btn(page, name):
    return page.locator("main button", has_text=name).first


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get("CHROME", "/usr/bin/google-chrome"), args=["--headless=new"])
    ctx = browser.new_context(
        viewport={"width": W, "height": H},
        record_video_dir=str(OUT / f"raw-{LANG}"),
        record_video_size={"width": W, "height": H},
        accept_downloads=True,
        timezone_id="Europe/Zagreb",
        locale="hr-HR" if LANG == "hr" else "en-GB",
        geolocation={"latitude": 45.3271, "longitude": 14.4422},
        permissions=["geolocation", "clipboard-read", "clipboard-write"],
    )
    ctx.add_init_script(OVERLAY_JS)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    d = Demo(page)

    # ---------------------------------------------------------------- part 1
    page.goto(BASE)
    page.evaluate("() => window.__demo.title('TransitPlanner', '')")  # cover loading at once
    page.evaluate("([b, s]) => window.__demo.title(b, s)", [t("title"), t("p1")])
    page.wait_for_function("() => document.body.innerText.toLowerCase().includes('scheduled transit')", timeout=60000)
    d.wait(2600)
    page.evaluate("() => window.__demo.untitle()")
    d.wait(500)
    d.move_xy(700, 420)
    d.cap("s1", 4200)
    d.cap("s2", 4600)

    d.move(strip_btn(page, "Location"))
    d.wait(500)
    d.move(strip_btn(page, "Equipment"))
    d.move(strip_btn(page, "Nights"))
    d.move(strip_btn(page, "Filters"))
    d.cap("s3", 3800)

    d.move(page.locator("main span.display").first)
    d.cap("s4", 4400)

    # the night with the most candidates
    nights = page.locator("main section[id^='night-']")
    counts = [nights.nth(i).locator("input.tp-check").count() for i in range(nights.count())]
    best = max(range(len(counts)), key=lambda i: counts[i])
    sec_id = nights.nth(best).get_attribute("id")
    d.smooth_scroll_to(f"#{sec_id}", "start", 1300)
    d.scroll_by(-40, 500)
    d.cap("s5", 4200)
    d.cap("s6", 4400)

    sec = page.locator(f"#{sec_id}")
    boxes = sec.locator("input.tp-check")
    target_name = None
    for i in range(boxes.count()):
        if not boxes.nth(i).is_checked():
            target_name = boxes.nth(i).get_attribute("aria-label").replace("Schedule ", "")
            break
    if target_name:
        row = sec.locator("svg g.cursor-pointer", has=page.locator("title", has_text=target_name)).first
        path = row.locator("path").nth(1)
        b = path.bounding_box()
        page.evaluate("([s, x]) => window.__demo.caption(s, x)", [d.step, t("s7")])
        d.move_xy(b["x"] + b["width"] * 0.5, b["y"] + b["height"] - 3)
        d.wait(900)
        page.mouse.down()
        page.mouse.up()
        d.wait(3400)

        name_btn = sec.locator("button", has_text=target_name).first
        d.click(name_btn)
        d.cap("s8", 4400)
        d.move_xy(1250, 520)
        page.evaluate("() => { const a = document.querySelector('aside'); a && a.scrollTo({top: 560, behavior: 'smooth'}); }")
        d.wait(900)
        d.cap("s9", 4400)
        page.evaluate("() => { const a = document.querySelector('aside'); a && a.scrollTo({top: 0, behavior: 'smooth'}); }")
        d.wait(600)

        page.evaluate("() => window.scrollTo({top: 0, behavior: 'smooth'})")
        d.wait(900)
        reset = page.get_by_role("button", name="Reset to best plan")
        if reset.count():
            d.move(reset)
            page.evaluate("([s, x]) => window.__demo.caption(s, x)", [d.step, t("s10")])
            d.wait(1600)
            d.click(reset)
            d.wait(1600)

    page.evaluate("() => window.scrollTo({top: 0, behavior: 'smooth'})")
    d.wait(700)
    export_btn = page.get_by_role("button", name="Export")
    page.evaluate("([s, x]) => window.__demo.caption(s, x)", [d.step, t("s11")])
    d.click(export_btn)
    d.wait(1200)
    d.cap("s12", 3000)
    with page.expect_download():
        d.click(page.get_by_role("menuitem", name="Ekos / KStars"))
    d.wait(2400)

    # ---------------------------------------------------------------- part 2
    d.step = t("step2")
    page.evaluate("() => window.__demo.hide()")
    d.title(t("title"), t("p2"), 2600)

    # location + horizon
    d.click(strip_btn(page, "Location"))
    d.cap("s13", 3400)
    name = page.get_by_role("dialog").locator("label:has-text('Name') input").first
    d.type_into(name, "Opservatorij Rijeka" if LANG == "hr" else "Rijeka observatory")
    elev = page.get_by_role("dialog").locator("label:has-text('Elevation') input").first
    d.type_into(elev, "320")
    d.click(page.get_by_role("dialog").get_by_role("button", name="Local horizon"))
    page.evaluate("([s, x]) => window.__demo.caption(s, x)", [d.step, t("s14")])
    ta = page.get_by_role("dialog").locator("textarea")
    d.click(ta)
    page.keyboard.type("0,12\n90,25\n180,8\n270,30", delay=70)
    d.wait(1200)
    d.click(page.get_by_role("dialog").get_by_role("button", name="Done"))
    d.wait(800)
    d.cap("s15", 3800)

    # equipment
    d.click(strip_btn(page, "Equipment"))
    page.evaluate("([s, x]) => window.__demo.caption(s, x)", [d.step, t("s16")])
    d.wait(1800)
    d.click(page.get_by_role("dialog").get_by_role("button", name="EdgeHD 8 + ASI294MM Pro on EQ6-R Pro"))
    d.wait(600)
    d.move(page.get_by_role("dialog").locator("dl").first)
    d.cap("s17", 3800)
    d.click(page.get_by_role("dialog").get_by_role("button", name="Mount, overheads and exposure"))
    page.evaluate("() => { const c = document.querySelector('[role=dialog] .overflow-y-auto'); c && c.scrollTo({top: c.scrollHeight, behavior: 'smooth'}); }")
    d.wait(900)
    d.cap("s18", 4200)
    d.click(page.get_by_role("dialog").get_by_role("button", name="Done"))
    d.wait(700)

    # nights
    d.click(strip_btn(page, "Nights"))
    page.evaluate("([s, x]) => window.__demo.caption(s, x)", [d.step, t("s19")])
    nights_in = page.get_by_role("dialog").locator("label:has-text('Number of nights') input").first
    d.type_into(nights_in, "5", delay=150)
    d.click(page.get_by_role("dialog").get_by_role("radio", name="−12°", exact=True))
    d.wait(2400)
    d.click(page.get_by_role("dialog").get_by_role("button", name="Done"))
    d.wait(900)

    # filters
    d.click(strip_btn(page, "Filters"))
    page.evaluate("([s, x]) => window.__demo.caption(s, x)", [d.step, t("s20")])
    mag = page.get_by_role("dialog").locator("label:has-text('Magnitude') input").nth(1)
    d.type_into(mag, "14")
    d.click(page.get_by_role("dialog").get_by_role("radio", name="Transit", exact=True))
    d.click(page.get_by_role("dialog").get_by_role("radio", name="Flag", exact=True))
    d.wait(900)
    d.move(page.get_by_role("dialog").get_by_text("Filtered out in the current plan"))
    d.cap("s21", 4000)
    d.click(page.get_by_role("dialog").get_by_role("button", name="Done"))
    d.wait(900)

    # mode + times
    d.click(page.get_by_role("radio", name="Showcase").first)
    d.cap("s22", 3800)
    d.click(page.get_by_role("radio", name="Photometry").first)
    d.wait(900)
    d.click(page.get_by_role("radio", name="UTC").first)
    d.cap("s23", 2800)
    d.click(page.get_by_role("radio", name="Local").first)
    d.wait(700)

    # export settings
    d.click(page.get_by_role("button", name="Export"))
    d.wait(700)
    d.click(page.get_by_role("menuitem", name="Export settings"))
    d.cap("s24", 4200)
    d.click(page.get_by_role("dialog").get_by_role("button", name="Done"))
    d.wait(700)

    # setup page
    d.click(page.get_by_role("button", name="Setup", exact=True))
    d.cap("s25", 4400)
    d.click(page.get_by_role("button", name="Plan", exact=True))
    d.wait(1000)

    # night mode
    d.click(page.get_by_role("button", name="Red night mode", exact=True))
    d.cap("s26", 3800)
    d.click(page.get_by_role("button", name="Normal mode", exact=True))
    d.wait(800)

    page.evaluate("() => window.__demo.hide()")
    d.title(t("title"), t("end"), 3200)

    video_path = page.video.path()
    ctx.close()
    browser.close()
    print(json.dumps({"video": video_path, "errors": errors}))
