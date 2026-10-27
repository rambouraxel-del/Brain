"""Brain API — single-user, private notes service backed by SQLite."""
import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
import uuid
from collections import defaultdict, deque
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field

PASSWORD = os.getenv("BRAIN_PASSWORD", "")
SIGNING_KEY = os.getenv("BRAIN_SIGNING_KEY", "")
if len(PASSWORD) < 14 or PASSWORD.startswith("Change-moi-") or PASSWORD.startswith("CHANGE_ME"):
    raise RuntimeError("BRAIN_PASSWORD must be a unique secret of at least 14 characters, not the example value")
if len(SIGNING_KEY) < 32 or SIGNING_KEY.startswith("Change-moi-") or SIGNING_KEY.startswith("CHANGE_ME"):
    raise RuntimeError("BRAIN_SIGNING_KEY must be a randomly generated key, not the example value")

DB_PATH = Path(os.getenv("BRAIN_DB_PATH", "/data/brain.sqlite3"))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
ALLOWED_ORIGINS = [o.strip().rstrip("/") for o in os.getenv("BRAIN_ALLOWED_ORIGINS", "").split(",") if o.strip()]
if not ALLOWED_ORIGINS:
    raise RuntimeError("BRAIN_ALLOWED_ORIGINS must include the exact HTTPS origin of your GitHub Pages site")
if "*" in ALLOWED_ORIGINS:
    raise RuntimeError("Wildcard CORS origins are forbidden for this private API")

app = FastAPI(title="Brain Private API", docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
bearer = HTTPBearer(auto_error=False)

DEFAULT_SPACES = [
    ("Inbox", "#a4a9b9"), ("Projets", "#7665e9"), ("Idées", "#eda96f"),
    ("Réflexions", "#6abfa9"), ("Ressources", "#6c9bdf")
]

@contextmanager
def connection():
    con = sqlite3.connect(DB_PATH, timeout=15)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys=ON")
    con.execute("PRAGMA busy_timeout=15000")
    try:
        yield con
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def init_database():
    with connection() as con:
        con.execute("PRAGMA journal_mode=WAL")
        con.execute("CREATE TABLE IF NOT EXISTS spaces (name TEXT PRIMARY KEY, color TEXT NOT NULL)")
        con.execute("""CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL,
            space TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '[]',
            pinned INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
            FOREIGN KEY(space) REFERENCES spaces(name)
        )""")
        con.execute("CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC)")
        for name, color in DEFAULT_SPACES:
            con.execute("INSERT OR IGNORE INTO spaces (name,color) VALUES (?,?)", (name, color))

init_database()

def now():
    return datetime.now(timezone.utc).isoformat()


def b64(data: bytes):
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def unb64(text: str):
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def issue_token():
    payload = b64(json.dumps({"sub": "owner", "exp": int(time.time()) + 12 * 3600}, separators=(",", ":")).encode())
    signature = b64(hmac.new(SIGNING_KEY.encode(), payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{signature}"


def require_auth(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]):
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentification nécessaire")
    token = credentials.credentials
    if len(token) > 2048 or "." not in token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Jeton invalide")
    try:
        payload, signature = token.split(".", 1)
        expected = b64(hmac.new(SIGNING_KEY.encode(), payload.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(signature, expected):
            raise ValueError("Bad signature")
        claims = json.loads(unb64(payload))
        if claims.get("sub") != "owner" or not isinstance(claims.get("exp"), int) or claims["exp"] <= time.time():
            raise ValueError("Expired token")
    except (ValueError, TypeError, UnicodeError, json.JSONDecodeError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expirée ou invalide")
    return True

AUTH = Annotated[bool, Depends(require_auth)]

class LoginIn(BaseModel):
    password: str = Field(min_length=1, max_length=512)

class SpaceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=2, max_length=40)

class NoteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=140)
    content: str = Field(max_length=30000)
    space: str = Field(min_length=1, max_length=40)
    tags: list[str] = Field(default_factory=list, max_length=12)

class NotePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str | None = Field(default=None, min_length=1, max_length=140)
    content: str | None = Field(default=None, max_length=30000)
    space: str | None = Field(default=None, min_length=1, max_length=40)
    tags: list[str] | None = Field(default=None, max_length=12)
    pinned: bool | None = None
    archived: bool | None = None

class Imported(BaseModel):
    notes: list[dict] = Field(max_length=4000)
    spaces: list[dict] = Field(default_factory=list, max_length=100)

login_failures: dict[str, deque[float]] = defaultdict(deque)

@app.get("/api/health")
def health():
    return {"ok": True}

@app.post("/api/login")
def login(data: LoginIn, request: Request):
    # In memory limit. Behind nginx, `request.client.host` may be the proxy;
    # this is conservative and avoids trusting spoofed X-Forwarded-For headers.
    ip = request.client.host if request.client else "unknown"
    attempts = login_failures[ip]
    cutoff = time.monotonic() - 900
    while attempts and attempts[0] < cutoff:
        attempts.popleft()
    if len(attempts) >= 8:
        raise HTTPException(429, "Trop de tentatives. Réessaie dans 15 minutes.")
    if not hmac.compare_digest(data.password.encode(), PASSWORD.encode()):
        attempts.append(time.monotonic())
        raise HTTPException(401, "Mot de passe incorrect")
    attempts.clear()
    return {"access_token": issue_token(), "token_type": "bearer", "expires_in": 43200}


def serialize(row):
    return {
        "id": row["id"], "title": row["title"], "content": row["content"],
        "space": row["space"], "tags": json.loads(row["tags"]),
        "pinned": bool(row["pinned"]), "archived": bool(row["archived"]),
        "created_at": row["created_at"], "updated_at": row["updated_at"]
    }


def clean_tags(tags):
    return list(dict.fromkeys(tag.strip().lstrip("#")[:35] for tag in tags if isinstance(tag, str) and tag.strip()))[:12]


def ensure_space(con, name):
    if not con.execute("SELECT 1 FROM spaces WHERE name=?", (name,)).fetchone():
        raise HTTPException(422, f"Espace introuvable : {name}")

@app.get("/api/spaces")
def spaces(_: AUTH):
    with connection() as con:
        return [dict(r) for r in con.execute("SELECT name,color FROM spaces ORDER BY CASE WHEN name='Inbox' THEN 0 ELSE 1 END, rowid")]

@app.post("/api/spaces", status_code=201)
def add_space(body: SpaceCreate, _: AUTH):
    name = body.name.strip()
    if len(name) < 2:
        raise HTTPException(422, "Le nom doit contenir au moins deux caractères")
    with connection() as con:
        if con.execute("SELECT 1 FROM spaces WHERE lower(name)=lower(?)", (name,)).fetchone():
            raise HTTPException(409, "Cet espace existe déjà")
        color_options = ["#7665e9", "#eda96f", "#6abfa9", "#6c9bdf", "#ce8cc7"]
        count = con.execute("SELECT COUNT(*) FROM spaces").fetchone()[0]
        if count >= 100:
            raise HTTPException(422, "Limite de 100 espaces atteinte")
        color = color_options[(count - 1) % len(color_options)]
        con.execute("INSERT INTO spaces(name,color) VALUES(?,?)", (name, color))
    return {"name": name, "color": color}

@app.get("/api/notes")
def notes(_: AUTH):
    with connection() as con:
        return [serialize(row) for row in con.execute("SELECT * FROM notes ORDER BY updated_at DESC")]

@app.post("/api/notes", status_code=201)
def create_note(body: NoteCreate, _: AUTH):
    id_ = str(uuid.uuid4())
    timestamp = now()
    with connection() as con:
        ensure_space(con, body.space)
        con.execute("INSERT INTO notes(id,title,content,space,tags,pinned,archived,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
                    (id_, body.title.strip(), body.content, body.space, json.dumps(clean_tags(body.tags), ensure_ascii=False), 0, 0, timestamp, timestamp))
        result = con.execute("SELECT * FROM notes WHERE id=?", (id_,)).fetchone()
    return serialize(result)

@app.patch("/api/notes/{note_id}")
def patch_note(note_id: str, body: NotePatch, _: AUTH):
    data = body.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(422, "Aucun changement")
    if any(k in data and data[k] is None for k in data):
        raise HTTPException(422, "Les champs ne peuvent pas être nuls")
    if "title" in data:
        data["title"] = data["title"].strip()
        if not data["title"]:
            raise HTTPException(422, "Le titre ne peut pas être vide")
    if "tags" in data:
        data["tags"] = json.dumps(clean_tags(data["tags"]), ensure_ascii=False)
    if "pinned" in data:
        data["pinned"] = int(data["pinned"])
    if "archived" in data:
        data["archived"] = int(data["archived"])
    data["updated_at"] = now()
    with connection() as con:
        if not con.execute("SELECT 1 FROM notes WHERE id=?", (note_id,)).fetchone():
            raise HTTPException(404, "Note introuvable")
        if "space" in data:
            ensure_space(con, data["space"])
        sets = ", ".join(f"{k}=?" for k in data)
        con.execute(f"UPDATE notes SET {sets} WHERE id=?", [*data.values(), note_id])
        row = con.execute("SELECT * FROM notes WHERE id=?", (note_id,)).fetchone()
    return serialize(row)

@app.delete("/api/notes/{note_id}", status_code=204)
def delete_note(note_id: str, _: AUTH):
    with connection() as con:
        if not con.execute("DELETE FROM notes WHERE id=?", (note_id,)).rowcount:
            raise HTTPException(404, "Note introuvable")
    return Response(status_code=204)

@app.post("/api/import")
def import_notes(body: Imported, _: AUTH):
    count = 0
    with connection() as con:
        for space in body.spaces:
            if not isinstance(space, dict):
                continue
            name = str(space.get("name", "")).strip()[:40]
            if len(name) < 2 or con.execute("SELECT 1 FROM spaces WHERE lower(name)=lower(?)", (name,)).fetchone():
                continue
            if con.execute("SELECT count(*) FROM spaces").fetchone()[0] >= 100:
                break
            color = str(space.get("color", "#7665e9"))
            if len(color) != 7 or not color.startswith('#') or not all(ch in '0123456789abcdefABCDEF' for ch in color[1:]):
                color = '#7665e9'
            con.execute("INSERT INTO spaces(name,color) VALUES(?,?)", (name, color))
        for raw in body.notes:
            try:
                if not isinstance(raw, dict):
                    continue
                raw_id = str(raw.get("id", ""))
                try:
                    note_id = str(uuid.UUID(raw_id))
                except ValueError:
                    note_id = str(uuid.uuid5(uuid.NAMESPACE_URL, "brain-import:" + raw_id)) if raw_id else str(uuid.uuid4())
                title = str(raw.get("title", ""))[:140].strip() or "Sans titre"
                content = str(raw.get("content", ""))[:30000]
                space = str(raw.get("space", "Inbox"))[:40]
                if not con.execute("SELECT 1 FROM spaces WHERE name=?", (space,)).fetchone():
                    space = "Inbox"
                tags = clean_tags(raw.get("tags", []) if isinstance(raw.get("tags"), list) else [])
                created = str(raw.get("created_at", ""))[:40] or now()
                updated = str(raw.get("updated_at", ""))[:40] or now()
                cursor = con.execute("INSERT OR IGNORE INTO notes(id,title,content,space,tags,pinned,archived,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
                          (note_id, title, content, space, json.dumps(tags, ensure_ascii=False), int(bool(raw.get("pinned"))), int(bool(raw.get("archived"))), created, updated))
                count += cursor.rowcount
            except (ValueError, TypeError, sqlite3.Error):
                continue
    return {"imported": count}
