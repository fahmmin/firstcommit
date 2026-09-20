"""seed_hardware.py — make the demo feel REAL.

Resets the tenant to the hardware-business seed, then generates genuine
.xlsx / .pdf business documents and pushes them through the real
/context/upload pipeline (extract → Bedrock auto-tag → Titan embed → store)
and copies the raw files to S3 so document search + context are backed by
actual files, not pretend metadata.

    python simulation/seed_hardware.py            # local mode
    USE_AWS=1 python simulation/seed_hardware.py  # live AWS — files land in S3

Idempotent: safe to re-run (documents get new ids; S3 objects are overwritten).
"""
import io
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
from dotenv import load_dotenv  # noqa: E402
load_dotenv(Path(__file__).resolve().parent.parent / ".env")  # before the default
os.environ.setdefault("USE_AWS", "0")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import boto3  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from fpdf import FPDF  # noqa: E402
from openpyxl import Workbook  # noqa: E402

from app.main import app  # noqa: E402

TENANT = "ramesh_auto"
FIXTURES = Path(__file__).resolve().parent / "fixtures"
FIXTURES.mkdir(exist_ok=True)


# ---------------------------------------------------------------- xlsx
def xlsx(name: str, sheets: dict[str, list[list]]) -> Path:
    wb = Workbook()
    for i, (sheet, rows) in enumerate(sheets.items()):
        ws = wb.active if i == 0 else wb.create_sheet(sheet[:31])
        ws.title = sheet[:31]
        for r in rows:
            ws.append(r)
    p = FIXTURES / name
    wb.save(p)
    return p


# ---------------------------------------------------------------- pdf
def pdf(name: str, title: str, lines: list[str]) -> Path:
    def safe(s: str) -> str:  # core fonts are latin-1 — swap fancy punctuation
        return (s.replace("—", "-").replace("–", "-").replace("₹", "Rs.")
                 .replace("‘", "'").replace("’", "'").replace("“", '"').replace("”", '"')
                 .encode("latin-1", "replace").decode("latin-1"))
    doc = FPDF()
    doc.add_page()
    doc.set_font("helvetica", "B", 16)
    doc.cell(0, 10, safe(title), new_x="LMARGIN", new_y="NEXT")
    doc.set_font("helvetica", "", 11)
    doc.ln(4)
    for ln in lines:
        doc.cell(0, 7, safe(ln), new_x="LMARGIN", new_y="NEXT")
    p = FIXTURES / name
    doc.output(str(p))
    return p


def build_fixtures() -> list[Path]:
    files = []

    files.append(xlsx("Sales_Register_Sept2026.xlsx", {"Sales": [
        ["invoice_no", "date", "buyer", "item", "qty", "rate", "taxable", "gst18", "total", "status"],
        ["INV-1029", "2026-05-15", "Sharma Constructions", "Cement OPC-53 bags", 120, 260, 31200, 5616, 36200, "overdue"],
        ["INV-1031", "2026-06-20", "Sharma Constructions", "GI pipes 2 inch lengths", 60, 640, 38400, 6912, 45200, "overdue"],
        ["INV-1033", "2026-06-10", "Patel Furniture House", "Plywood 19mm + hinges", 85, 780, 66300, 11934, 78800, "overdue"],
        ["INV-1035", "2026-07-01", "Khanna Builders", "Copper wire 1.5mm coils", 180, 590, 106200, 19116, 124500, "due_soon"],
        ["INV-1037", "2026-08-01", "Sharma Constructions", "MS angles + channels", 2100, 29, 60900, 10962, 71300, "overdue"],
        ["INV-1040", "2026-07-10", "Delhi Metro Contractors", "Fastener assortment boxes", 500, 163, 81500, 14670, 96500, "due_soon"],
        ["INV-1041", "2026-08-25", "Khanna Builders", "Asian Paints emulsion buckets", 45, 1050, 47250, 8505, 56000, "due_soon"],
        ["INV-1043", "2026-09-05", "Om Sai Electric Works", "LED panels 18W + drivers", 150, 110, 16500, 2970, 19500, "sent"],
        ["INV-1044", "2026-09-10", "Patel Furniture House", "MDF boards + edge banding", 200, 375, 75000, 13500, 88700, "sent"],
        ["INV-1045", "2026-09-12", "Verma Interiors", "Mortise locks + door closers", 80, 370, 29600, 5328, 34800, "sent"],
        ["INV-1046", "2026-09-15", "Gupta Builders & Co", "TMT rebar 12mm", 3200, 40, 128000, 23040, 152400, "sent"],
    ]}))

    files.append(xlsx("Inventory_Stock_Sheet.xlsx", {"Stock": [
        ["sku", "item", "category", "qty_on_hand", "reorder_level", "unit_rate", "godown", "rack"],
        ["FST-M12-HEX", "Hex bolts M12 x50mm", "fasteners", 340, 500, 3.2, "A", "A-12"],
        ["PIP-GI-2IN", "GI pipe 2 inch x6m", "pipes", 210, 150, 640, "A", "yard"],
        ["WIR-CU-15", "Copper wire 1.5mm coil 90m", "electrical", 95, 80, 590, "B", "B-04"],
        ["SWI-MOD-6A", "Modular switch 6A", "electrical", 620, 400, 42, "B", "B-09"],
        ["PNT-EMU-20L", "Emulsion paint 20L", "paints", 38, 30, 1050, "B", "B-01"],
        ["CEM-OPC53", "Cement OPC-53 50kg", "cement", 260, 200, 345, "B", "floor"],
        ["PLY-COM-19", "Commercial plywood 19mm", "boards", 74, 60, 780, "C", "C-02"],
        ["TLK-MRT-80", "Mortise lock set", "fittings", 96, 60, 370, "C", "C-07"],
        ["ABR-CTW-4", "Cutting wheel 4 inch", "abrasives", 840, 500, 18, "A", "A-15"],
        ["LED-PNL-18", "LED panel 18W", "electrical", 155, 120, 110, "B", "B-11"],
        ["REB-TMT-12", "TMT rebar 12mm", "steel", 4200, 3000, 40, "A", "yard"],
        ["WLD-RD-6013", "Welding rod E6013 pkt", "welding", 140, 100, 55, "C", "C-11"],
    ]}))

    files.append(xlsx("Attendance_Sept2026.xlsx", {"Attendance": [
        ["employee", "role", "days_present", "ot_hours", "advance", "monthly_salary", "notes"],
        ["Suresh Kumar", "godown manager", 24, 12, 0, 22000, "handles B godown"],
        ["Manoj Yadav", "counter sales", 25, 8, 3000, 18000, "advance for sister's wedding"],
        ["Ravi Shankar", "delivery + loading", 23, 20, 0, 16500, "drives the tempo"],
        ["Pooja Sharma", "accounts + billing", 26, 4, 0, 24000, "does Tally entries"],
        ["Amit Singh", "counter sales", 21, 6, 1500, 18000, "2 CL + 2 unpaid"],
        ["Deepak Verma", "loading helper", 25, 15, 0, 14000, ""],
    ]}))

    files.append(xlsx("GSTR3B_Aug2026.xlsx", {"GSTR-3B": [
        ["section", "description", "taxable", "igst", "cgst", "sgst", "total_tax"],
        ["3.1(a)", "Outward supplies (18%)", 1080000, 0, 97200, 97200, 194400],
        ["3.1(d)", "Inward supplies liable to RCM", 0, 0, 0, 0, 0],
        ["4(a)", "ITC available — purchases", 730000, 0, 65700, 65700, 131400],
        ["net", "Net tax payable in cash", "", "", "", "", 63000],
    ]}))

    files.append(xlsx("Supplier_Rate_List.xlsx", {"Rates": [
        ["supplier", "item", "rate", "moq", "lead_days", "verified"],
        ["Balaji Steel Traders", "GI pipe 2in", 62, 500, 4, "yes"],
        ["Khurana Metals", "GI pipe 2in", 58, 1000, 7, "yes"],
        ["National Fastener Co", "Hex bolt M12", 3.2, 1000, 2, "yes"],
        ["Bharat Bolts", "Hex bolt M12", 2.8, 2000, 6, "yes"],
        ["Shree PVC Udyog", "PVC conduit 25mm", 95, 200, 3, "yes"],
        ["Rathi Copper House", "Copper wire 1.5mm", 2.1, 2000, 5, "yes"],
        ["Lakshmi Cement Agency", "Cement OPC-53", 345, 750, 5, "yes"],
        ["Gupta Paints Depot", "Emulsion 20L", 1050, 300, 10, "yes"],
        ["Trident Abrasives", "Cutting wheel 4in", 18, 150, 5, "yes"],
        ["Punjab Welding Works", "Welding rod E6013", 55, 200, 6, "yes"],
    ]}))

    files.append(xlsx("Delivery_Chalan_Log.xlsx", {"Chalans": [
        ["chalan_no", "order", "carrier", "route", "kg", "rate_kg", "freight", "dispatched", "status"],
        ["DC-0881", "ORD-1038", "VRL Logistics", "Faridabad-Delhi", 620, 2.8, 1736, "2026-09-14", "delivered"],
        ["DC-0885", "ORD-1040", "TCI Express", "Faridabad-Ludhiana", 900, 5.2, 4680, "2026-09-16", "delivered"],
        ["DC-0889", "ORD-1042", "SafeRoad Carriers", "Faridabad-Ludhiana", 480, 3.9, 1872, "2026-09-19", "in_transit"],
        ["DC-0892", "ORD-1044", "Delhi Punjab Roadlines", "Faridabad-Jaipur", 350, 4.1, 1435, "2026-09-20", "booked"],
    ]}))

    files.append(pdf("Shop_Rent_Agreement.pdf", "Shop & Godown Rent Agreement", [
        "This agreement is made on 01 April 2024 between LANDLORD Mr. Harish Chandra",
        "Aggarwal (S/o Late Ram Lal), resident of Sector 21, Faridabad, and TENANT",
        "Ramesh Gupta, proprietor of Ramesh Hardware & Electricals.",
        "",
        "Premises: Shop No. 14 + Godown B, Hardware Market, NIT-3, Faridabad 121001.",
        "Monthly rent: Rs. 42,000 for the shop and Rs. 18,000 for Godown B.",
        "Lock-in period: 3 years. Escalation: 7% every year on the last rent paid.",
        "Security deposit: Rs. 1,80,000 (refundable).",
        "Tenant shall use premises only for hardware trade; subletting prohibited.",
        "Either party may terminate with 2 months written notice after lock-in.",
        "",
        "Signed: Harish Chandra Aggarwal          Ramesh Gupta",
    ]))

    files.append(pdf("GST_Registration_Certificate.pdf", "Form GST REG-06 — Registration Certificate", [
        "Goods and Services Tax Identification Number (GSTIN): 06AABCR9618K1Z4",
        "Legal name: RAMESH GUPTA",
        "Trade name: RAMESH HARDWARE & ELECTRICALS",
        "Constitution of business: Proprietorship",
        "Principal place of business: Shop 14, Hardware Market, NIT-3,",
        "Faridabad, Haryana, 121001",
        "Date of registration: 14 July 2019",
        "Type of registration: Regular",
        "Goods dealt in: hardware, fasteners, GI pipes, electrical goods, paints.",
        "HSN: 7306, 7318, 8544, 3209, 2523",
        "",
        "This certificate is issued under the Central Goods and Services Tax",
        "Act, 2017 and the Haryana Goods and Services Tax Act, 2017.",
    ]))

    files.append(pdf("Fire_Insurance_Policy.pdf", "Bharat Sookshma Udyam Suraksha — Policy Schedule", [
        "Insurer: New India Assurance Co. Ltd.",
        "Policy no: NIA/FBD/2026/771122   UIN: IRDAN190RP0017V01201920",
        "Insured: Ramesh Hardware & Electricals, Shop 14 + Godown B, NIT-3, Faridabad",
        "Sum insured: Building contents Rs. 65,00,000; Stock Rs. 45,00,000",
        "Period: 05 Jan 2026 to 04 Jan 2027   Premium paid: Rs. 38,940",
        "Cover: fire, lightning, explosion/implosion, aircraft damage, riot & strike,",
        "storm/cyclone/flood/inundation, impact damage, bursting of water tanks.",
        "Special condition: stock stored on racks min 15cm above floor (basement NA).",
        "Claim intimation: within 7 days of loss to faridabad@nia.co.in",
    ]))

    files.append(pdf("Trade_License.pdf", "Municipal Corporation Faridabad — Trade License", [
        "License no: MCF/TL/2024/09183",
        "Issued to: Ramesh Hardware & Electricals",
        "Proprietor: Ramesh Gupta",
        "Trade: retail & wholesale of hardware, electrical goods and paints",
        "Premises: Shop 14, Hardware Market, NIT-3, Faridabad 121001",
        "Valid from: 01 Apr 2024   Valid upto: 31 Mar 2027",
        "Annual fee paid: Rs. 2,400",
        "Conditions: no storage of inflammable paints above 200L; fire",
        "extinguishers to be maintained on premises at all times.",
    ]))

    return files


# ---------------------------------------------------------------- s3
def s3_upload(files: list[Path]) -> int:
    if os.getenv("USE_AWS") != "1":
        print("[skip] S3 upload — USE_AWS=0")
        return 0
    bucket = os.getenv("S3_BUCKET", "sahayak-sessions")
    s3 = boto3.Session(profile_name=os.getenv("AWS_PROFILE") or None,
                       region_name=os.getenv("AWS_REGION", "us-east-1")).client("s3")
    n = 0
    for f in files:
        s3.upload_file(str(f), bucket, f"context/{TENANT}/{f.name}")
        n += 1
    return n


def main() -> int:
    files = build_fixtures()
    print(f"[fixtures] generated {len(files)} files in {FIXTURES}")

    with TestClient(app) as c:
        # demo gate — deployed backend requires x-demo-token; local runs don't set it
        if os.getenv("DEMO_GATE_TOKEN"):
            c.headers["x-demo-token"] = os.environ["DEMO_GATE_TOKEN"]

        # 1. fresh tenant state from seed.json
        r = c.post("/demo/reset", params={"tenant_id": TENANT})
        print(f"[reset] {r.json()}")

        # 2. real files through the real ingest pipeline
        ok = 0
        for f in files:
            mime = ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    if f.suffix == ".xlsx" else "application/pdf")
            res = c.post("/context/upload",
                         files={"file": (f.name, f.read_bytes(), mime)},
                         data={"tenant_id": TENANT})
            d = res.json()
            if res.status_code == 200 and d.get("id"):
                ok += 1
                print(f"  [doc] {f.name} -> {d['id']}  tags={d.get('tags')}")
            else:
                print(f"  [FAIL] {f.name}: {res.status_code} {d}")
        print(f"[ingest] {ok}/{len(files)} documents stored + embedded")

        # 3. copy raw files to S3 (AWS mode)
        print(f"[s3] uploaded {s3_upload(files)} files to context/{TENANT}/")

        # 4. hire the factory agents a real hardware shop would want
        for tpl in ("collections-agent", "compliance-agent", "hire-logistics", "digital-presence"):
            res = c.post(f"/templates/{tpl}/install", json={"tenant_id": TENANT}).json()
            if res.get("id"):
                print(f"  [agent] {tpl} -> spec {res['id']} ({res.get('status')})")
            else:
                print(f"  [agent] {tpl}: {res.get('status')} — {res.get('prompt', '')[:60]}")

        # 5. owner memories beyond the seed — things files can't tell agents
        for text in (
            "Godown A is the yard — pipes, rebar, angles. Godown B is dry storage: cement, paints.",
            "SafeRoad is cheapest to Ludhiana but unreliable in monsoon — book VRL when raining.",
            "Festival season (Oct-Nov): fasteners and LED panels sell 3x — reorder early.",
            "Suresh manages godown keys; Pooja handles all GST/Tally work.",
        ):
            c.post("/memories", json={"tenant_id": TENANT, "text": text, "source": "owner"})

        # 6. verify — the files should be searchable + agents should see them
        docs = c.get("/context", params={"tenant_id": TENANT}).json()
        print(f"[verify] {len(docs)} docs in context")
        # substring search (offline) — semantic embeddings widen this on AWS
        for q in ("rent", "attendance", "fasteners"):
            hit = c.get("/search", params={"tenant_id": TENANT, "q": q}).json()
            doc_hits = hit.get("results", {}).get("documents", [])
            print(f"[verify] search '{q}' -> {len(doc_hits)} doc hits"
                  + (f" (top: {doc_hits[0]['title']})" if doc_hits else ""))
        agents = c.get("/agents", params={"tenant_id": TENANT}).json()
        print(f"[verify] {len(agents)} agents live ({sum(1 for a in agents if a.get('created_by') == 'factory')} factory)")

    print("[done] hardware business seeded — real files, real docs, real agents")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
