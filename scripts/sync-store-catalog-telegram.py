#!/usr/bin/env python3
"""
ETL & Safe Rate-Limited Telegram Uploader for PhiTech Store Catalog.

Reads products from:
  C:\\Users\\mooya\\.gemini\\antigravity\\scratch\\price_intelligence\\catalog.db
and sibling *_products directories, deduplicates matching products across sites
choosing the exact cheapest valid price (0% markup), extracts technical specs,
distributes items across all 14 store categories, compresses images to WebP,
uploads images to Telegram in safe interval batches (with SHA-256 deduplication,
disable_notification=true, and HTTP 429 retry_after backoff), and syncs
catalog/index.json, catalog/media-map.json, and catalog/meta.json to the private
Supabase Storage bucket `store-catalog`.
"""

from __future__ import annotations

import argparse
import datetime
import hashlib
import html
import io
import json
import mimetypes
import os
import re
import sqlite3
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from collections import defaultdict
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps

REPO_ROOT = Path(__file__).resolve().parent.parent
ENV_LOCAL_PATH = REPO_ROOT / ".env.local"
SCRATCH_ROOT = Path(r"C:\Users\mooya\.gemini\antigravity\scratch")
PRICE_INTEL_DIR = SCRATCH_ROOT / "price_intelligence"
CATALOG_DB_PATH = PRICE_INTEL_DIR / "catalog.db"
STATE_PATH = PRICE_INTEL_DIR / "telegram_upload_state.json"

BUCKET_NAME = "store-catalog"

SOURCE_IMAGE_FOLDERS: dict[str, Path] = {
    "mawanmasr": SCRATCH_ROOT / "mawanmasr_products",
    "bnaia": SCRATCH_ROOT / "bnaia_products",
    "ahmedelsallab": SCRATCH_ROOT / "ahmedelsallab_products",
    "elsewedy": SCRATCH_ROOT / "elsewedy_products",
    "cementegypt": SCRATCH_ROOT / "cementegypt_products",
}

CATEGORY_LABELS_AR: dict[str, str] = {
    "electrical": "كهرباء وإنارة",
    "plumbing": "سباكة وصحي",
    "paint": "دهانات وعوازل",
    "ceramics": "سيراميك وبورسلان",
    "marble": "رخام وجرانيت",
    "decor": "ديكورات حديثة",
    "smart_home": "سمارت هوم",
    "low_current": "تيار خفيف وكاميرات",
    "safety_sensors": "حساسات أمان",
    "hvac": "تكييف وتهوية",
    "building_materials": "مواد بناء وعظم",
    "doors_windows": "أبواب ونوافذ",
    "appliances": "أجهزة منزلية",
    "tools_hardware": "عدد وأدوات",
}

COMPETITOR_SCRUB_RE = re.compile(
    r"(?:أحمد\s*السلاب|احمد\s*السلاب|السلاب|بناية|بنايه|موان\s*مصر|أسمنت\s*مصر|اسمنت\s*مصر|ahmedelsallab|bnaia|mawanmasr|cementegypt)",
    re.IGNORECASE,
)
HTML_TAG_RE = re.compile(r"<[^>]+>")
WHITESPACE_RE = re.compile(r"\s+")

CONFLICT_GROUPS = [
    ("ابيض", "اسود", "رمادي", "ذهبي", "فضي", "كروم", "بيج", "بني", "ازرق", "احمر", "اخضر", "نيكل"),
    ("1 فتحه", "2 فتحه", "3 فتحه", "4 فتحه", "خط واحد", "خطين", "3 خط", "4 خط"),
    ("utp", "ftp", "stp"),
    ("1 فاز", "3 فاز", "سنجل فاز", "ثري فاز"),
]

BRAND_NORMALIZATION = {
    "شنايدر اليكتريك": "شنايدر إليكتريك",
    "schneider": "Schneider Electric",
    "schneider electric": "Schneider Electric",
    "grohe": "جروهي",
    "جروهي": "جروهي",
    "duravit": "ديورافيت",
    "ديورافيت": "ديورافيت",
    "roca": "روكا",
    "روكا": "روكا",
    "ideal standard": "إيديال ستاندرد",
    "ايديال ستاندرد": "إيديال ستاندرد",
    "إيديال ستاندرد": "إيديال ستاندرد",
    "cleopatra": "كليوباترا",
    "كليوباترا": "كليوباترا",
    "aljawhara": "الجوهرة",
    "الجوهرة": "الجوهرة",
    "jotun": "جوتن",
    "جوتن": "جوتن",
    "glc": "جي إل سي GLC",
    "sipes": "سايبس",
    "sika": "سيكا Sika",
    "سيكا": "سيكا Sika",
    "elsewedy": "السويدي إليكتريك",
    "السويدي": "السويدي إليكتريك",
    "abb": "ABB",
    "legrand": "ليجـراند Legrand",
    "fumagalli": "Fumagalli",
    "philips": "فيليبس Philips",
    "carrier": "كاريير Carrier",
    "midea": "ميديا Midea",
    "tornado": "تورنيدو Tornado",
    "sharp": "شارب Sharp",
    "fresh": "فريش Fresh",
    "gawad": "جواد",
    "جواد": "جواد",
    "platino": "بلاتينو",
    "بلاتينو": "بلاتينو",
    "royalk": "رويال",
    "royal": "رويال",
    "رويال": "رويال",
    "sar design": "سارديزاين",
    "سارديزاين": "سارديزاين",
    "purity": "بيورتي",
    "بيورتي": "بيورتي",
    "leccico": "ليسيكو",
    "ليسيكو": "ليسيكو",
    "sanipure": "ساني بيور",
    "cmb": "كيماويات البناء الحديث CMB",
}

INVALID_BRANDS = {"", "أخري", "اخرى", "أخرى", "غير محدد", "بدون ماركة", "none", "null", "other"}


def load_env(path: Path = ENV_LOCAL_PATH) -> dict[str, str]:
    vals: dict[str, str] = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
            s = line.strip()
            if not s or s.startswith("#") or "=" not in s:
                continue
            k, v = s.split("=", 1)
            vals[k.strip()] = v.strip().strip('"').strip("'")
    for k in (
        "NEXT_PUBLIC_SUPABASE_URL",
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_SECRET_KEY",
        "TELEGRAM_BOT_TOKEN",
        "TELEGRAM_CHAT_ID",
        "TELEGRAM_STORE_MEDIA_CHAT_ID",
    ):
        if os.environ.get(k):
            vals[k] = os.environ[k]
    return vals


def normalize_ar(text: str) -> str:
    s = (text or "").lower()
    s = re.sub(r"[\u064b-\u065f\u0670\u0640]", "", s)
    s = re.sub(r"[أإآ]", "ا", s)
    s = s.replace("ى", "ي").replace("ة", "ه")
    return WHITESPACE_RE.sub(" ", s).strip()


def clean_public_text(text: str, max_len: int = 500) -> str:
    if not text:
        return ""
    s = html.unescape(text)
    s = HTML_TAG_RE.sub(" ", s)
    s = COMPETITOR_SCRUB_RE.sub("", s)
    s = re.sub(r"https?://\S+", "", s)
    s = WHITESPACE_RE.sub(" ", s).strip(" -–—|/،,:.")
    if len(s) > max_len:
        s = s[: max_len - 1].rstrip() + "…"
    return s


def normalize_brand(raw_brand: str, canonical: str) -> str:
    for candidate in (raw_brand, canonical):
        c = clean_public_text(candidate, 80)
        key = normalize_ar(c)
        if not key or key in INVALID_BRANDS:
            continue
        if key in BRAND_NORMALIZATION:
            return BRAND_NORMALIZATION[key]
        if c.lower() in BRAND_NORMALIZATION:
            return BRAND_NORMALIZATION[c.lower()]
        return c
    return "توريد معتمد"


def has_conflicting_tokens(text_a: str, text_b: str) -> bool:
    na = normalize_ar(text_a)
    nb = normalize_ar(text_b)
    for group in CONFLICT_GROUPS:
        ha = {tok for tok in group if tok in na}
        hb = {tok for tok in group if tok in nb}
        if ha and hb and ha != hb:
            return True
    return False


def classify_product(raw_cat: str, name: str, brand: str, desc: str) -> tuple[str, str]:
    cat_norm = normalize_ar(raw_cat)
    text_norm = normalize_ar(f"{raw_cat} {name} {desc}")
    sub_cat = clean_public_text(raw_cat.split("/")[-1] if raw_cat else "", 70)

    def has_any(hay: str, kws: tuple[str, ...]) -> bool:
        return any(kw in hay for kw in kws)

    # Priority 1: Smart Home & KNX & Safety & Low Current
    if has_any(
        text_norm,
        (
            "knx",
            "سمارت هوم",
            "smart home",
            "zigbee",
            "قفل ذكي",
            "smart lock",
            "تحكم عن بعد",
            "مفتاح تاتش",
            "مفتاح ذكي",
            "شاشه تحكم",
            "fan coil controller",
        ),
    ):
        return "smart_home", sub_cat

    if has_any(
        text_norm,
        (
            "حساس غاز",
            "حساس دخان",
            "حساس حريق",
            "حساس مياه",
            "تسرب الغاز",
            "تسرب المياه",
            "طفايه حريق",
            "انذار حريق",
            "انذار سرقه",
            "كاشف دخان",
        ),
    ):
        return "safety_sensors", sub_cat

    if has_any(
        text_norm,
        (
            "كاميرا مراقب",
            "cctv",
            "nvr",
            "dvr",
            "hikvision",
            "dahua",
            "انتركم",
            "intercom",
            "cat6",
            "cat-6",
            "utp",
            "ftp",
            "سلك نت",
            "كابل نت",
            "باتش كورد",
            "سويتش شبكات",
            "اكسس بوينت",
            "ساوند سيستم",
        ),
    ):
        return "low_current", sub_cat

    # Priority 2: HVAC
    if has_any(cat_norm, ("تكييف", "تبريد", "تهويه")) or has_any(
        text_norm, ("تكييف سبليت", "تكييف انفرتر", "تكييف شباك", "تكييف مركزي", "مكيف هواء", "مبرد هواء", "فريون")
    ):
        return "hvac", sub_cat

    # Priority 3: Ceramics & Porcelain
    if has_any(
        cat_norm,
        ("سيراميك", "بورسلين", "بورسلان", "بلاط", "حوائط وارضيات", "باركيه"),
    ) or has_any(text_norm, ("سيراميك", "بورسلين", "بورسلان")):
        return "ceramics", sub_cat

    # Priority 4: Marble & Granite
    if has_any(cat_norm, ("رخام", "جرانيت", "حجر")) or has_any(
        text_norm, ("رخام", "جرانيت", "كوارتز", "تسطير درج", "درج سلم")
    ):
        return "marble", sub_cat

    # Priority 5: Doors & Windows
    if has_any(cat_norm, ("ابواب", "نوافذ", "شبابيك", "مصفح")) or has_any(
        text_norm, ("باب مصفح", "قلب باب", "كالون", "كوالين", "مفصله باب", "مفصلات", "سلندر", "ترباس", "مقبض باب")
    ):
        return "doors_windows", sub_cat

    # Priority 6: Appliances
    if has_any(cat_norm, ("اجهزه منزليه",)) or has_any(
        text_norm,
        (
            "سخان كهرباء",
            "سخان غاز",
            "سخان مياه",
            "شفاط مطبخ",
            "شفاط حمام",
            "بلت ان",
            "بوتاجاز",
            "مسطح غاز",
            "ميكروويف",
            "غساله اطباق",
            "مروحه سقف",
            "مروحه حائط",
            "مبرد مياه",
            "فلتر مياه",
        ),
    ):
        return "appliances", sub_cat

    # Priority 7: Paints & Waterproofing
    if has_any(cat_norm, ("دهان", "دهانات", "سيلر", "ورنيش", "بويه")) or has_any(
        text_norm,
        ("دهان", "بويه", "جلتكس", "ورنيش", "دايتون", "داي تون", "بلاستيك مط", "جوتن", "فينوماستيك", "معجون حوائط", "سيلر"),
    ):
        return "paint", sub_cat

    # Priority 8: Plumbing & Sanitary
    if has_any(
        cat_norm,
        (
            "خلاط",
            "سباكه",
            "حمام",
            "احواض",
            "الاحواض",
            "حوص مطبخ",
            "حوض",
            "محابس",
            "خزانات الدفن",
            "خزانات المياه",
            "مواتير مياه",
            "مواسير",
            "صفايات",
            "اكسسوارات الحمام",
            "اثاث حمام",
        ),
    ) or has_any(
        text_norm,
        (
            "خلاط",
            "دفن",
            "مرحاض",
            "تواليت",
            "بانيو",
            "حوض",
            "ماسوره",
            "مواسير",
            "كوع",
            "تي بولي",
            "محبس",
            "شطاف",
            "طاسه دش",
            "فواطه",
            "خزان طرد",
            "صرف صحي",
            "صرف صامت",
            "ppr",
            "صنوبر",
            "جروهي",
            "ديورافيت",
            "سارديزاين",
        ),
    ):
        return "plumbing", sub_cat

    # Priority 9: Electrical & Lighting
    if has_any(
        cat_norm,
        (
            "كهرباء",
            "اضاء",
            "لمبات",
            "بواطات",
            "مشتركات",
            "خراطيم",
            "لوحات",
            "قواطع",
            "سلك المباني",
            "اسلاك",
            "كابلات",
            "حلول الطاقه",
            "اباجوره",
            "شريط عازل",
        ),
    ) or has_any(
        text_norm,
        (
            "قاطع",
            "mcb",
            "rccb",
            "mccb",
            "مفتاح كهرباء",
            "شاسيه",
            "وش كهرباء",
            "بريزه",
            "مقبس",
            "اسبوت",
            "سبوت",
            "لمبه",
            "ليد",
            "كشاف",
            "ابليك",
            "ثريا",
            "نجفه",
            "سلك نحاس",
            "كابل كهرباء",
            "لوحه توزيع",
            "بواط",
            "خرطوم فلكسبل",
            "مشترك",
            "كونتاكتور",
            "اوفرلود",
            "ترانس",
            "بروفايل ليد",
        ),
    ):
        return "electrical", sub_cat

    # Priority 10: Building Materials & Structural & Chemicals
    if has_any(
        cat_norm,
        ("اسمنت", "حديد", "جبس", "كيماويات البناء", "مستلزمات البناء", "مواد البناء", "موان", "طوب", "رمل", "سن", "مواد سقايه"),
    ) or has_any(
        text_norm,
        (
            "اسمنت",
            "حديد تسليح",
            "طوب ",
            "رمل",
            "زلط",
            "سن ",
            "جبس بورد",
            "الواح الجبس",
            "جراوت",
            "ماده لاصقه",
            "اديبوند",
            "فيبر جلاس",
            "مونه",
            "عزل مائي",
            "سيكا",
        ),
    ):
        return "building_materials", sub_cat

    # Priority 11: Decor & Cladding
    if has_any(cat_norm, ("ديكور", "اكسسوارات منزليه")) or has_any(
        text_norm, ("بديل الخشب", "بديل الرخام", "wpc", "ورق حائط", "بانوه", "تابلوه", "مرايه", "فريم")
    ):
        return "decor", sub_cat

    # Priority 12: Tools & Hardware
    if has_any(cat_norm, ("عده", "عدد وادوات")) or has_any(
        text_norm,
        (
            "مفتاح فرنساوي",
            "مفتاح بيبه",
            "مفتاح ربط",
            "مفتاح بوجيهات",
            "شاكوش",
            "مفك",
            "بنسه",
            "كماشه",
            "شنيور",
            "صاروخ",
            "مسدس",
            "سيليكون",
            "سيلكون",
            "قصدير",
            "خابور",
            "مسمار",
            "تيب ",
            "سلوتيب",
            "شريط لاصق",
            "متر قياس",
        ),
    ):
        return "tools_hardware", sub_cat

    if "اكسسوارات" in cat_norm:
        return "decor", sub_cat

    return "building_materials", sub_cat


def extract_specs(
    row: sqlite3.Row,
    brand: str,
    unit: str,
    clean_desc: str,
) -> list[str]:
    specs: list[str] = []
    seen: set[str] = set()

    def add_spec(label: str) -> None:
        s = WHITESPACE_RE.sub(" ", label).strip()
        if not s or len(s) > 130:
            return
        key = normalize_ar(s)
        if key not in seen:
            seen.add(key)
            specs.append(s)

    if brand and brand != "توريد معتمد":
        add_spec(f"الماركة: {brand}")

    try:
        sj = json.loads(row["specs_json"] or "{}")
    except Exception:
        sj = {}

    sku = (row["sku"] or "").strip()
    models = sj.get("model_codes") or []
    if models:
        add_spec("كود الموديل: " + " / ".join(str(m) for m in models[:2]))
    elif sku:
        add_spec(f"كود الصنف: {sku}")

    typed = sj.get("typed_numbers") or {}
    unit_map = [
        (("cm", "سم"), "المقاس / الأبعاد", "سم"),
        (("mm", "مم"), "القطاع / السمك", "مم"),
        (("inch", "بوصه", "بوصة"), "المقاس", "بوصة"),
        (("m", "متر"), "الطول", "م"),
        (("watt", "w", "وات"), "القدرة الكهربائية", "وات"),
        (("amp", "a", "امبير"), "شدة التيار", "أمبير"),
        (("volt", "v", "فولت"), "الجهد", "فولت"),
        (("hp", "حصان"), "القدرة", "حصان"),
        (("kg", "كجم"), "الوزن", "كجم"),
        (("g", "جرام"), "الوزن", "جم"),
        (("liter", "l", "لتر"), "السعة / الحجم", "لتر"),
        (("bar", "بار"), "ضغط التشغيل", "بار"),
        (("grade",), "الرتبة / الدرجة", ""),
        (("kelvin", "k"), "درجة حرارة اللون", "K"),
    ]
    if isinstance(typed, dict):
        for keys, ar_label, ar_unit in unit_map:
            vals: list[str] = []
            for k in keys:
                raw_v = typed.get(k)
                if isinstance(raw_v, list):
                    for item in raw_v:
                        if str(item) not in vals:
                            vals.append(str(item))
                elif raw_v:
                    vals.append(str(raw_v))
            if vals:
                suffix = f" {ar_unit}" if ar_unit else ""
                add_spec(f"{ar_label}: {' × '.join(vals[:3])}{suffix}")

    pack_size = row["pack_size"]
    if unit:
        if pack_size and float(pack_size) > 1.01:
            ps_str = f"{int(pack_size)}" if float(pack_size).is_integer() else f"{pack_size}"
            add_spec(f"وحدة البيع: {unit} ({ps_str})")
        else:
            add_spec(f"وحدة البيع: {unit}")

    variants_count = int(row["variants_count"] or 0)
    if variants_count > 1:
        add_spec(f"متاح {variants_count} مقاس / لون")

    # Add short meaningful clause from description if few specs were extracted
    if len(specs) < 4 and clean_desc:
        for seg in re.split(r"[•\n|،.]", clean_desc):
            seg_c = seg.strip()
            if 8 <= len(seg_c) <= 85 and not seg_c.isdigit():
                add_spec(seg_c)
            if len(specs) >= 6:
                break

    return specs[:8]


def extract_variants(row: sqlite3.Row) -> list[dict[str, Any]]:
    try:
        raw = json.loads(row["variants_json"] or "[]")
    except Exception:
        return []
    if not isinstance(raw, list) or not raw:
        return []
    out: list[dict[str, Any]] = []
    for v in raw[:8]:
        if not isinstance(v, dict):
            continue
        item: dict[str, Any] = {}
        name = clean_public_text(str(v.get("name") or v.get("title") or ""), 80)
        if name:
            item["name"] = name
        if v.get("sku"):
            item["sku"] = str(v["sku"])[:40]
        if v.get("color"):
            item["color"] = clean_public_text(str(v["color"]), 30)
        if v.get("size"):
            item["size"] = clean_public_text(str(v["size"]), 30)
        if v.get("price") is not None:
            try:
                p = float(v["price"])
                if p > 0:
                    item["price"] = round(p, 2)
            except (TypeError, ValueError):
                pass
        if item:
            out.append(item)
    return out


def resolve_local_image_path(source_code: str, local_image: str) -> Path | None:
    if not local_image:
        return None
    base_folder = SOURCE_IMAGE_FOLDERS.get(source_code)
    if not base_folder:
        return None
    rel = local_image.lstrip("/\\")
    candidate = (base_folder / rel).resolve()
    try:
        if not candidate.is_relative_to(base_folder.resolve()):
            return None
    except ValueError:
        return None
    if candidate.is_file() and candidate.stat().st_size > 200:
        return candidate
    return None


def build_deduped_catalog() -> tuple[list[dict[str, Any]], dict[str, Path], dict[str, Any]]:
    if not CATALOG_DB_PATH.is_file():
        raise FileNotFoundError(f"Database not found: {CATALOG_DB_PATH}")

    conn = sqlite3.connect(str(CATALOG_DB_PATH))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    rows = cur.execute(
        """
        SELECT *
        FROM competitor_products
        WHERE is_active = 1
        ORDER BY id ASC
        """
    ).fetchall()
    by_id: dict[int, sqlite3.Row] = {int(r["id"]): r for r in rows}

    # Union-Find for safe cheapest-price merging
    parent: dict[int, int] = {pid: pid for pid in by_id}

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            if ra < rb:
                parent[rb] = ra
            else:
                parent[ra] = rb

    matches = cur.execute(
        "SELECT product_a_id, product_b_id, confidence FROM cross_site_matches WHERE confidence >= 92"
    ).fetchall()
    merged_via_cross_match = 0
    for m in matches:
        aid = int(m["product_a_id"])
        bid = int(m["product_b_id"])
        ra_row = by_id.get(aid)
        rb_row = by_id.get(bid)
        if not ra_row or not rb_row:
            continue
        if normalize_ar(ra_row["unit_detected"]) != normalize_ar(rb_row["unit_detected"]):
            continue
        if abs(float(ra_row["pack_size"] or 1.0) - float(rb_row["pack_size"] or 1.0)) > 0.01:
            continue
        if has_conflicting_tokens(ra_row["name"], rb_row["name"]):
            continue
        union(aid, bid)
        merged_via_cross_match += 1

    # Also merge exact normalized name + unit + pack_size
    exact_buckets: dict[tuple[str, str, float], list[int]] = defaultdict(list)
    for pid, r in by_id.items():
        nn = normalize_ar(r["name_normalized"] or r["name"])
        if not nn:
            continue
        unit_k = normalize_ar(r["unit_detected"] or "قطعة")
        ps_k = round(float(r["pack_size"] or 1.0), 2)
        exact_buckets[(nn, unit_k, ps_k)].append(pid)
    for pids in exact_buckets.values():
        if len(pids) > 1:
            first = pids[0]
            for other in pids[1:]:
                union(first, other)

    groups: dict[int, list[sqlite3.Row]] = defaultdict(list)
    for pid, r in by_id.items():
        groups[find(pid)].append(r)

    conn.close()

    products: list[dict[str, Any]] = []
    product_image_files: dict[str, Path] = {}
    cat_counts: dict[str, int] = defaultdict(int)
    multi_source_groups = 0

    for root_id in sorted(groups.keys()):
        members = groups[root_id]
        if len(members) > 1:
            multi_source_groups += 1

        # Exact cheapest positive price (0% markup!)
        positive_prices = [float(r["price"]) for r in members if r["price"] is not None and float(r["price"]) > 0]
        cheapest_price = round(min(positive_prices), 2) if positive_prices else 0.0

        # Reference highest price / original price cleanly without artificial inflation
        higher_refs: list[float] = []
        for r in members:
            for col in ("original_price", "price"):
                v = r[col]
                if v is not None and float(v) > cheapest_price * 1.01 and cheapest_price > 0:
                    higher_refs.append(round(float(v), 2))
        old_price = max(higher_refs) if higher_refs else None

        # Choose richest member row for display name/description/specs/image
        members_sorted = sorted(
            members,
            key=lambda r: (
                1 if resolve_local_image_path(r["source_code"], r["local_image"]) else 0,
                len((r["description"] or "").strip()),
                len((r["brand"] or "").strip()),
                len((r["category"] or "").strip()),
                -int(r["id"]),
            ),
            reverse=True,
        )
        rep = members_sorted[0]

        clean_name = clean_public_text(rep["name"], 180)
        if not clean_name:
            continue

        brand = "توريد معتمد"
        for r in members_sorted:
            b = normalize_brand(r["brand"] or "", r["brand_canonical"] or "")
            if b != "توريد معتمد":
                brand = b
                break

        raw_desc = ""
        for r in members_sorted:
            d = clean_public_text(r["description"] or "", 550)
            # Ignore numeric-only or price-garbage descriptions like "29"
            if d and not d.isdigit() and len(d) >= 6:
                raw_desc = d
                break

        raw_cat = ""
        for r in members_sorted:
            if (r["category"] or "").strip():
                raw_cat = r["category"].strip()
                break

        cat_id, sub_cat = classify_product(raw_cat, clean_name, brand, raw_desc)
        cat_counts[cat_id] += 1

        unit = clean_public_text(rep["unit_detected"] or "قطعة", 35) or "قطعة"
        specs = extract_specs(rep, brand, unit, raw_desc)
        variants = extract_variants(rep)

        in_stock = any(
            (r["stock_status"] or "").strip() not in ("غير متوفر", "نفد", "out_of_stock")
            for r in members
        )

        # Resolve verified local image path from richest available member
        local_img_path: Path | None = None
        for r in members_sorted:
            lp = resolve_local_image_path(r["source_code"], r["local_image"])
            if lp:
                local_img_path = lp
                break

        prod_id = f"cat-{root_id}"
        sku_val = ""
        for r in members_sorted:
            if (r["sku"] or "").strip():
                sku_val = (r["sku"] or "").strip()[:36]
                break
        code = sku_val or f"PHI-C-{root_id}"

        discount_pct = 0
        if old_price and cheapest_price > 0 and old_price > cheapest_price:
            discount_pct = round(((old_price - cheapest_price) / old_price) * 100)

        badge = None
        if len(members) > 1 and discount_pct >= 5:
            badge = "أرخص سعر · وفر"
        elif len(members) > 1:
            badge = "أقل سعر موثق"
        elif discount_pct >= 15:
            badge = f"خصم {discount_pct}%"

        desc_final = raw_desc or f"{clean_name} — توريد هندسي بأقل سعر معتمد من قسم {CATEGORY_LABELS_AR.get(cat_id, '')}."

        product_obj: dict[str, Any] = {
            "id": prod_id,
            "code": code,
            "name": clean_name,
            "category": cat_id,
            "brand": brand,
            "unit": unit,
            "price": cheapest_price,
            "currency": "ج.م",
            "description": desc_final,
            "specs": specs,
            "inStock": in_stock,
            "featured": bool(len(members) > 1 or discount_pct >= 15),
        }
        if sub_cat:
            product_obj["subCategory"] = sub_cat
        if old_price:
            product_obj["oldPrice"] = old_price
        if badge:
            product_obj["badge"] = badge
        if variants:
            product_obj["variants"] = variants
        if len(members) > 1:
            product_obj["cheapestSourceCount"] = len({r["source_code"] for r in members})

        products.append(product_obj)
        if local_img_path:
            product_image_files[prod_id] = local_img_path

    stats = {
        "rawRows": len(by_id),
        "mergedCatalogCount": len(products),
        "crossSitePairsMatched": merged_via_cross_match,
        "cheapestMatchedGroups": multi_source_groups,
        "localImagesAvailable": len(product_image_files),
        "categoryBreakdown": dict(sorted(cat_counts.items(), key=lambda x: -x[1])),
    }
    return products, product_image_files, stats


def load_upload_state() -> dict[str, Any]:
    if STATE_PATH.is_file():
        try:
            data = json.loads(STATE_PATH.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                data.setdefault("mediaMap", {})
                data.setdefault("shaIndex", {})
                data.setdefault("productMedia", {})
                return data
        except Exception:
            pass
    return {"mediaMap": {}, "shaIndex": {}, "productMedia": {}}


def save_upload_state(state: dict[str, Any]) -> None:
    tmp = STATE_PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(STATE_PATH)


def compress_to_jpeg(img_path: Path, max_dim: int = 900, quality: int = 82) -> bytes:
    with Image.open(img_path) as im:
        im = ImageOps.exif_transpose(im)
        if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
            rgba = im.convert("RGBA")
            bg = Image.new("RGB", rgba.size, (255, 255, 255))
            bg.paste(rgba, mask=rgba.split()[3])
            im = bg
        elif im.mode != "RGB":
            im = im.convert("RGB")
        w, h = im.size
        if max(w, h) > max_dim:
            im.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, format="JPEG", quality=quality, optimize=True, progressive=True)
        return buf.getvalue()


def telegram_send_document(
    bot_token: str,
    chat_id: str,
    filename: str,
    content: bytes,
    mime_type: str,
    caption: str,
    disable_notification: bool = True,
) -> dict[str, Any]:
    boundary = f"----PhiStoreTg{uuid.uuid4().hex}"
    fields = [
        ("chat_id", chat_id),
        ("disable_notification", "true" if disable_notification else "false"),
        ("disable_content_type_detection", "true"),
        ("caption", caption[:950]),
    ]
    parts: list[bytes] = []
    for k, v in fields:
        parts.append(
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode("utf-8")
        )
    parts.append(
        (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="document"; filename="{filename}"\r\n'
            f"Content-Type: {mime_type}\r\n\r\n"
        ).encode("utf-8")
    )
    parts.append(content)
    parts.append(f"\r\n--{boundary}--\r\n".encode("utf-8"))
    body = b"".join(parts)

    url = f"https://api.telegram.org/bot{bot_token}/sendDocument"
    for attempt in range(4):
        req = urllib.request.Request(
            url,
            data=body,
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            if data.get("ok") and data.get("result"):
                return data["result"]
            raise RuntimeError(f"Telegram API unexpected response: {data}")
        except urllib.error.HTTPError as he:
            err_body = he.read().decode("utf-8", errors="replace")
            if he.code == 429:
                retry_after = 30
                try:
                    ej = json.loads(err_body)
                    retry_after = int(ej.get("parameters", {}).get("retry_after", 30))
                except Exception:
                    pass
                wait_s = retry_after + 5
                print(f"[RATE LIMIT 429] Waiting {wait_s}s before retry...")
                time.sleep(wait_s)
                continue
            raise RuntimeError(f"Telegram HTTP {he.code}: {err_body[:300]}") from he
    raise RuntimeError("Exceeded max retries for Telegram upload")


def ensure_supabase_bucket(sb_url: str, service_key: str) -> None:
    payload = json.dumps({"id": BUCKET_NAME, "name": BUCKET_NAME, "public": True}).encode("utf-8")
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }
    req = urllib.request.Request(
        f"{sb_url.rstrip('/')}/storage/v1/bucket",
        data=payload,
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20):
            print(f"[SUPABASE] Created public storage bucket `{BUCKET_NAME}`")
            return
    except urllib.error.HTTPError as he:
        # 409 / 400 when bucket already exists -> update it to public read-only
        body = he.read().decode("utf-8", errors="replace")
        if he.code in (400, 409) or "already exists" in body.lower() or "duplicate" in body.lower():
            upd_req = urllib.request.Request(
                f"{sb_url.rstrip('/')}/storage/v1/bucket/{BUCKET_NAME}",
                data=payload,
                headers=headers,
                method="PUT",
            )
            try:
                with urllib.request.urlopen(upd_req, timeout=20):
                    print(f"[SUPABASE] Updated storage bucket `{BUCKET_NAME}` to public=True")
                return
            except urllib.error.HTTPError as ue:
                ubody = ue.read().decode("utf-8", errors="replace")
                raise RuntimeError(f"Failed updating bucket HTTP {ue.code}: {ubody}") from ue
        raise RuntimeError(f"Failed creating bucket HTTP {he.code}: {body}") from he


def upload_supabase_json(sb_url: str, service_key: str, object_path: str, payload: Any) -> None:
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    url = f"{sb_url.rstrip('/')}/storage/v1/object/{BUCKET_NAME}/{object_path}"
    req = urllib.request.Request(
        url,
        data=raw,
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json; charset=utf-8",
            "x-upsert": "true",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            resp.read()
    except urllib.error.HTTPError as he:
        body = he.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Failed uploading {object_path} HTTP {he.code}: {body[:300]}") from he


def attach_media_to_products(
    products: list[dict[str, Any]], state: dict[str, Any]
) -> None:
    pmap = state.get("productMedia", {})
    mmap = state.get("mediaMap", {})
    for p in products:
        mid = pmap.get(p["id"])
        if mid and mid in mmap:
            p["mediaId"] = mid
            entry = mmap[mid]
            p["attachments"] = [
                {
                    "id": mid,
                    "name": entry.get("fileName", f"{p['id']}.webp"),
                    "mimeType": entry.get("mimeType", "image/webp"),
                    "size": entry.get("fileSize", 0),
                    "kind": "image",
                }
            ]


def build_round_robin_queue(
    products: list[dict[str, Any]],
    image_files: dict[str, Path],
    state: dict[str, Any],
) -> list[dict[str, Any]]:
    pmap = state.get("productMedia", {})
    mmap = state.get("mediaMap", {})
    by_cat: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for p in products:
        pid = p["id"]
        if pid not in image_files:
            continue
        mid = pmap.get(pid)
        if mid and mid in mmap:
            continue
        by_cat[p["category"]].append(p)

    for cat_id, lst in by_cat.items():
        lst.sort(
            key=lambda p: (
                1 if p.get("featured") else 0,
                int(p.get("cheapestSourceCount") or 1),
                len(p.get("specs") or []),
                1 if p.get("price", 0) > 0 else 0,
            ),
            reverse=True,
        )

    ordered_cats = list(CATEGORY_LABELS_AR.keys())
    queue: list[dict[str, Any]] = []
    idx_map = {c: 0 for c in ordered_cats}
    while True:
        added_any = False
        for c in ordered_cats:
            lst = by_cat.get(c, [])
            i = idx_map[c]
            if i < len(lst):
                queue.append(lst[i])
                idx_map[c] = i + 1
                added_any = True
        if not added_any:
            break
    return queue


def sync_all_to_supabase(
    sb_url: str,
    service_key: str,
    products: list[dict[str, Any]],
    image_files: dict[str, Path],
    state: dict[str, Any],
    stats: dict[str, Any],
) -> dict[str, Any]:
    attach_media_to_products(products, state)
    pending_count = sum(
        1
        for pid in image_files
        if not (state["productMedia"].get(pid) and state["productMedia"][pid] in state["mediaMap"])
    )
    uploaded_products_count = len(image_files) - pending_count
    meta = {
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "totalProducts": len(products),
        "cheapestMatchedGroups": stats["cheapestMatchedGroups"],
        "telegramUploadedImages": uploaded_products_count,
        "telegramUniqueMediaFiles": len(state["mediaMap"]),
        "pendingTelegramImages": pending_count,
        "categoryBreakdown": stats["categoryBreakdown"],
    }
    safe_media_fields = (
        "id",
        "productId",
        "fileName",
        "mimeType",
        "fileSize",
        "sha256",
        "kind",
        "telegramFileId",
    )
    public_media_map = {
        mid: {k: entry[k] for k in safe_media_fields if k in entry}
        for mid, entry in state["mediaMap"].items()
    }
    ensure_supabase_bucket(sb_url, service_key)
    upload_supabase_json(sb_url, service_key, "catalog/media-map.json", public_media_map)
    upload_supabase_json(sb_url, service_key, "catalog/index.json", products)
    upload_supabase_json(sb_url, service_key, "catalog/meta.json", meta)
    return meta


def main() -> int:
    parser = argparse.ArgumentParser(description="PhiTech Store Catalog & Telegram Media Sync")
    parser.add_argument("--build-index", action="store_true", help="Build and upload index metadata to Supabase")
    parser.add_argument("--sync-only", action="store_true", help="Alias for syncing JSON without uploading to Telegram")
    parser.add_argument("--upload-batch", type=int, default=0, help="Images to upload per batch")
    parser.add_argument("--batches", type=int, default=1, help="Number of batches to run sequentially")
    parser.add_argument("--delay", type=float, default=3.5, help="Seconds between Telegram uploads")
    parser.add_argument("--cooldown-every", type=int, default=15, help="Pause every N actual Telegram sends")
    parser.add_argument("--cooldown-secs", type=float, default=15.0, help="Seconds for periodic cooldown")
    parser.add_argument("--batch-cooldown", type=float, default=60.0, help="Seconds to wait between batches")
    args = parser.parse_args()

    env = load_env()
    sb_url = env.get("NEXT_PUBLIC_SUPABASE_URL") or env.get("SUPABASE_URL") or ""
    service_key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_SECRET_KEY") or ""
    bot_token = env.get("TELEGRAM_BOT_TOKEN") or ""
    tg_chat_id = env.get("TELEGRAM_STORE_MEDIA_CHAT_ID") or env.get("TELEGRAM_CHAT_ID") or ""

    if not sb_url or not service_key:
        print("ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local", file=sys.stderr)
        return 1

    products, image_files, stats = build_deduped_catalog()
    print(f"[CATALOG] Built {stats['mergedCatalogCount']} unique cheapest-price products (from {stats['rawRows']} raw rows)")
    print(f"[CATALOG] Cross-site matches merged: {stats['crossSitePairsMatched']} pairs across {stats['cheapestMatchedGroups']} multi-source groups")
    print(f"[CATALOG] Verified local product images on disk: {stats['localImagesAvailable']}")
    print("[CATALOG] Category distribution:")
    for cat_id, cnt in stats["categoryBreakdown"].items():
        print(f"  - {cat_id} ({CATEGORY_LABELS_AR.get(cat_id, cat_id)}): {cnt}")

    state = load_upload_state()

    if args.build_index or args.sync_only or args.upload_batch <= 0:
        meta = sync_all_to_supabase(sb_url, service_key, products, image_files, state, stats)
        print(f"[SUPABASE SYNC] Uploaded index & meta: {json.dumps(meta, ensure_ascii=False)}")
        if args.sync_only or args.upload_batch <= 0:
            return 0

    if not bot_token or not tg_chat_id:
        print("ERROR: Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in .env.local", file=sys.stderr)
        return 1

    actual_api_sends = 0
    for batch_num in range(1, max(1, args.batches) + 1):
        queue = build_round_robin_queue(products, image_files, state)
        if not queue:
            print("[TELEGRAM] All available product images are already synced to Telegram!")
            break

        batch_items = queue[: args.upload_batch]
        print(f"\n[BATCH {batch_num}/{args.batches}] Processing {len(batch_items)} products (remaining pending: {len(queue)})...")
        processed_in_batch = 0

        for idx, p in enumerate(batch_items, 1):
            pid = p["id"]
            img_path = image_files[pid]
            try:
                img_bytes = compress_to_jpeg(img_path, max_dim=900, quality=82)
            except Exception as exc:
                print(f"  [SKIP {pid}] Image decode error ({img_path.name}): {exc}")
                continue

            sha = hashlib.sha256(img_bytes).hexdigest()
            existing_mid = state["shaIndex"].get(sha)
            if existing_mid and existing_mid in state["mediaMap"]:
                state["productMedia"][pid] = existing_mid
                processed_in_batch += 1
                print(f"  [{idx}/{len(batch_items)}] {pid} -> reused deduplicated media {existing_mid} (0 API calls)")
            else:
                media_id = f"m_{sha[:16]}"
                cat_ar = CATEGORY_LABELS_AR.get(p["category"], p["category"])
                price_str = f"{p['price']:,.2f} {p['currency']}" if p.get("price", 0) > 0 else "تسعير عند الطلب"
                caption = f"🛍️ [{cat_ar}] {p['code']} — {p['name']} — {price_str}"
                filename = f"{pid}.jpg"
                msg = telegram_send_document(
                    bot_token=bot_token,
                    chat_id=tg_chat_id,
                    filename=filename,
                    content=img_bytes,
                    mime_type="image/jpeg",
                    caption=caption,
                    disable_notification=True,
                )
                actual_api_sends += 1
                doc = (
                    msg.get("document")
                    or msg.get("sticker")
                    or (msg.get("photo")[-1] if msg.get("photo") else {})
                    or {}
                )
                file_id = str(doc.get("file_id") or "")
                if not file_id:
                    print(f"  [WARN {pid}] Telegram response keys={list(msg.keys())} lacked file_id, skipping.")
                else:
                    entry = {
                        "id": media_id,
                        "productId": pid,
                        "fileName": filename,
                        "mimeType": "image/jpeg",
                        "fileSize": len(img_bytes),
                        "sha256": sha,
                        "kind": "image",
                        "telegramFileId": file_id,
                        "telegramMessageId": str(msg.get("message_id") or ""),
                        "telegramChatId": str((msg.get("chat") or {}).get("id") or tg_chat_id),
                    }
                    state["mediaMap"][media_id] = entry
                    state["shaIndex"][sha] = media_id
                    state["productMedia"][pid] = media_id
                    processed_in_batch += 1
                    save_upload_state(state)
                    print(
                        f"  [{idx}/{len(batch_items)}] {pid} ({cat_ar}) -> uploaded {len(img_bytes)/1024:.1f} KB -> {media_id}"
                    )

                    # Safe periodic checkpoint to Supabase
                    if actual_api_sends % 20 == 0:
                        sync_all_to_supabase(sb_url, service_key, products, image_files, state, stats)
                        print(f"  [CHECKPOINT] Synced {len(state['mediaMap'])} media entries to Supabase")

                if idx < len(batch_items):
                    time.sleep(max(3.0, args.delay))
                    if args.cooldown_every > 0 and actual_api_sends % args.cooldown_every == 0:
                        print(f"  [COOLDOWN] Pausing {args.cooldown_secs}s to protect Telegram rate limits...")
                        time.sleep(args.cooldown_secs)

        save_upload_state(state)
        meta = sync_all_to_supabase(sb_url, service_key, products, image_files, state, stats)
        print(
            f"[BATCH {batch_num} DONE] Processed {processed_in_batch} items | "
            f"Uploaded: {meta['telegramUploadedImages']} | Pending: {meta['pendingTelegramImages']}"
        )

        if batch_num < args.batches and meta["pendingTelegramImages"] > 0:
            print(f"[BATCH COOLDOWN] Waiting {args.batch_cooldown}s before next batch...")
            time.sleep(args.batch_cooldown)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
