import os
import base64
from io import BytesIO
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image


def create_app() -> FastAPI:
    model_id = os.getenv("MODEL_ID", "Qwen/Qwen2.5-VL-7B-Instruct")
    device = os.getenv("DEVICE", "cpu")
    max_tokens = int(os.getenv("MAX_TOKENS", "512"))
    origins = os.getenv("CORS_ORIGINS", "*").split(",")

    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    if model_id == "mock":
        class MockModel:
            def generate(self, *args, **kwargs):
                return [["mock response"]]

        class MockProcessor:
            def __call__(self, images=None, text=None, return_tensors=None):
                return {}

            def batch_decode(self, outputs, skip_special_tokens=True):
                return ["mock response"]

        app.state.model = MockModel()
        app.state.processor = MockProcessor()
    else:
        from transformers import AutoProcessor, AutoModelForCausalLM

        processor = AutoProcessor.from_pretrained(
            model_id, trust_remote_code=True
        )
        model = AutoModelForCausalLM.from_pretrained(
            model_id,
            device_map="auto",
            torch_dtype="auto",
            trust_remote_code=True,
        )
        model.eval()
        app.state.model = model
        app.state.processor = processor

    class Message(BaseModel):
        role: str
        content: str

    class ChatRequest(BaseModel):
        messages: List[Message]
        images: Optional[List[str]] = None
        max_new_tokens: Optional[int] = max_tokens
        temperature: Optional[float] = 0.0

    @app.get("/api/vlm/health")
    def health():
        return {"ok": True, "model_id": model_id, "device": device}

    @app.post("/api/vlm/chat")
    def chat(req: ChatRequest):
        # simple in-memory rate limit
        tokens = getattr(app.state, "_tokens", 60)
        last = getattr(app.state, "_last", 0.0)
        import time

        now = time.time()
        refill = (now - last) * (60 / 60)
        tokens = min(60, tokens + refill)
        if tokens < 1:
            raise HTTPException(status_code=429, detail="Rate limit exceeded")
        tokens -= 1
        app.state._tokens = tokens
        app.state._last = now

        text = "\n".join([m.content for m in req.messages])
        images = []
        if req.images:
            for img_str in req.images:
                if img_str.startswith("data:"):
                    _, img_str = img_str.split(",", 1)
                img_bytes = base64.b64decode(img_str)
                images.append(Image.open(BytesIO(img_bytes)))
        if model_id == "mock":
            return {"text": "mock response", "usage": {}}
        processor = app.state.processor
        model = app.state.model
        inputs = processor(
            images=images if images else None,
            text=text,
            return_tensors="pt",
        ).to(model.device)
        import torch

        with torch.no_grad():
            generated = model.generate(
                **inputs,
                max_new_tokens=req.max_new_tokens,
                do_sample=req.temperature > 0,
                temperature=req.temperature,
            )
        output = processor.batch_decode(generated, skip_special_tokens=True)[0]
        return {"text": output.strip(), "usage": {}}

    return app


app = create_app()

