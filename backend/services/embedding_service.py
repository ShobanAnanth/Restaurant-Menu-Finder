"""
Embedding service: produces vector representations of menu items.
Degrades gracefully if the OpenAI API is unavailable / out of quota — callers
should treat a returned [] or None as "no embeddings available".
"""

import os
from typing import List, Optional

import numpy as np


def make_item_text(name: str, description: Optional[str], food_category: Optional[str]) -> str:
    parts = [name]
    if description:
        parts.append(description)
    if food_category:
        parts.append(food_category)
    return ". ".join(parts)


def get_embeddings_batch(texts: List[str]) -> List[List[float]]:
    """
    Embed a list of strings in one API call. Returns embeddings in input order.
    Returns [] if the API is unavailable / out of quota / no key configured.
    """
    if not texts:
        return []
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return []
    try:
        from openai import OpenAI
    except ImportError:
        return []
    try:
        # Fail fast on auth/quota errors so the scrape pipeline isn't blocked
        # waiting for retries.
        client = OpenAI(api_key=api_key, timeout=10.0, max_retries=0)
        response = client.embeddings.create(model="text-embedding-3-small", input=texts)
        return [item.embedding for item in sorted(response.data, key=lambda x: x.index)]
    except Exception as exc:
        print(f"[embedding] failed (search will use keyword fallback): {exc}", flush=True)
        return []


def get_embedding(text: str) -> Optional[List[float]]:
    """Embed a single string. Returns None if embeddings are unavailable."""
    out = get_embeddings_batch([text])
    return out[0] if out else None


def cosine_similarity(a: List[float], b: List[float]) -> float:
    va, vb = np.asarray(a, dtype=np.float32), np.asarray(b, dtype=np.float32)
    denom = float(np.linalg.norm(va) * np.linalg.norm(vb))
    return float(np.dot(va, vb) / denom) if denom > 0 else 0.0


def rank_by_similarity(query_vec: List[float], item_vecs: List[List[float]]) -> List[float]:
    """Vectorized cosine similarity of a query against many items."""
    if not item_vecs:
        return []
    q = np.asarray(query_vec, dtype=np.float32)
    M = np.asarray(item_vecs, dtype=np.float32)
    qn = np.linalg.norm(q)
    mn = np.linalg.norm(M, axis=1)
    denom = (mn * qn)
    safe = np.where(denom > 0, denom, 1.0)
    scores = (M @ q) / safe
    scores[denom == 0] = 0.0
    return scores.tolist()
