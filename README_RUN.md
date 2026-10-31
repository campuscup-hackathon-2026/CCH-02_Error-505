# Run SentinelAI OS locally

## Requirements

- Python 3.11 or newer
- Node.js 20 or newer (npm is included)

## Start the backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend creates a local SQLite database automatically. Open `http://localhost:8000/docs` for the API. Register an account in the UI before using authenticated pages.

## Start the frontend

In a second terminal:

```powershell
cd frontend
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm run dev
```

Open `http://localhost:5173`. Vite proxies API and WebSocket traffic to `http://127.0.0.1:8000` by default. Set `VITE_API_PROXY_TARGET` to override it.

After installing the backend dependencies, you can also run `npm run dev` from the repository root. The frontend dev launcher checks the API health endpoint, starts the backend if needed, then starts Vite. If the backend is already running, it reuses it.

## Docker Compose

From the repository root, run `docker compose up --build`. The frontend is available at `http://localhost:5173` and the API at `http://localhost:8000`.

## Optional integrations

The local detection, analysis, and fallback AI paths work without external credentials. Copilot uses Gemini by default; set `GEMINI_API_KEY` in `backend/.env` (and optionally `GEMINI_MODEL`, default `gemini-3.8-flash`). Add other provider keys to enable OpenAI, Azure OpenAI, VirusTotal, ThreatFox, AbuseIPDB, and Shodan enrichment. Use a long random `JWT_SECRET` outside local development. Live interface capture requires Scapy and suitable OS permissions; PCAP upload is passive and metadata-only.
# Run SentinelAI OS locally

## Requirements

- Python 3.11 or newer
- Node.js 20 or newer (npm is included)

## Start the backend

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend creates a local SQLite database automatically. Open `http://localhost:8000/docs` for the API. Register an account in the UI before using authenticated pages.

## Start the frontend

In a second terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:5173`. Vite proxies API and WebSocket traffic to `http://127.0.0.1:8000` by default. Set `VITE_API_PROXY_TARGET` to override it.

## Docker Compose

From the repository root, run `docker compose up --build`. The frontend is available at `http://localhost:5173` and the API at `http://localhost:8000`.

## Optional integrations

Local detection, analysis, and fallback AI paths work without external credentials. Copilot uses Gemini by default; set `GEMINI_API_KEY` in `backend/.env` (and optionally `GEMINI_MODEL`, default `gemini-3.8-flash`). Add other provider keys to enable OpenAI, Azure OpenAI, VirusTotal, ThreatFox, AbuseIPDB, and Shodan enrichment. Use a long random `JWT_SECRET` outside local development. Live interface capture requires Scapy and suitable OS permissions; PCAP upload is passive and metadata-only.
