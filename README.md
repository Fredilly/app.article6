# Automated Carbon Compliance

A minimal Next.js application with a chat interface.

## Getting Started

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`.

### Environment Variables
Copy `.env.example` to `.env` and set:

- `INFERENCE_BASE_URL` – endpoint for inference (default `http://localhost:8000/v1`)
- `INFERENCE_API_KEY` – API key for model provider
- `MODEL_ID` – model identifier (`Qwen2.5-VL-7B-Instruct`)

## Testing

```bash
npm test
```

## Future Work
- Replace echo endpoint with real Qwen2.5-VL inference. You can self-host with vLLM or use an OpenAI-compatible router and set the env vars above.
- Add file upload and map viewer.
