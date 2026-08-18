"""
Emergent Object Storage helper condiviso.

Usato per migrare le immagini base64 pesanti (logo società, foto profilo,
foto squadra) da MongoDB → Object Storage, riducendo il peso dei documenti
(causa principale della lentezza su Atlas M0) e il payload delle API.

Pattern (identico a quello già usato in server.py per le copertine eventi):
  - handshake /init con EMERGENT_LLM_KEY → storage_key (cache in-process)
  - PUT/GET su /objects/{path} con header X-Storage-Key
  - richieste `requests` sincrone eseguite in threadpool (PIL/HTTP CPU/IO-bound)
  - nessun URL pubblico: le immagini si servono via endpoint backend dedicati
"""
import os
import base64
from io import BytesIO

import requests as _os_requests
from fastapi.concurrency import run_in_threadpool

try:
    from PIL import Image
    _HAS_PIL = True
except Exception:  # pragma: no cover
    _HAS_PIL = False

_STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
_STORAGE_URL = _STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
_STORAGE_APP = "registrateam"
_storage_key = None


def _init_sync():
    global _storage_key
    if _storage_key:
        return _storage_key
    resp = _os_requests.post(
        f"{_STORAGE_URL}/init",
        json={"emergent_key": os.environ.get("EMERGENT_LLM_KEY")},
        timeout=30,
    )
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def _put_sync(path, data, content_type):
    global _storage_key
    key = _init_sync()
    resp = _os_requests.put(
        f"{_STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    if resp.status_code == 503:
        _storage_key = None
        key = _init_sync()
        resp = _os_requests.put(
            f"{_STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=120,
        )
    resp.raise_for_status()
    return resp.json()


def _get_sync(path):
    global _storage_key
    key = _init_sync()
    resp = _os_requests.get(
        f"{_STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key},
        timeout=60,
    )
    if resp.status_code == 503:
        _storage_key = None
        key = _init_sync()
        resp = _os_requests.get(
            f"{_STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key},
            timeout=60,
        )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


def compress_data_uri_to_jpeg(data_uri, max_dim: int = 1024, target_kb: int = 220):
    """Decodifica un data URI (o raw base64), ridimensiona e comprime a JPEG.
    Ritorna bytes JPEG oppure None se non decodificabile.
    """
    if not _HAS_PIL or not data_uri or not isinstance(data_uri, str):
        return None
    try:
        if data_uri.startswith("data:"):
            _, b64 = data_uri.split(",", 1)
        else:
            b64 = data_uri
        img = Image.open(BytesIO(base64.b64decode(b64)))
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGBA")
            bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
            img = Image.alpha_composite(bg, img).convert("RGB")
        else:
            img = img.convert("RGB")
        w, h = img.size
        if max(w, h) > max_dim:
            if w >= h:
                img = img.resize((max_dim, max(1, int(h * max_dim / w))), Image.LANCZOS)
            else:
                img = img.resize((max(1, int(w * max_dim / h)), max_dim), Image.LANCZOS)
        quality = 85
        while True:
            buf = BytesIO()
            img.save(buf, format="JPEG", quality=quality, optimize=True)
            data = buf.getvalue()
            if len(data) <= target_kb * 1024 or quality <= 40:
                return data
            quality -= 10
    except Exception:
        return None


async def store_image_from_datauri(path, data_uri, max_dim: int = 1024, target_kb: int = 220):
    """Comprime (JPEG) un data URI e lo carica su object storage al path indicato.
    Ritorna il path se ok, altrimenti None (il chiamante terrà il base64 come fallback).
    """
    jpeg = compress_data_uri_to_jpeg(data_uri, max_dim=max_dim, target_kb=target_kb)
    if not jpeg:
        return None
    try:
        await run_in_threadpool(_put_sync, path, jpeg, "image/jpeg")
        return path
    except Exception:
        return None


async def get_image(path):
    """Ritorna (bytes, content_type) dall'object storage, oppure (None, None)."""
    try:
        return await run_in_threadpool(_get_sync, path)
    except Exception:
        return None, None


async def get_image_datauri(path):
    """Ritorna un data URI (data:image/jpeg;base64,...) dall'object storage o None."""
    content, ctype = await get_image(path)
    if not content:
        return None
    ctype = ctype or "image/jpeg"
    return f"data:{ctype};base64," + base64.b64encode(content).decode()


def storage_path_for(kind: str, society_id: str, entity_id: str) -> str:
    """Costruisce il path standard: registrateam/uploads/{society}/{kind}/{id}.jpg"""
    return f"{_STORAGE_APP}/uploads/{society_id or 'shared'}/{kind}/{entity_id}.jpg"
