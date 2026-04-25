from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from pydantic import BaseModel, Field

load_dotenv()

MODEL_NAME = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
PRODUCT_DIR = Path(__file__).resolve().parents[2] / "unhuman_json"

client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

app = FastAPI(title="Delightful Agent Buyer API")

cors_origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    history: list[Message] = Field(default_factory=list)


class Product(BaseModel):
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    priceUsd: str | None = None
    priceCents: int | None = None
    sourceFile: str | None = None


class ChatResponse(BaseModel):
    reply: str
    referenced_products: list[Product]


def load_products() -> list[dict[str, Any]]:
    products: list[dict[str, Any]] = []
    if not PRODUCT_DIR.exists():
        return products

    for file in PRODUCT_DIR.glob("*.json"):
        try:
            payload = json.loads(file.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue

        for product in payload.get("products", []):
            item = dict(product)
            item["sourceFile"] = file.name
            products.append(item)
    return products


def select_relevant_products(query: str, products: list[dict[str, Any]], limit: int = 4) -> list[dict[str, Any]]:
    if not query.strip():
        return products[:limit]

    terms = {part.lower() for part in query.split() if len(part) > 2}
    scored: list[tuple[int, dict[str, Any]]] = []
    for product in products:
        text = json.dumps(product).lower()
        score = sum(term in text for term in terms)
        scored.append((score, product))

    scored.sort(key=lambda pair: pair[0], reverse=True)
    top = [product for score, product in scored if score > 0][:limit]
    return top if top else products[:limit]


def build_prompt(user_message: str, references: list[dict[str, Any]]) -> str:
    return (
        "You are a practical shopping assistant. Recommend products only from the provided catalog. "
        "If a suitable product does not exist, say so clearly.\n\n"
        f"User request: {user_message}\n\n"
        f"Catalog references:\n{json.dumps(references, indent=2)}"
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest) -> ChatResponse:
    if client is None:
        raise HTTPException(status_code=500, detail="Missing GROQ_API_KEY in backend environment.")

    products = load_products()
    if not products:
        raise HTTPException(status_code=500, detail="No products found in unhuman_json.")

    references = select_relevant_products(payload.message, products)
    system_content = build_prompt(payload.message, references)

    history_messages = [
        {"role": "user" if message.role not in {"assistant", "system"} else message.role, "content": message.content}
        for message in payload.history[-8:]
        if message.content.strip()
    ]

    completion = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[{"role": "system", "content": system_content}, *history_messages, {"role": "user", "content": payload.message}],
        temperature=0.4,
    )

    reply = completion.choices[0].message.content or "I could not generate a response."
    return ChatResponse(reply=reply, referenced_products=[Product(**item) for item in references])
