import os
import sys
from pathlib import Path
from fastapi.testclient import TestClient

os.environ['MODEL_ID'] = 'mock'
sys.path.append(str(Path(__file__).resolve().parents[2]))

from services.vlm.main import create_app  # type: ignore

app = create_app()
client = TestClient(app)


def test_health():
    res = client.get('/api/vlm/health')
    assert res.status_code == 200
    data = res.json()
    assert data['model_id'] == 'mock'
