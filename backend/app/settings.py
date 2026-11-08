from dataclasses import dataclass
import os
from pathlib import Path

@dataclass(frozen=True)
class Settings:
    model_path: Path | None = None
    manifest_path: Path | None = None
    supabase_url: str | None = None
    supabase_key: str | None = None
    frontend_origin: str = 'http://localhost:5173'
    @classmethod
    def from_env(cls):
        value=lambda key: os.getenv(key,'').strip() or None
        return cls(Path(value('MODEL_PATH')) if value('MODEL_PATH') else None,
                   Path(value('MODEL_MANIFEST_PATH')) if value('MODEL_MANIFEST_PATH') else None,
                   (value('SUPABASE_URL') or '').rstrip('/') or None,
                   value('SUPABASE_SERVICE_ROLE_KEY'),
                   value('FRONTEND_ORIGIN') or 'http://localhost:5173')
