from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.report import Report
from app.models.incident_plan import IncidentPlan
from app.models.user import User
from app.models.vulnerability import VulnerabilityScan
from app.services.incident_response import IncidentResponse
from app.services.report_service import ReportService


router = APIRouter()
REPORT_DIR = Path("generated_reports")
REPORT_DIR.mkdir(exist_ok=True)


@router.post("/generate/vulnerability")
def generate_vulnerability_report(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scans = (
        db.query(VulnerabilityScan)
        .filter(VulnerabilityScan.user_id == current_user.id)
        .order_by(VulnerabilityScan.created_at.desc())
        .limit(5)
        .all()
    )

    if not scans:
        raise HTTPException(status_code=404, detail="No scans found to generate a report")

    sections = []
    for scan in scans:
        sections.append(
            (
                f"{scan.filename} | Severity: {scan.severity} | Risk: {scan.risk_score}",
                f"Summary: {scan.ai_summary}",
            )
        )

    pdf_bytes = ReportService.build_pdf_report("SentinelAI Vulnerability Report", sections)
    file_name = f"vulnerability_report_user_{current_user.id}.pdf"
    file_path = REPORT_DIR / file_name
    file_path.write_bytes(pdf_bytes)

    report = Report(user_id=current_user.id, report_type="vulnerability", file_path=str(file_path))
    db.add(report)
    db.commit()

    return {"report_id": report.id, "download_path": f"/api/v1/reports/download/{report.id}"}


@router.post("/generate/incident")
async def generate_incident_report(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    threat_type = str(payload.get("threat_type", "unknown"))
    severity = str(payload.get("severity", "medium"))
    context = str(payload.get("context", ""))

    plan = await IncidentResponse.generate_plan(threat_type, severity, context)
    sections = [
        ("Threat Summary", plan["attack_summary"]),
        ("AI Explanation", plan["ai_explanation"]),
        ("Recommendations", "<br/>".join(plan["recommendations"])),
    ]

    pdf_bytes = ReportService.build_pdf_report("SentinelAI Incident Response Report", sections)
    file_name = f"incident_report_user_{current_user.id}.pdf"
    file_path = REPORT_DIR / file_name
    file_path.write_bytes(pdf_bytes)

    report = Report(user_id=current_user.id, report_type="incident", file_path=str(file_path))
    db.add(report)
    db.commit()

    return {"report_id": report.id, "download_path": f"/api/v1/reports/download/{report.id}", "plan": plan}


@router.get("/download/{report_id}")
def download_report(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = db.query(Report).filter(Report.id == report_id, Report.user_id == current_user.id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    file_path = Path(report.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Report file missing")

    return FileResponse(path=file_path, filename=file_path.name, media_type="application/pdf")