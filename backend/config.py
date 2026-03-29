"""
config.py
---------
Loads and validates /app/config.json at import time.
The application will not start if the file is missing or invalid.

Expected shape:
{
  "models": [                         // required, at least one entry
    {
      "id":       "local-qwen",       // required, unique
      "label":    "Qwen 2.5 3B",     // required, shown in UI
      "base_url": "http://...",       // required, OpenAI-compatible endpoint
      "model":    "qwen2.5:3b",       // required, model name passed to API
      "api_key":  "ollama"            // optional, defaults to "ollama"
    }
  ],
  "embedding": {                      // required
    "base_url": "http://...",         // required, OpenAI-compatible endpoint
    "model":    "nomic-embed-text",   // required
    "api_key":  "ollama"             // optional, defaults to "ollama"
  },
  "modes": [                          // optional, custom modes added to built-ins
    {
      "id":           "my_mode",
      "label":        "My Mode",
      "description":  "...",
      "system":       "You are…",
      "force_search": true
    }
  ]
}
"""

from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

CONFIG_PATH = Path("/app/config.json")


# ── Data classes ──────────────────────────────────────────────────────────────

@dataclass
class ModelConfig:
    id:       str
    label:    str
    base_url: str
    model:    str
    api_key:  str = "ollama"


@dataclass
class EmbeddingConfig:
    base_url: str
    model:    str
    api_key:  str = "ollama"


@dataclass
class ModeConfig:
    id:           str
    label:        str
    description:  str
    system:       str
    force_search: bool = False


@dataclass
class AppConfig:
    models:    list[ModelConfig]
    embedding: EmbeddingConfig
    modes:     list[ModeConfig] = field(default_factory=list)

    def get_model(self, model_id: str) -> ModelConfig | None:
        return next((m for m in self.models if m.id == model_id), None)

    @property
    def default_model(self) -> ModelConfig:
        return self.models[0]


# ── Loader ────────────────────────────────────────────────────────────────────

def _error(msg: str) -> None:
    print(f"\n[config] ERROR: {msg}\n", file=sys.stderr)
    sys.exit(1)


def _normalise_url(url: str) -> str:
    """Ensure base_url ends with /v1 exactly once."""
    url = url.rstrip("/")
    if not url.endswith("/v1"):
        url = f"{url}/v1"
    return url


def load_config() -> AppConfig:
    if not CONFIG_PATH.exists():
        _error(
            f"{CONFIG_PATH} not found.\n"
            "  Create a config.json next to your docker-compose.yml.\n"
            "  Minimal example:\n"
            "  {\n"
            '    "models": [{\n'
            '      "id": "local", "label": "Local Qwen",\n'
            '      "base_url": "http://ollama:11434/v1",\n'
            '      "model": "qwen2.5:3b"\n'
            "    }],\n"
            '    "embedding": {\n'
            '      "base_url": "http://ollama:11434/v1",\n'
            '      "model": "nomic-embed-text"\n'
            "    }\n"
            "  }"
        )

    try:
        text = CONFIG_PATH.read_text()
        text = re.sub(
            r"\$\{([^}]+)\}",
            lambda m: os.environ.get(m.group(1), m.group(0)),
            text,
        )
        raw = json.loads(text)
    except json.JSONDecodeError as e:
        _error(f"{CONFIG_PATH} is not valid JSON: {e}")

    # ── models (required, non-empty array) ───────────────────────────────────
    if not raw.get("models"):
        _error("config.json: 'models' array is required and must have at least one entry.")

    seen_ids: set[str] = set()
    models: list[ModelConfig] = []
    for i, m in enumerate(raw["models"]):
        prefix = f"config.json: models[{i}]"
        for f in ("id", "label", "base_url", "model"):
            if not m.get(f):
                _error(f"{prefix}: '{f}' is required.")
        if m["id"] in seen_ids:
            _error(f"{prefix}: duplicate model id '{m['id']}'.")
        seen_ids.add(m["id"])
        models.append(ModelConfig(
            id=m["id"],
            label=m["label"],
            base_url=_normalise_url(m["base_url"]),
            model=m["model"],
            api_key=m.get("api_key", "ollama"),
        ))

    # ── embedding (required) ──────────────────────────────────────────────────
    if not raw.get("embedding"):
        _error("config.json: 'embedding' block is required.")

    emb_raw = raw["embedding"]
    for f in ("base_url", "model"):
        if not emb_raw.get(f):
            _error(f"config.json: embedding.{f} is required.")

    embedding = EmbeddingConfig(
        base_url=_normalise_url(emb_raw["base_url"]),
        model=emb_raw["model"],
        api_key=emb_raw.get("api_key", "ollama"),
    )

    # ── modes (optional) ─────────────────────────────────────────────────────
    PROTECTED = {"chat", "strict"}
    custom_modes: list[ModeConfig] = []
    for i, m in enumerate(raw.get("modes", [])):
        prefix = f"config.json: modes[{i}]"
        for f in ("id", "label", "description", "system"):
            if not m.get(f):
                _error(f"{prefix}: '{f}' is required.")
        if m["id"] in PROTECTED:
            _error(f"{prefix}: id '{m['id']}' is reserved. Choose a different id.")
        custom_modes.append(ModeConfig(
            id=m["id"],
            label=m["label"],
            description=m["description"],
            system=m["system"],
            force_search=bool(m.get("force_search", False)),
        ))

    return AppConfig(models=models, embedding=embedding, modes=custom_modes)


# ── Singleton ─────────────────────────────────────────────────────────────────

CFG: AppConfig = load_config()