# SentinelAI OS feature guide

## Accounts and dashboard

Create an operator account from the registration page. The API returns a signed bearer token, which the frontend stores locally and sends with protected API calls. The dashboard summarizes stored events, scans, audit activity, and the current local security posture.

## Analysis tools

- **AI Analyst / Vulnerability Intelligence:** scan uploaded source or pasted code for common insecure patterns and receive remediation suggestions.
- **Prompt Firewall:** identify prompt injection, sensitive-data disclosure, and unsafe-instruction indicators using local pattern rules, with optional AI enrichment.
- **Log Analyzer / Threat Hunter:** summarize provided log events and highlight suspicious patterns.
- **Phishing and Malware:** analyze submitted text and indicators. These screens do not execute uploaded malware or detonate files.
- **Threat Intelligence:** enrich IP or domain indicators when configured upstream providers are available; local fallback analysis remains available.
- **Incident Response:** create containment and recovery guidance, then download a PDF plan.

## Passive traffic analysis

The SIH26145 page accepts PCAP captures and extracts flow metadata such as endpoints, ports, packet counts, timing, and DNS query names. It does not retain packet payloads or transmit through the monitored interface. Live capture requires Scapy plus OS-specific packet-capture permissions. Restrict selectable interfaces using `UNIDIRECTIONAL_ALLOWED_INTERFACES` and configure protected network ranges with `UNIDIRECTIONAL_PROTECTED_CIDRS` when direction classification is needed.

## Integrations

OpenAI, Azure OpenAI, Gemini, VirusTotal, ThreatFox, AbuseIPDB, and Shodan credentials are optional. Configure the relevant environment variables in `backend/.env`. Local heuristics and demo fallback output do not require a network AI account.

## Operational notes

- The included database defaults to SQLite for development. Use a managed database and persistent storage for shared deployments.
- Use HTTPS, a strong `JWT_SECRET`, a restricted `FRONTEND_ORIGIN`, and appropriate rate limits in production.
- Attack simulation, security-mode controls, and the terminal console are demonstrations. They do not execute firewall rules, isolate machines, or run arbitrary shell commands.
- Results are triage aids and should be reviewed by a qualified analyst before operational action.
