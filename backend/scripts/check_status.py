import os
os.environ['DATABASE_URL'] = 'sqlite:///./.test.db'
os.environ['ENVIRONMENT'] = 'development'

# Load API keys from backend/.env if present, but do NOT print their values.
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
if os.path.exists(env_path):
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            k = k.strip()
            v = v.strip().strip('"')
            # Only import known keys we care about
            if k in ('CHATGPT_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'VIRUSTOTAL_API_KEY', 'THREATFOX_API_KEY', 'ABUSEIPDB_API_KEY', 'SHODAN_API_KEY'):
                os.environ[k] = v
else:
    # ensure keys exist but remain blank
    os.environ.setdefault('CHATGPT_API_KEY', '')
    os.environ.setdefault('OPENAI_API_KEY', '')
    os.environ.setdefault('GEMINI_API_KEY', '')

from fastapi.testclient import TestClient
import sys
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from app.main import app

print('Imported app')
from app.services.ai_provider import ai_provider
print('AI provider: openai=', bool(ai_provider.openai_client), 'gemini=', bool(ai_provider.gemini_model), 'langchain_openai=', bool(ai_provider.langchain_openai), 'langchain_gemini=', bool(ai_provider.langchain_gemini))

with TestClient(app) as client:
    h = client.get('/health')
    print('/health', h.status_code, h.json())
    m = client.get('/api/v1/dashboard/metrics')
    print('/api/v1/dashboard/metrics', m.status_code)
    try:
        ws = client.websocket_connect('/api/v1/ws/alerts')
        ws.send_text('subscribe')
        ws.close()
        print('websocket connect: OK')
    except Exception as e:
        print('websocket connect: FAILED', e)
