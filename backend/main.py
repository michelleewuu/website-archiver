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
from typing import Set, List, Dict, Optional
import warnings
import hashlib
import re
from difflib import unified_diff
from fastapi import HTTPException

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

class CompareRequest(BaseModel):
    domain: str
    timestamp1: str
    timestamp2: str
    path: str

class CompareResponse(BaseModel):
    diff: List[str]
    added_images: List[str]
    removed_images: List[str]
    timestamp1: str
    timestamp2: str

class ArchiveResponse(BaseModel):
    pages: List[str]
    content: Optional[str] = None

def get_domain(url: str) -> str:
    """Extract domain from URL."""
    return urlparse(url).netloc

def is_same_domain(url: str, base_domain: str) -> bool:
    """Check if URL belongs to the same domain."""
    return get_domain(url) == base_domain

def sanitize_filename(filename: str) -> str:
    """Convert URL path to a safe filename."""
    # Remove query parameters and hash
    filename = filename.split('?')[0].split('#')[0]
    
    # Use hash for long filenames
    if len(filename) > 200:
        return hashlib.md5(filename.encode()).hexdigest() + '.html'
    
    # Replace invalid characters
    return re.sub(r'[<>:"/\\|?*]', '_', filename)

def get_asset_path(url: str, base_url: str) -> str:
    """Convert absolute URL to relative path for assets."""
    parsed = urlparse(url)
    if not parsed.netloc:  # if relative url
        return url
    if parsed.netloc != get_domain(base_url):
        return url
    return parsed.path + ('?' + parsed.query if parsed.query else '')

def download_asset(url: str, base_url: str, save_dir: str) -> str:
    """Download an asset and return its relative path."""
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
    """Process HTML content to download and update asset references."""
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
    """Extract all links from HTML content."""
    soup = BeautifulSoup(html, 'html.parser')
    links = set()
    for a_tag in soup.find_all('a', href=True):
        href = a_tag['href']
        absolute_url = urljoin(base_url, href)
        if is_same_domain(absolute_url, get_domain(base_url)):
            links.add(absolute_url)
    return links

async def archive_page(url: str, domain: str, timestamp: str, visited: Set[str]) -> None:
    """Archive a single page and its assets."""
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
async def archive_page_endpoint(request: URLRequest) -> Dict[str, str]:
    """Archive a website starting from the given URL."""
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
            "pages_archived": str(len(visited))
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/archives/{domain}")
def list_archives(domain: str) -> List[str]:
    """List all available archives for a domain."""
    path = os.path.join(ARCHIVE_DIR, domain)
    if not os.path.exists(path):
        return []
    return sorted(os.listdir(path))

@app.get("/archives/{domain}/{timestamp}", response_model=ArchiveResponse)
def get_archive(domain: str, timestamp: str) -> ArchiveResponse:
    """Get all archived pages for a specific version."""
    base_path = os.path.join(ARCHIVE_DIR, domain, timestamp)
    if not os.path.exists(base_path):
        return ArchiveResponse(pages=[])
    
    # First try index.html in the root
    index_path = os.path.join(base_path, "index.html")
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            return ArchiveResponse(pages=["index.html"], content=f.read())
    
    # If not found, return a list of all archived pages
    pages = []
    for root, _, files in os.walk(base_path):
        for file in files:
            if file.endswith('.html'):
                rel_path = os.path.relpath(os.path.join(root, file), base_path)
                pages.append(rel_path)
    
    return ArchiveResponse(pages=pages)

@app.get("/archives/{domain}/{timestamp}/{path:path}")
def get_archived_page(domain: str, timestamp: str, path: str) -> str:
    """Get the content of a specific archived page."""
    filepath = os.path.join(ARCHIVE_DIR, domain, timestamp, path)
    if os.path.exists(filepath):
        # If it's an HTML file, return the content
        if filepath.endswith('.html'):
            with open(filepath, "r", encoding="utf-8") as f:
                return f.read()
        # For other files, return the file directly
        return FileResponse(filepath)
    return "Not found"

@app.get("/archives/{domain}/{timestamp}/page/{path:path}")
def get_internal_page(domain: str, timestamp: str, path: str) -> str:
    """Get the content of an internal page with processed HTML for navigation."""
    
    filepath = os.path.join(ARCHIVE_DIR, domain, timestamp, path)
    if os.path.exists(filepath):
        if filepath.endswith('.html'):
            with open(filepath, "r", encoding="utf-8") as f:
                html = f.read()
                # Process the HTML to handle internal navigation
                soup = BeautifulSoup(html, 'html.parser')
                
                # Update all internal links to use the new endpoint
                for a_tag in soup.find_all('a', href=True):
                    href = a_tag['href']
                    if href.startswith('/') or not href.startswith('http'):
                        # Convert relative path to absolute path
                        absolute_path = href.lstrip('/')
                        # Update the href to use the new endpoint
                        a_tag['href'] = f"/archives/{domain}/{timestamp}/page/{absolute_path}"
                
                # Add base tag for proper resource loading
                base_tag = soup.new_tag('base')
                base_tag['href'] = f"/archives/{domain}/{timestamp}/"
                if soup.head:
                    soup.head.insert(0, base_tag)
                else:
                    head_tag = soup.new_tag('head')
                    head_tag.append(base_tag)
                    soup.html.insert(0, head_tag)
                
                return str(soup)
        return FileResponse(filepath)
    return "Not found"

def get_page_content(domain: str, timestamp: str, path: str) -> str:
    """Get the content of a specific archived page."""
    filepath = os.path.join(ARCHIVE_DIR, domain, timestamp, path)
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read()
    return ""

def extract_text_content(html: str) -> str:
    """Extract text content from HTML, preserving structure."""
    soup = BeautifulSoup(html, 'html.parser')
    
    # Remove script and style elements
    for script in soup(["script", "style"]):
        script.decompose()
    
    # Get text content
    text = soup.get_text(separator='\n', strip=True)
    
    # Clean up whitespace
    lines = (line.strip() for line in text.splitlines())
    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
    text = '\n'.join(chunk for chunk in chunks if chunk)
    
    return text

@app.post("/compare", response_model=CompareResponse)
def compare_versions(request: CompareRequest) -> CompareResponse:
    """Compare two versions of an archived page."""
    content1 = get_page_content(request.domain, request.timestamp1, request.path)
    content2 = get_page_content(request.domain, request.timestamp2, request.path)
    
    if not content1 or not content2:
        raise HTTPException(status_code=404, detail="One or both versions not found")
    
    # Extract text content for comparison
    text1 = extract_text_content(content1)
    text2 = extract_text_content(content2)
    
    # Generate diff
    diff = list(unified_diff(
        text1.splitlines(),
        text2.splitlines(),
        fromfile=f"Version {request.timestamp1}",
        tofile=f"Version {request.timestamp2}",
        lineterm=''
    ))
    
    # Get image differences
    soup1 = BeautifulSoup(content1, 'html.parser')
    soup2 = BeautifulSoup(content2, 'html.parser')
    
    images1 = {img.get('src', '') for img in soup1.find_all('img')}
    images2 = {img.get('src', '') for img in soup2.find_all('img')}
    
    added_images = list(images2 - images1)
    removed_images = list(images1 - images2)
    
    return CompareResponse(
        diff=diff,
        added_images=added_images,
        removed_images=removed_images,
        timestamp1=request.timestamp1,
        timestamp2=request.timestamp2
    )

@app.get("/versions/{domain}")
def get_versions(domain: str) -> Dict[str, List[str]]:
    """Get all available versions for a domain."""
    path = os.path.join(ARCHIVE_DIR, domain)
    if not os.path.exists(path):
        return {"versions": []}
    versions = sorted(os.listdir(path), reverse=True)
    return {"versions": versions}