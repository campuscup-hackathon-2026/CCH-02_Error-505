from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, status
import logging
import os
import io
import zipfile
import tarfile
import re
from typing import List
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.vulnerability import VulnerabilityScan
from app.services.code_scanner import CodeScanner
from app.core.config import settings

logger = logging.getLogger(__name__)

# Allowed source file extensions for scanning
_ALLOWED_EXTENSIONS = {
    ".py",
    ".js",
    ".ts",
    ".jsx",
    ".tsx",
    ".java",
    ".go",
    ".c",
    ".cpp",
    ".h",
    ".html",
    ".htm",
    ".sql",
    ".sh",
    ".ps1",
    ".rb",
    ".php",
    ".json",
    ".yaml",
    ".yml",
    ".txt",
    ".md",
    ".cfg",
    ".ini",
}

# Archive and binary types we will attempt to extract/scan
_ARCHIVE_EXTENSIONS = {".zip", ".tar", ".tar.gz", ".tgz", ".tar.bz2", ".tbz2"}
_BINARY_EXTENSIONS = {".msi", ".exe", ".dll", ".so", ".bin", ".apk", ".jar"}


def _extract_printable_strings(data: bytes, min_len: int = 4) -> str:
    # Find sequences of printable ASCII and UTF-8 characters
    try:
        text = data.decode("utf-8", errors="ignore")
    except Exception:
        text = ""
    # Fallback: extract ASCII printable sequences
    ascii_seqs = re.findall(r"[ -~]{%d,}" % min_len, data.decode("latin1", errors="ignore"))
    combined = "\n".join([text] + ascii_seqs)
    return combined


async def _scan_text_sources(sources: List[tuple[str, str]]):
    """Scan multiple (name, text) sources and aggregate results."""
    aggregated = {
        "filename": ",".join([n for n, _ in sources]) if sources else "uploaded",
        "risk_score": 0,
        "severity": "Low",
        "severity_band": "Low",
        "findings": [],
        "ai_summary": "",
        "generated_fixes": {},
        "secure_fix_snippet": "",
        "provider": "",
    }
    providers = set()
    scores = []

    for name, text in sources:
        try:
            res = await CodeScanner.scan_code(name, text)
        except Exception as exc:
            logger.exception("Failed to scan chunk %s: %s", name, exc)
            continue

        scores.append(res.get("risk_score", 0))
        providers.add(res.get("provider", "fallback"))
        # prefix findings with source name
        for f in res.get("findings", []):
            f_copy = f.copy()
            f_copy["source"] = name
            aggregated["findings"].append(f_copy)

        # merge generated fixes with namespacing
        for line, fix in (res.get("generated_fixes") or {}).items():
            key = f"{name}:{line}"
            aggregated["generated_fixes"][key] = fix

        if not aggregated["ai_summary"]:
            aggregated["ai_summary"] = res.get("ai_summary", "")
        else:
            aggregated["ai_summary"] += "\n" + res.get("ai_summary", "")

        if not aggregated["secure_fix_snippet"]:
            aggregated["secure_fix_snippet"] = res.get("secure_fix_snippet", "")
    # finalize scores
    aggregated["risk_score"] = int(max(scores) if scores else 0)
    aggregated["severity"] = aggregated["severity_band"] = (
        max((res.get("severity_band") or res.get("severity") or "Low") for (_, _), res in [(s, {}) for s in sources])
        if sources
        else "Low"
    )
    aggregated["provider"] = ",".join(sorted(providers)) if providers else "fallback"
    return aggregated


router = APIRouter()


@router.post("/scan-code")
async def scan_code(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    filename = file.filename or "uploaded"
    _, ext = os.path.splitext(filename.lower())

    # Read file bytes and enforce size limit
    raw = await file.read()
    # Enforce size limit only when configured. If `max_upload_size_bytes` is None, we accept any size.
    max_bytes = settings.max_upload_size_bytes
    if max_bytes and len(raw) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Uploaded file is too large ({len(raw)} bytes). Max allowed is {settings.max_upload_size_bytes} bytes.",
        )

    # Handle plain text/source files directly
    if ext in _ALLOWED_EXTENSIONS or ext == "":
        try:
            content = raw.decode("utf-8", errors="ignore")
        except Exception as exc:
            logger.exception("Failed to decode uploaded file %s: %s", filename, exc)
            raise HTTPException(status_code=400, detail="Failed to read uploaded file")

        if not content.strip():
            return {
                "filename": filename,
                "risk_score": 0,
                "severity": "Low",
                "severity_band": "Low",
                "findings": [],
                "ai_summary": f"Uploaded file '{filename}' contains no valid text content to scan.",
                "generated_fixes": {},
                "secure_fix_snippet": "No scan performed on binary or empty file.",
                "provider": "none",
            }

        result = await CodeScanner.scan_code(filename, content)
        return result

    # Handle archive files: extract and scan contained source files
    if ext in _ARCHIVE_EXTENSIONS:
        sources = []
        bio = io.BytesIO(raw)
        # Try zip first
        try:
            with zipfile.ZipFile(bio) as zf:
                for zi in zf.infolist():
                    if zi.is_dir():
                        continue
                    name = zi.filename
                    _, e = os.path.splitext(name.lower())
                    if e in _ALLOWED_EXTENSIONS:
                        try:
                            data = zf.read(zi)
                            text = data.decode("utf-8", errors="ignore")
                            sources.append((f"{filename}:{name}", text))
                        except Exception:
                            continue
        except zipfile.BadZipFile:
            # try tar
            bio.seek(0)
            try:
                with tarfile.open(fileobj=bio) as tf:
                    for member in tf.getmembers():
                        if not member.isreg():
                            continue
                        name = member.name
                        _, e = os.path.splitext(name.lower())
                        fobj = tf.extractfile(member)
                        if not fobj:
                            continue
                        data = fobj.read()
                        if e in _ALLOWED_EXTENSIONS:
                            text = data.decode("utf-8", errors="ignore")
                            sources.append((f"{filename}:{name}", text))
            except Exception:
                pass

        # If we found text sources, scan them
        if sources:
            aggregated = await _scan_text_sources(sources)
            return aggregated

        # Otherwise, attempt to extract printable strings from all files and scan as one chunk
        bio.seek(0)
        try:
            all_text = _extract_printable_strings(raw)
            aggregated = await _scan_text_sources([(filename, all_text)])
            return aggregated
        except Exception:
            raise HTTPException(status_code=400, detail="Failed to extract contents from archive")

    # Handle binary/executable files: extract printable strings and scan
    if ext in _BINARY_EXTENSIONS:
        text = _extract_printable_strings(raw)
        if not text.strip():
            return {
                "filename": filename,
                "risk_score": 0,
                "severity": "Low",
                "severity_band": "Low",
                "findings": [],
                "ai_summary": f"Uploaded binary '{filename}' contained no extractable text.",
                "generated_fixes": {},
                "secure_fix_snippet": "No scan performed on binary file.",
                "provider": "none",
            }

        aggregated = await _scan_text_sources([(filename, text)])
        return aggregated

    # Fallback: attempt to decode and scan
    try:
        content = raw.decode("utf-8", errors="ignore")
    except Exception as exc:
        logger.exception("Failed to decode uploaded file %s: %s", filename, exc)
        raise HTTPException(status_code=400, detail="Failed to read uploaded file")

    if not content.strip():
        # try extracting printable strings and scanning
        text = _extract_printable_strings(raw)
        if text.strip():
            aggregated = await _scan_text_sources([(filename, text)])
            return aggregated

    result = await CodeScanner.scan_code(filename, content)

    record = VulnerabilityScan(
        user_id=current_user.id,
        filename=result["filename"],
        risk_score=result["risk_score"],
        severity=result["severity"],
        findings=result["findings"],
        ai_summary=result["ai_summary"],
        generated_fixes=result["generated_fixes"],
    )
    db.add(record)
    db.commit()

    return result