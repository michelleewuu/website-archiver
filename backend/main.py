from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from datetime import datetime
import requests
import os
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning
from urllib.parse import urljoin, urlparse
import asyncio
from typing import Set
import warnings
import hashlib
import re

# Suppress BeautifulSoup XML parsing warnings
warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

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

def get_domain(url: str) -> str:
    return urlparse(url).netloc

def is_same_domain(url: str, base_domain: str) -> bool:
    return get_domain(url) == base_domain

def sanitize_filename(filename: str) -> str:
    """Convert a URL path to a safe filename"""
    # Remove query parameters and hash
    filename = filename.split('?')[0].split('#')[0]
    
    # If the filename is too long, use a hash
    if len(filename) > 200:  # Reasonable max length for filenames
        return hashlib.md5(filename.encode()).hexdigest() + '.html'
    
    # Replace invalid characters
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    return filename

def get_asset_path(url: str, base_url: str) -> str:
    """Convert absolute URL to relative path for assets"""
    parsed = urlparse(url)
    if not parsed.netloc:  # if relative url
        return url
    if parsed.netloc != get_domain(base_url):
        return url
    return parsed.path + ('?' + parsed.query if parsed.query else '')

def download_asset(url: str, base_url: str, save_dir: str) -> str:
    """Download an asset and return its relative path"""
    try:
        response = requests.get(url, stream=True)
        if response.status_code != 200:
            return url

        # Create path for the asset
        asset_path = get_asset_path(url, base_url)
        if asset_path.startswith('/'):
            asset_path = asset_path[1:]
        asset_path = sanitize_filename(asset_path)
        
        # Create directories if needed
        full_path = os.path.join(save_dir, asset_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        
        # Save the asset
        with open(full_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        return asset_path
    except Exception as e:
        print(f"Error downloading asset {url}: {str(e)}")
        return url

def process_html_content(html: str, base_url: str, save_dir: str) -> str:
    """Process HTML content to download and update asset references"""
    soup = BeautifulSoup(html, 'html.parser')
    
    # Process images
    for img in soup.find_all('img', src=True):
        img_url = urljoin(base_url, img['src'])
        if is_same_domain(img_url, get_domain(base_url)):
            new_path = download_asset(img_url, base_url, save_dir)
            img['src'] = new_path
    
    # Process stylesheets
    for link in soup.find_all('link', rel='stylesheet', href=True):
        css_url = urljoin(base_url, link['href'])
        if is_same_domain(css_url, get_domain(base_url)):
            new_path = download_asset(css_url, base_url, save_dir)
            link['href'] = new_path
    
    # Process scripts
    for script in soup.find_all('script', src=True):
        script_url = urljoin(base_url, script['src'])
        if is_same_domain(script_url, get_domain(base_url)):
            new_path = download_asset(script_url, base_url, save_dir)
            script['src'] = new_path
    
    return str(soup)

def extract_links(html: str, base_url: str) -> Set[str]:
    soup = BeautifulSoup(html, 'html.parser')
    links = set()
    for a_tag in soup.find_all('a', href=True):
        href = a_tag['href']
        absolute_url = urljoin(base_url, href)
        if is_same_domain(absolute_url, get_domain(base_url)):
            links.add(absolute_url)
    return links

async def archive_page(url: str, domain: str, timestamp: str, visited: Set[str]) -> None:
    if url in visited:
        return
    
    visited.add(url)
    try:
        response = requests.get(url)
        # Create a path based on the URL structure
        path_parts = urlparse(url).path.strip('/').split('/')
        if not path_parts[0]:
            path_parts = ['index']
        path_parts = [sanitize_filename(part) for part in path_parts]
        
        folder = os.path.join(ARCHIVE_DIR, domain, timestamp, *path_parts[:-1])
        os.makedirs(folder, exist_ok=True)
        
        filename = path_parts[-1] if path_parts[-1] else 'index.html'
        if not filename.endswith('.html'):
            filename += '.html'
            
        filepath = os.path.join(folder, filename)
        
        # Process HTML content to download assets
        processed_html = process_html_content(response.text, url, os.path.join(ARCHIVE_DIR, domain, timestamp))
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(processed_html)
            
        # Extract and archive linked pages
        links = extract_links(processed_html, url)
        for link in links:
            if link not in visited:
                await archive_page(link, domain, timestamp, visited)
                
    except Exception as e:
        print(f"Error archiving {url}: {str(e)}")

@app.post("/archive")
async def archive_page_endpoint(request: URLRequest):
    url = request.url
    timestamp = datetime.utcnow().isoformat()
    domain = get_domain(url)
    visited = set()
    
    try:
        await archive_page(url, domain, timestamp, visited)
        return {
            "status": "success",
            "domain": domain,
            "timestamp": timestamp,
            "pages_archived": len(visited)
        }
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
    base_path = os.path.join(ARCHIVE_DIR, domain, timestamp)
    if not os.path.exists(base_path):
        return "Not found"
    
    # First try index.html in the root
    index_path = os.path.join(base_path, "index.html")
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            return f.read()
    
    # If not found, return a list of all archived pages
    pages = []
    for root, _, files in os.walk(base_path):
        for file in files:
            if file.endswith('.html'):
                rel_path = os.path.relpath(os.path.join(root, file), base_path)
                pages.append(rel_path)
    
    return {"pages": pages}

@app.get("/archives/{domain}/{timestamp}/{path:path}")
def get_archived_page(domain: str, timestamp: str, path: str):
    filepath = os.path.join(ARCHIVE_DIR, domain, timestamp, path)
    if os.path.exists(filepath):
        # If it's an HTML file, return the content
        if filepath.endswith('.html'):
            with open(filepath, "r", encoding="utf-8") as f:
                return f.read()
        # For other files, return the file directly
        return FileResponse(filepath)
    return "Not found"