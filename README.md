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
- **Libraries**:
  - BeautifulSoup4 for HTML parsing
  - Requests for HTTP fetching
  - FastAPI for the backend API
  - Python's built-in HTTP server for frontend serving

## How It Works

1. **URL Submission**: User submits a URL through the web interface
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


## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/michelleewuu/website-archiver.git
cd website-archiver
```

### 2. Backend Setup

#### a. Install dependencies
```bash
cd backend
pip install -r requirements.txt
```

#### b. Run the backend server
```bash
uvicorn main:app --reload
```

### 3. Frontend Setup

#### Serve with Python
```bash
cd frontend
python3 -m http.server 3000
```
- Then visit [http://localhost:3000](http://localhost:3000)


## Notes
- Only pages and assets from the same domain are archived.
- JavaScript-rendered content (dynamic sites) may not be fully captured.
- Archives are stored in the `backend/archives/` directory, organized by domain and timestamp.
