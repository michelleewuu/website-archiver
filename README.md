# Website Archiver

A full-stack web archiving tool that captures and preserves websites, including all linked pages and assets on the same domain. Built with React and FastAPI, this tool allows the user to create snapshots of websites that can be viewed later.

## Features

- **Complete Website Capture**: Archives not just the main page, but all linked pages within the same domain
- **Asset Preservation**: Downloads and stores all HTML, images, stylesheets, and JavaScript files
- **Version History**: Maintains multiple snapshots of each website with timestamps
- **Local Storage**: Stores all content in a structured file system for easy access
- **Modern UI**: Clean, responsive interface for managing and viewing archives

## Technical Stack

- **Frontend**: React (using CDN for simplicity)
- **Backend**: 
  - FastAPI (Python web framework)
  - Python 3.7+
- **Storage**: File-based storage with organized directory structure
- **Key Libraries**:
  - BeautifulSoup4 for HTML parsing
  - Requests for HTTP fetching
  - FastAPI for the backend API
  - Python's built-in HTTP server for frontend serving

## How It Works

1. **URL Submission**: Users enter a URL through the web interface
2. **Recursive Crawling**: The system:
   - Fetches the main page
   - Extracts all links to pages on the same domain
   - Recursively downloads each linked page
3. **Asset Collection**: For each page:
   - Downloads all images, stylesheets, and scripts
   - Updates references to use local copies
   - Preserves the original directory structure
4. **Versioning**: Each archive is stored with:
   - A unique timestamp
   - Organized by domain
   - Maintains the original URL structure

## Setup

1. **Backend Setup**:
   ```bash
   cd backend
   pip install -r requirements.txt
   uvicorn main:app --reload
   ```

2. **Frontend Setup**:
   ```bash
   cd frontend
   python3 -m http.server 3000
   ```

3. Visit `http://localhost:3000` in your browser

---

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd website-archiver
```

### 2. Backend Setup

#### a. Create a virtual environment (recommended)
```bash
python3 -m venv venv
source venv/bin/activate
```

#### b. Install dependencies
```bash
cd backend
pip install -r requirements.txt
```

#### c. Run the backend server
```bash
uvicorn main:app --reload
```
- The backend will run on [http://localhost:8000](http://localhost:8000)

### 3. Frontend Setup

The frontend is a simple React app using CDN scripts. You can serve it with any static file server, or simply open `frontend/index.html` in your browser.

#### a. Serve with Python (optional)
```bash
cd frontend
python3 -m http.server 3000
```
- Then visit [http://localhost:3000](http://localhost:3000)

#### b. Or just open `frontend/index.html` directly in your browser.

---

## Usage

1. Open the frontend in your browser.
2. Enter the URL of the website you want to archive (e.g., `https://example.com`).
3. Click **Archive**.
4. Wait for the process to complete. You will see a list of snapshots (by timestamp).
5. Click a snapshot to view all archived pages from that crawl.
6. Click any page to view its archived content (with all assets preserved).

---

## Notes
- Only pages and assets from the same domain are archived.
- JavaScript-rendered content (dynamic sites) may not be fully captured.
- Archives are stored in the `backend/archives/` directory, organized by domain and timestamp.
- The backend must be running for the frontend to work.

---

## Requirements
- Python 3.7+
- pip
- (Optional) Node.js/npm if you want to use a different frontend setup

---

## License
MIT 
