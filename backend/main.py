from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import requests
import os

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ARCHIVE_DIR = "archives"

class URLRequest(BaseModel):
    url: str

@app.post("/archive")
def archive_page(request: URLRequest):
    url = request.url
    timestamp = datetime.utcnow().isoformat()
    domain = url.split("//")[-1].split("/")[0]
    folder = os.path.join(ARCHIVE_DIR, domain, timestamp)
    os.makedirs(folder, exist_ok=True)

    try:
        response = requests.get(url)
        filepath = os.path.join(folder, "index.html")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(response.text)
        return {"status": "success", "domain": domain, "timestamp": timestamp}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/archives/{domain}")
def list_archives(domain: str):
    path = os.path.join(ARCHIVE_DIR, domain)
    if not os.path.exists(path):
        return []
    return sorted(os.listdir(path))

@app.get("/archives/{domain}/{timestamp}")
def get_archive(domain: str, timestamp: str):
    filepath = os.path.join(ARCHIVE_DIR, domain, timestamp, "index.html")
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read()
    return "Not found"