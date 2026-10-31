# SentinelAI OS

SentinelAI OS is a local-first security operations dashboard for exploring threat analysis, incident response, threat intelligence, and passive network telemetry from one interface. It combines a React frontend with a FastAPI backend and SQLite storage. Rule-based analysis and demo data work locally; optional provider keys enable external AI and threat-intelligence enrichment.

## Features

- Operator accounts with signed bearer tokens
- SOC dashboard, alerts, attack simulation, and security-mode controls
- Prompt injection, log, phishing, malware-text, and source-code analysis
- Threat intelligence lookups and incident response plans with PDF reports
- Passive PCAP and optional live-interface flow analysis
- WebSocket updates for alerts and traffic data

## Quick start

Install Python 3.11 or newer and Node.js 20 or newer. Follow [README_RUN.md](README_RUN.md) for local installation and startup, or run `docker compose up --build`.

Create an operator account at `/register`. The API docs are available at `http://localhost:8000/docs`.

## Configuration

Copy `backend/.env.example` to `backend/.env` and set a strong `JWT_SECRET` before exposing the service beyond a local development machine. Provider credentials are optional; without them, analysis features use local rules and fallback responses. Set allowed passive capture interfaces explicitly before enabling live capture.

See [docs/sentinelai-os-feature-guide.md](docs/sentinelai-os-feature-guide.md) for module details and limitations.
