import requests
from pathlib import Path

base = 'http://127.0.0.1:8000'
# create a small dummy binary to simulate .msi (but small)
p = Path('dummy_installer.msi')
p.write_bytes(b"MZ" + b"\x00" * 1024)

r = requests.post(base + '/api/v1/auth/login', json={'email': 'ci@example.com', 'password': 'CIpass@123'})
print('login', r.status_code, r.text)
if r.status_code != 200:
    raise SystemExit('login failed')

token = r.json().get('access_token')
headers = {'Authorization': f'Bearer {token}'}
with open(p, 'rb') as fh:
    files = {'file': ('dummy_installer.msi', fh, 'application/octet-stream')}
    r = requests.post(base + '/api/v1/security/scan-code', headers=headers, files=files)
    print('scan status', r.status_code, r.text)

p.unlink()
