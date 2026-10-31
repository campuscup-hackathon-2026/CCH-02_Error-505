from app.services.vulnerability_intelligence import VulnerabilityIntelligence


class CodeScanner:
    @staticmethod
    async def scan_code(filename: str, content: str) -> dict:
        return await VulnerabilityIntelligence.analyze_code(filename, content)

    @staticmethod
    def fix_suggestion(issue_type: str) -> str:
        return VulnerabilityIntelligence.fix_suggestion(issue_type)
