# app.article6

This repo contains the Article6 web application and a minimal vision-language model (VLM) service.

## VLM Service

The service under `services/vlm` hosts a FastAPI server that can run [Qwen2.5-VL-7B-Instruct](https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct). It exposes:

- `GET /api/vlm/health` – simple health check.
- `POST /api/vlm/chat` – send chat messages and optional images and receive a JSON response.

### Local development

```
cd services/vlm
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Environment variables are defined in `services/vlm/.env.example`.

## Web UI

A demo page lives at `/labs/vlm` in the Next.js app. Configure the backend URL with `NEXT_PUBLIC_VLM_API_URL` in `.env` or `.env.local`.

Run the web app:

```
npm install
npm run dev
```

## Tests

Backend tests:

```
cd services/vlm
pytest
```

Frontend E2E tests (Playwright):

```
npx playwright test
```
