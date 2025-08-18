import os
import sys
import base64
from pathlib import Path
from fastapi.testclient import TestClient

os.environ['MODEL_ID'] = 'mock'
sys.path.append(str(Path(__file__).resolve().parents[2]))

from services.vlm.main import create_app  # type: ignore

app = create_app()
client = TestClient(app)


def load_image():
    with open('services/vlm/tests/fixtures/test.ppm', 'rb') as f:
        return base64.b64encode(f.read()).decode()


def test_basic_infer():
    img = load_image()
    payload = {
        'messages': [{'role': 'user', 'content': 'describe image'}],
        'images': [img],
    }
    res = client.post('/api/vlm/chat', json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data['text']
