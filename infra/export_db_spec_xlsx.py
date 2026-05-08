import csv
import os
import zipfile
from collections import OrderedDict
from datetime import datetime, timezone
from xml.sax.saxutils import escape


BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CSV_PATH = os.path.join(BASE_DIR, "docs", "database", "relational-database-spec.csv")
XLSX_PATH = os.path.join(BASE_DIR, "docs", "database", "relational-database-spec.xlsx")


TABLE_ZH = {
    "users": "\u6703\u54e1\u4e3b\u6a94",
    "indexer_checkpoints": "\u93c8\u4e0a\u7d22\u5f15\u6aa2\u67e5\u9ede",
    "processed_events": "\u5df2\u8655\u7406\u93c8\u4e0a\u4e8b\u4ef6",
    "tasks": "\u623f\u6e90\u59d4\u8a17\u4e3b\u6a94",
    "task_submissions": "\u59d4\u8a17\u9032\u5ea6\u63d0\u4ea4",
    "task_blockchain_logs": "\u59d4\u8a17\u93c8\u4e0a\u7d00\u9304",
    "auth_nonce": "\u767b\u5165\u7c3d\u540d Nonce",
    "wallet_session": "\u767b\u5165 Session",
    "kyc_submissions": "\u6b63\u5f0f KYC \u9001\u5be9",
    "kyc_sessions": "Onboarding \u66ab\u5b58\u6d41\u7a0b",
    "otp_codes": "OTP \u9a57\u8b49\u78bc",
    "user_credentials": "\u89d2\u8272\u8a8d\u8b49\u7533\u8acb",
}


COLUMN_ZH = {
    "id": "\u4e3b\u9375 ID",
    "wallet_address": "\u9322\u5305\u5730\u5740",
    "kyc_status": "KYC \u72c0\u614b",
    "identity_hash": "\u8eab\u5206\u7d81\u5b9a\u96dc\u6e4a",
    "identity_nft_token_id": "\u8eab\u4efd NFT Token ID",
    "kyc_mint_tx_hash": "KYC Mint \u4ea4\u6613\u96dc\u6e4a",
    "kyc_submitted_at": "KYC \u9001\u51fa\u6642\u9593",
    "kyc_verified_at": "KYC \u901a\u904e\u6642\u9593",
    "created_at": "\u5efa\u7acb\u6642\u9593",
    "updated_at": "\u66f4\u65b0\u6642\u9593",
    "email": "\u96fb\u5b50\u90f5\u4ef6",
    "phone": "\u624b\u6a5f\u865f\u78bc",
    "display_name": "\u986f\u793a\u540d\u7a31",
    "email_verified": "Email \u5df2\u9a57\u8b49",
    "phone_verified": "\u624b\u6a5f\u5df2\u9a57\u8b49",
    "person_hash": "\u500b\u4eba\u552f\u4e00\u96dc\u6e4a",
    "password_hash": "\u5bc6\u78bc\u96dc\u6e4a",
    "contract_name": "\u5408\u7d04\u540d\u7a31",
    "last_processed_block": "\u6700\u5f8c\u8655\u7406\u5340\u584a",
    "tx_hash": "\u4ea4\u6613\u96dc\u6e4a",
    "log_index": "Log \u7d22\u5f15",
    "event_name": "\u4e8b\u4ef6\u540d\u7a31",
    "block_number": "\u5340\u584a\u9ad8\u5ea6",
    "task_id": "\u59d4\u8a17\u8b58\u5225\u78bc",
    "assignee_wallet_address": "\u627f\u8fa6\u9322\u5305\u5730\u5740",
    "title": "\u6a19\u984c",
    "description": "\u8aaa\u660e",
    "status": "\u72c0\u614b",
    "priority": "\u512a\u5148\u5ea6",
    "reward_amount": "\u9810\u7b97\u91d1\u984d",
    "fee_bps": "\u5e73\u53f0\u8cbb\u7387 BPS",
    "chain_id": "\u93c8 ID",
    "vault_contract_address": "\u91d1\u5eab\u5408\u7d04\u5730\u5740",
    "contract_task_id": "\u93c8\u4e0a\u59d4\u8a17 ID",
    "onchain_status": "\u93c8\u4e0a\u72c0\u614b",
    "fund_tx_hash": "\u6ce8\u8cc7\u4ea4\u6613",
    "approve_tx_hash": "\u6838\u51c6\u4ea4\u6613",
    "claim_tx_hash": "\u8acb\u6b3e\u4ea4\u6613",
    "cancel_tx_hash": "\u53d6\u6d88\u4ea4\u6613",
    "due_date": "\u622a\u6b62\u6642\u9593",
    "result_content": "\u9032\u5ea6\u5167\u5bb9",
    "result_file_url": "\u88dc\u5145\u6a94\u6848\u9023\u7d50",
    "result_hash": "\u5167\u5bb9\u96dc\u6e4a",
    "submitted_at": "\u9001\u51fa\u6642\u9593",
    "action": "\u52d5\u4f5c\u985e\u578b",
    "contract_address": "\u5408\u7d04\u5730\u5740",
    "nonce": "Nonce \u503c",
    "issued_at": "\u7c3d\u767c\u6642\u9593",
    "expired_at": "\u5230\u671f\u6642\u9593",
    "used": "\u662f\u5426\u5df2\u4f7f\u7528",
    "session_token": "Session Token",
    "revoked": "\u662f\u5426\u64a4\u92b7",
    "user_id": "\u6703\u54e1 ID",
    "id_front_path": "\u8b49\u4ef6\u6b63\u9762\u8def\u5f91",
    "id_back_path": "\u8b49\u4ef6\u53cd\u9762\u8def\u5f91",
    "selfie_path": "\u81ea\u62cd\u8def\u5f91",
    "ocr_name": "OCR \u59d3\u540d",
    "ocr_birth_date": "OCR \u51fa\u751f\u65e5\u671f",
    "ocr_issue_date": "OCR \u767c\u8b49\u65e5\u671f",
    "ocr_issue_location": "OCR \u767c\u8b49\u5730\u9ede",
    "ocr_address": "OCR \u5730\u5740",
    "ocr_father_name": "OCR \u7236\u89aa\u59d3\u540d",
    "ocr_mother_name": "OCR \u6bcd\u89aa\u59d3\u540d",
    "ocr_spouse_name": "OCR \u914d\u5076\u59d3\u540d",
    "face_match_score": "\u4eba\u81c9\u6bd4\u5c0d\u5206\u6578",
    "ocr_success": "OCR \u662f\u5426\u6210\u529f",
    "review_status": "\u5be9\u6838\u72c0\u614b",
    "reviewer_note": "\u5be9\u6838\u5099\u8a3b",
    "reviewed_by_wallet": "\u5be9\u6838\u8005\u9322\u5305",
    "reviewed_at": "\u5be9\u6838\u6642\u9593",
    "confirmed_name": "\u78ba\u8a8d\u59d3\u540d",
    "confirmed_birth_date": "\u78ba\u8a8d\u751f\u65e5",
    "ocr_id_number_hint": "\u8b49\u865f\u63d0\u793a",
    "second_doc_path": "\u7b2c\u4e8c\u8b49\u4ef6\u8def\u5f91",
    "step": "\u6d41\u7a0b\u6b65\u9a5f",
    "bound_user_id": "\u7d81\u5b9a\u6703\u54e1 ID",
    "target": "\u9a57\u8b49\u76ee\u6a19",
    "channel": "\u767c\u9001\u901a\u9053",
    "code": "\u9a57\u8b49\u78bc",
    "session_id": "\u6d41\u7a0b Session ID",
    "credential_type": "\u8a8d\u8b49\u985e\u578b",
    "doc_path": "\u6587\u4ef6\u8def\u5f91",
    "nft_token_id": "NFT Token ID",
    "verified_at": "\u6838\u767c\u6642\u9593",
    "processed_at": "\u8655\u7406\u6642\u9593",
}


def domain_for(table: str) -> str:
    if table in {"users", "kyc_submissions", "kyc_sessions", "otp_codes", "user_credentials"}:
        return "Identity / KYC"
    if table in {"auth_nonce", "wallet_session"}:
        return "Auth"
    if table in {"tasks", "task_submissions", "task_blockchain_logs"}:
        return "Listing / Case Compatibility"
    return "Indexer"


def summary_for(table: str) -> str:
    return {
        "users": "\u6703\u54e1\u4e3b\u5e33\u865f\u8207\u767b\u5165/KYC \u6838\u5fc3\u8cc7\u6599\u3002",
        "indexer_checkpoints": "\u6bcf\u500b\u93c8\u4e0a worker \u7684\u8655\u7406\u9032\u5ea6\u3002",
        "processed_events": "\u93c8\u4e0a\u4e8b\u4ef6\u53bb\u91cd\u8207\u51aa\u7b49\u63a7\u5236\u3002",
        "tasks": "\u73fe\u884c\u623f\u6e90/\u59d4\u8a17\u76f8\u5bb9\u4e3b\u8868\u3002",
        "task_submissions": "\u59d4\u8a17\u9032\u5ea6\u6216\u6210\u679c\u63d0\u4ea4\u3002",
        "task_blockchain_logs": "\u59d4\u8a17\u93c8\u4e0a\u64cd\u4f5c\u6b77\u7a0b\u3002",
        "auth_nonce": "SIWE nonce \u66ab\u5b58\u3002",
        "wallet_session": "\u767b\u5165 cookie \u5c0d\u61c9\u7684 session\u3002",
        "kyc_submissions": "\u6b63\u5f0f KYC \u9001\u5be9\u8207\u5be9\u67e5\u8ecc\u8de1\u3002",
        "kyc_sessions": "KYC-first onboarding \u66ab\u5b58\u6d41\u7a0b\u3002",
        "otp_codes": "Email/SMS OTP \u9a57\u8b49\u78bc\u3002",
        "user_credentials": "\u5c4b\u4e3b/\u79df\u5ba2/\u4ef2\u4ecb\u89d2\u8272\u8a8d\u8b49\u7533\u8acb\u3002",
    }.get(table, "")


def col_letter(idx: int) -> str:
    result = ""
    while idx:
        idx, rem = divmod(idx - 1, 26)
        result = chr(65 + rem) + result
    return result


def xml_header() -> str:
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'


def esc(value) -> str:
    return escape("" if value is None else str(value))


def make_inline(ref: str, value, style: int = 0) -> str:
    return f'<c r="{ref}" t="inlineStr" s="{style}"><is><t>{esc(value)}</t></is></c>'


def make_formula(ref: str, formula: str, style: int = 0) -> str:
    return f'<c r="{ref}" s="{style}"><f>{esc(formula)}</f></c>'


def sheet_xml(rows_data, widths, freeze_row=None, autofilter_ref=None, merges=None) -> str:
    merges = merges or []
    row_xml = []
    for r_idx, row in enumerate(rows_data, start=1):
        cells = []
        for c_idx, cell in enumerate(row, start=1):
            ref = f"{col_letter(c_idx)}{r_idx}"
            if isinstance(cell, dict) and "formula" in cell:
                cells.append(make_formula(ref, cell["formula"], cell.get("style", 0)))
            else:
                value = cell.get("value", "") if isinstance(cell, dict) else cell
                style = cell.get("style", 0) if isinstance(cell, dict) else 0
                cells.append(make_inline(ref, value, style))
        row_xml.append(f'<row r="{r_idx}">' + "".join(cells) + "</row>")

    cols = "".join(
        f'<col min="{idx}" max="{idx}" width="{width}" customWidth="1"/>'
        for idx, width in enumerate(widths, start=1)
    )

    if freeze_row:
        pane = (
            '<sheetViews><sheetView workbookViewId="0">'
            f'<pane ySplit="{freeze_row - 1}" topLeftCell="A{freeze_row}" activePane="bottomLeft" state="frozen"/>'
            '<selection pane="bottomLeft" activeCell="A1" sqref="A1"/>'
            "</sheetView></sheetViews>"
        )
    else:
        pane = '<sheetViews><sheetView workbookViewId="0"/></sheetViews>'

    merge_xml = ""
    if merges:
        merge_xml = '<mergeCells count="%d">%s</mergeCells>' % (
            len(merges),
            "".join(f'<mergeCell ref="{ref}"/>' for ref in merges),
        )

    dimension = f"A1:{col_letter(len(rows_data[0]))}{len(rows_data)}"
    auto_filter = f'<autoFilter ref="{autofilter_ref}"/>' if autofilter_ref else ""

    return (
        xml_header()
        + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        + f'<dimension ref="{dimension}"/>'
        + pane
        + '<sheetFormatPr defaultRowHeight="15"/>'
        + f"<cols>{cols}</cols>"
        + f"<sheetData>{''.join(row_xml)}</sheetData>"
        + auto_filter
        + merge_xml
        + "</worksheet>"
    )


def build_styles() -> str:
    return xml_header() + """<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="4">
<font><sz val="11"/><name val="Aptos"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/><family val="2"/></font>
<font><b/><sz val="13"/><name val="Aptos"/><family val="2"/></font>
<font><i/><sz val="10"/><color rgb="FF666666"/><name val="Aptos"/><family val="2"/></font>
</fonts>
<fills count="8">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEAF2F8"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFDDEBF7"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE2F0D9"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFCE4D6"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF4CCCC"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="9">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="0" fillId="7" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>"""


def main():
    with open(CSV_PATH, "r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))

    tables = OrderedDict()
    for row in rows:
        tables.setdefault(row["table_name"], []).append(row)

    relationships = []
    for row in rows:
        ref = (row.get("references") or "").strip()
        if not ref:
            continue
        if "(" in ref and ref.endswith(")"):
            remote_table, remote_col = ref[:-1].split("(", 1)
            relationships.append(
                {
                    "from_table": row["table_name"],
                    "from_table_zh": TABLE_ZH.get(row["table_name"], row["table_name"]),
                    "from_column": row["column_name"],
                    "from_column_zh": COLUMN_ZH.get(row["column_name"], row["column_name"]),
                    "to_table": remote_table,
                    "to_table_zh": TABLE_ZH.get(remote_table, remote_table),
                    "to_column": remote_col,
                    "to_column_zh": COLUMN_ZH.get(remote_col, remote_col),
                    "relation": "FK",
                }
            )

    sheet_names = ["Tables", "Relationships"] + list(tables.keys())
    sheets = []

    tables_rows = [
        [{"value": "Project Relational Database Spec", "style": 2}, "", "", "", ""],
        [{"value": "Current live relational schema for the housing platform", "style": 8}, "", "", "", ""],
        [
            {"value": "table_name", "style": 1},
            {"value": "table_name_zh", "style": 1},
            {"value": "domain", "style": 1},
            {"value": "summary", "style": 1},
            {"value": "open_sheet", "style": 1},
        ],
    ]
    for table in tables:
        tables_rows.append(
            [
                {"formula": f'HYPERLINK("#\'{table}\'!A1","{table}")', "style": 3},
                {"value": TABLE_ZH.get(table, table), "style": 3},
                {"value": domain_for(table), "style": 3},
                {"value": summary_for(table), "style": 3},
                {"formula": f'HYPERLINK("#\'{table}\'!A1","Open")', "style": 3},
            ]
        )
    sheets.append(
        sheet_xml(
            tables_rows,
            widths=[24, 20, 24, 62, 12],
            freeze_row=3,
            autofilter_ref=f"A3:E{len(tables_rows)}",
            merges=["A1:E1", "A2:E2"],
        )
    )

    rel_rows = [
        [{"value": "ER / Relationship Summary", "style": 2}, "", "", "", "", "", "", "", ""],
        [{"value": "目前 live schema 的 FK 關聯摘要", "style": 8}, "", "", "", "", "", "", "", ""],
        [
            {"value": "from_table", "style": 1},
            {"value": "from_table_zh", "style": 1},
            {"value": "from_column", "style": 1},
            {"value": "from_column_zh", "style": 1},
            {"value": "to_table", "style": 1},
            {"value": "to_table_zh", "style": 1},
            {"value": "to_column", "style": 1},
            {"value": "to_column_zh", "style": 1},
            {"value": "relation", "style": 1},
        ],
    ]
    for relation in relationships:
        rel_rows.append(
            [
                {"value": relation["from_table"], "style": 3},
                {"value": relation["from_table_zh"], "style": 3},
                {"value": relation["from_column"], "style": 3},
                {"value": relation["from_column_zh"], "style": 3},
                {"value": relation["to_table"], "style": 3},
                {"value": relation["to_table_zh"], "style": 3},
                {"value": relation["to_column"], "style": 3},
                {"value": relation["to_column_zh"], "style": 3},
                {"value": relation["relation"], "style": 3},
            ]
        )
    sheets.append(
        sheet_xml(
            rel_rows,
            widths=[18, 18, 20, 20, 18, 18, 18, 18, 10],
            freeze_row=3,
            autofilter_ref=f"A3:I{len(rel_rows)}",
            merges=["A1:I1", "A2:I2"],
        )
    )

    for table, table_rows in tables.items():
        rows_data = [
            [{"value": table, "style": 2}, "", "", "", "", "", "", "", ""],
            [{"formula": 'HYPERLINK("#\'Tables\'!A1","Back to Tables")', "style": 8}, "", "", "", "", "", "", "", ""],
            [
                {"value": "中文表名", "style": 1},
                {"value": TABLE_ZH.get(table, table), "style": 3},
                {"value": "Domain", "style": 1},
                {"value": domain_for(table), "style": 3},
                {"value": "Summary", "style": 1},
                {"value": summary_for(table), "style": 3},
                {"value": "", "style": 3},
                {"value": "", "style": 3},
                {"value": "", "style": 3},
            ],
            [
                {"value": "column_name", "style": 1},
                {"value": "column_name_zh", "style": 1},
                {"value": "data_type", "style": 1},
                {"value": "nullable", "style": 1},
                {"value": "default", "style": 1},
                {"value": "key_type", "style": 1},
                {"value": "references", "style": 1},
                {"value": "used_by", "style": 1},
                {"value": "definition", "style": 1},
            ],
        ]

        for row in table_rows:
            key_type = (row["key_type"] or "").upper()
            key_style = 3
            if "PK" in key_type:
                key_style = 4
            elif "FK" in key_type:
                key_style = 5
            elif "UNIQUE" in key_type:
                key_style = 6
            elif "INDEX" in key_type:
                key_style = 7
            rows_data.append(
                [
                    {"value": row["column_name"], "style": 3},
                    {"value": COLUMN_ZH.get(row["column_name"], row["column_name"]), "style": 3},
                    {"value": row["data_type"], "style": 3},
                    {"value": row["nullable"], "style": 3},
                    {"value": row["default"], "style": 3},
                    {"value": row["key_type"], "style": key_style},
                    {"value": row["references"], "style": 3},
                    {"value": row["used_by"], "style": 3},
                    {"value": row["definition"], "style": 3},
                ]
            )

        sheets.append(
            sheet_xml(
                rows_data,
                widths=[22, 20, 16, 10, 14, 14, 22, 22, 58],
                freeze_row=4,
                autofilter_ref=f"A4:I{len(rows_data)}",
                merges=["A1:I1", "A2:I2"],
            )
        )

    content_types = (
        xml_header()
        + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
        + '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
        + "".join(
            f'<Override PartName="/xl/worksheets/sheet{idx}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            for idx in range(1, len(sheet_names) + 1)
        )
        + "</Types>"
    )
    root_rels = (
        xml_header()
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
        + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
        + "</Relationships>"
    )
    workbook = (
        xml_header()
        + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
        + "".join(
            f'<sheet name="{esc(name)}" sheetId="{idx}" r:id="rId{idx}"/>'
            for idx, name in enumerate(sheet_names, start=1)
        )
        + "</sheets></workbook>"
    )
    workbook_rels = (
        xml_header()
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + "".join(
            f'<Relationship Id="rId{idx}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{idx}.xml"/>'
            for idx in range(1, len(sheet_names) + 1)
        )
        + f'<Relationship Id="rId{len(sheet_names) + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        + "</Relationships>"
    )

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    core = (
        xml_header()
        + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        + "<dc:title>Project Relational Database Spec</dc:title>"
        + "<dc:creator>Codex</dc:creator>"
        + "<cp:lastModifiedBy>Codex</cp:lastModifiedBy>"
        + f'<dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created>'
        + f'<dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified>'
        + "</cp:coreProperties>"
    )
    app = (
        xml_header()
        + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
        + "<Application>Codex</Application>"
        + "<HeadingPairs><vt:vector size=\"2\" baseType=\"variant\"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>"
        + str(len(sheet_names))
        + "</vt:i4></vt:variant></vt:vector></HeadingPairs>"
        + f'<TitlesOfParts><vt:vector size="{len(sheet_names)}" baseType="lpstr">'
        + "".join(f"<vt:lpstr>{esc(name)}</vt:lpstr>" for name in sheet_names)
        + "</vt:vector></TitlesOfParts></Properties>"
    )

    with zipfile.ZipFile(XLSX_PATH, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", root_rels)
        zf.writestr("docProps/core.xml", core)
        zf.writestr("docProps/app.xml", app)
        zf.writestr("xl/workbook.xml", workbook)
        zf.writestr("xl/_rels/workbook.xml.rels", workbook_rels)
        zf.writestr("xl/styles.xml", build_styles())
        for idx, sheet in enumerate(sheets, start=1):
            zf.writestr(f"xl/worksheets/sheet{idx}.xml", sheet)

    print(XLSX_PATH)
    print(f"sheets={len(sheet_names)} relationships={len(relationships)}")


if __name__ == "__main__":
    main()
