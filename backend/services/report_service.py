from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


class ReportService:
    @staticmethod
    def build_pdf_report(title: str, sections: list[tuple[str, str]]) -> bytes:
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        styles = getSampleStyleSheet()

        story = [Paragraph(title, styles["Title"]), Spacer(1, 12)]

        for heading, content in sections:
            story.append(Paragraph(heading, styles["Heading2"]))
            story.append(Paragraph(content, styles["BodyText"]))
            story.append(Spacer(1, 10))

        doc.build(story)
        buffer.seek(0)
        return buffer.read()
