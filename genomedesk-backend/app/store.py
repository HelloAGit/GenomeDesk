import json
import sqlite3
from pathlib import Path


class Store:
    def __init__(self, directory):
        Path(directory).mkdir(parents=True, exist_ok=True)
        self.path = str(Path(directory) / "genomedesk.sqlite3")
        with self.connect() as db:
            db.execute("CREATE TABLE IF NOT EXISTS samples (id TEXT PRIMARY KEY, document TEXT NOT NULL)")

    def connect(self):
        return sqlite3.connect(self.path, timeout=30)

    def save(self, sample):
        with self.connect() as db:
            db.execute("INSERT INTO samples VALUES (?, ?)", (sample["id"], json.dumps(sample)))

    def get(self, sample_id):
        with self.connect() as db:
            row = db.execute("SELECT document FROM samples WHERE id = ?", (sample_id,)).fetchone()
        return json.loads(row[0]) if row else None

    def list(self):
        with self.connect() as db:
            rows = db.execute("SELECT document FROM samples ORDER BY rowid DESC").fetchall()
        return [json.loads(row[0]) for row in rows]

    def delete(self, sample_id):
        with self.connect() as db:
            db.execute("DELETE FROM samples WHERE id = ?", (sample_id,))
