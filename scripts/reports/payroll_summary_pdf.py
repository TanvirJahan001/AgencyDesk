"""
Payroll Summary — Printable PDF

Reads JSON from stdin (same shape as monthly_payroll_xlsx.py).
Writes PDF to argv[1].

Uses reportlab to create a professional, print-ready summary.
"""

import json, sys
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER

data = json.load(sys.stdin)
out_path = sys.argv[1]

doc = SimpleDocTemplate(
    out_path,
    pagesize=landscape(letter),
    leftMargin=0.6*inch, rightMargin=0.6*inch,
    topMargin=0.5*inch, bottomMargin=0.5*inch,
)

styles = getSampleStyleSheet()
BRAND_BLUE = colors.HexColor("#1E40AF")
LIGHT_BLUE = colors.HexColor("#EBF5FB")
LIGHT_GRAY = colors.HexColor("#F8FAFC")
BORDER_GRAY = colors.HexColor("#D0D5DD")

title_style = ParagraphStyle("Title2", parent=styles["Title"], fontSize=18, textColor=BRAND_BLUE, spaceAfter=4)
sub_style = ParagraphStyle("Sub", parent=styles["Normal"], fontSize=10, textColor=colors.HexColor("#666666"))
meta_style = ParagraphStyle("Meta", parent=styles["Normal"], fontSize=8, textColor=colors.HexColor("#999999"))
cell_style = ParagraphStyle("Cell", parent=styles["Normal"], fontSize=9, leading=12)
cell_bold = ParagraphStyle("CellBold", parent=cell_style, fontName="Helvetica-Bold")
cell_right = ParagraphStyle("CellRight", parent=cell_style, alignment=TA_RIGHT)
cell_right_bold = ParagraphStyle("CellRightBold", parent=cell_right, fontName="Helvetica-Bold")

story = []

# --- Header ---
company = data.get("companyName", "AgencyDesk")
period = data.get("period", "")
period_range = f"{data.get('periodStart', '')} to {data.get('periodEnd', '')}"

story.append(Paragraph(company, title_style))
story.append(Paragraph(f"Payroll Summary Report &mdash; {period} ({period_range})", sub_style))
story.append(Paragraph(f"Generated: {data.get('generatedAt', '')}", meta_style))
story.append(Spacer(1, 12))
story.append(HRFlowable(width="100%", thickness=1, color=BRAND_BLUE))
story.append(Spacer(1, 12))

# --- Summary cards ---
totals = data.get("totals", {})
summary_data = [
    ["Total Employees", "Total Hours", "Regular Hours", "OT Hours", "Gross Pay", "Deductions", "Net Pay"],
    [
        str(len(data.get("runs", []))),
        f"{totals.get('totalWorkHours', 0):.1f}",
        f"{totals.get('regularHours', 0):.1f}",
        f"{totals.get('overtimeHours', 0):.1f}",
        f"${totals.get('grossPay', 0):,.2f}",
        f"${totals.get('deductions', 0):,.2f}",
        f"${totals.get('netPay', 0):,.2f}",
    ]
]

summary_table = Table(summary_data, colWidths=[1.3*inch]*7)
summary_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), BRAND_BLUE),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, 0), 9),
    ("BACKGROUND", (0, 1), (-1, 1), LIGHT_BLUE),
    ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
    ("FONTSIZE", (0, 1), (-1, 1), 11),
    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("GRID", (0, 0), (-1, -1), 0.5, BORDER_GRAY),
    ("TOPPADDING", (0, 0), (-1, -1), 6),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
]))
story.append(summary_table)
story.append(Spacer(1, 18))

# --- Detail table ---
def fmt_money(v):
    return f"${v:,.2f}" if v else "$0.00"

def fmt_hrs(v):
    return f"{v:.1f}" if v else "0.0"

headers = ["Employee", "Dept", "Rate", "Total Hrs", "Reg Hrs", "OT Hrs", "Reg Pay", "OT Pay", "Gross", "Deduct.", "Net Pay", "Status"]
col_widths = [1.6*inch, 0.9*inch, 0.7*inch, 0.7*inch, 0.7*inch, 0.6*inch, 0.85*inch, 0.85*inch, 0.85*inch, 0.75*inch, 0.85*inch, 0.7*inch]

table_data = [headers]

for run in data.get("runs", []):
    table_data.append([
        run["employeeName"],
        run.get("department", "—"),
        fmt_money(run["hourlyRate"]),
        fmt_hrs(run["totalWorkHours"]),
        fmt_hrs(run["regularHours"]),
        fmt_hrs(run["overtimeHours"]),
        fmt_money(run["regularPay"]),
        fmt_money(run["overtimePay"]),
        fmt_money(run["grossPay"]),
        fmt_money(run["deductions"]),
        fmt_money(run["netPay"]),
        run.get("status", "draft").title(),
    ])

# Totals row
table_data.append([
    "TOTALS", "", "",
    fmt_hrs(totals.get("totalWorkHours", 0)),
    fmt_hrs(totals.get("regularHours", 0)),
    fmt_hrs(totals.get("overtimeHours", 0)),
    fmt_money(totals.get("regularPay", 0)),
    fmt_money(totals.get("overtimePay", 0)),
    fmt_money(totals.get("grossPay", 0)),
    fmt_money(totals.get("deductions", 0)),
    fmt_money(totals.get("netPay", 0)),
    "",
])

detail_table = Table(table_data, colWidths=col_widths, repeatRows=1)

style_cmds = [
    ("BACKGROUND", (0, 0), (-1, 0), BRAND_BLUE),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, 0), 8),
    ("FONTSIZE", (0, 1), (-1, -1), 8),
    ("FONTNAME", (0, 1), (-1, -2), "Helvetica"),
    ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
    ("BACKGROUND", (0, -1), (-1, -1), LIGHT_BLUE),
    ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
    ("ALIGN", (0, 0), (1, -1), "LEFT"),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("GRID", (0, 0), (-1, -1), 0.5, BORDER_GRAY),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ("LEFTPADDING", (0, 0), (-1, -1), 4),
    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
]

# Alternating row colors
for i in range(1, len(table_data) - 1):
    if i % 2 == 0:
        style_cmds.append(("BACKGROUND", (0, i), (-1, i), LIGHT_GRAY))

detail_table.setStyle(TableStyle(style_cmds))
story.append(detail_table)

# --- Footer ---
story.append(Spacer(1, 24))
story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_GRAY))
story.append(Spacer(1, 6))
story.append(Paragraph(
    f"This report was generated by AgencyDesk. Period: {period} | Confidential.",
    ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8, textColor=colors.HexColor("#999999"), alignment=TA_CENTER)
))

doc.build(story)
print(json.dumps({"status": "success", "path": out_path}))
