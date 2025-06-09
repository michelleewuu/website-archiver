// Main App component
function App() {
  const [url, setUrl] = React.useState("");
  const [domain, setDomain] = React.useState("");
  const [snapshots, setSnapshots] = React.useState([]);
  const [snapshotHTML, setSnapshotHTML] = React.useState("");
  const [archivedPages, setArchivedPages] = React.useState([]);
  const [currentTimestamp, setCurrentTimestamp] = React.useState("");
  const [isArchiving, setIsArchiving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [diffResult, setDiffResult] = React.useState(null);

  const archive = async () => {
    if (!url) {
      setError("Please enter a URL");
      return;
    }
    
    setIsArchiving(true);
    setError("");
    
    try {
      const res = await fetch("http://localhost:8000/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (data.status === "success") {
        setDomain(data.domain);
        await fetchSnapshots(data.domain);
      } else {
        setError(data.message || "Failed to archive website");
      }
    } catch (err) {
      console.error("Archive error:", err);
      setError("Failed to connect to server");
    } finally {
      setIsArchiving(false);
    }
  };

  const fetchSnapshots = async (domain) => {
    try {
      const res = await fetch(`http://localhost:8000/versions/${domain}`);
      const data = await res.json();
      setSnapshots(data.versions || []);
    } catch (err) {
      console.error("Fetch snapshots error:", err);
      setError("Failed to fetch snapshots");
    }
  };

  const viewSnapshot = async (timestamp) => {
    setCurrentTimestamp(timestamp);
    try {
      const res = await fetch(`http://localhost:8000/archives/${domain}/${timestamp}`);
      const data = await res.json();
      
      if (data.content) {
        setSnapshotHTML(data.content);
        setArchivedPages(data.pages || ['index.html']);
      } else {
        setArchivedPages(data.pages || []);
        if (data.pages && data.pages.length > 0) {
          loadArchivedPage(data.pages[0]);
        }
      }
    } catch (err) {
      console.error("Error loading snapshot:", err);
      setError("Failed to load snapshot");
    }
  };

  const loadArchivedPage = async (path) => {
    try {
      // Ensure path is properly formatted
      const cleanPath = path.startsWith('/') ? path.slice(1) : path;
      
      const res = await fetch(`http://localhost:8000/archives/${domain}/${currentTimestamp}/page/${cleanPath}`);
      const html = await res.text();
      
      // Process the HTML to handle links and scripts
      const processedHtml = html
        // Remove any external script tags
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        // Fix SVG attributes
        .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, (svg) => {
          return svg
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\')
            .replace(/transform="\\"([^"]*)\\""/g, 'transform="$1"')
            .replace(/d="\\"([^"]*)\\""/g, 'd="$1"')
            .replace(/([xy12]|width|height|rx|ry)="\\"([0-9.]+)\\""/g, '$1="$2"');
        })
        // Add styles
        .replace('</head>', `
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: -apple-system, system-ui, sans-serif; line-height: 1.5; color: #333; }
            img, svg { max-width: 100%; height: auto; }
            svg * { vector-effect: non-scaling-stroke; }
            .container, .wrapper, .content, main, article, section { 
              width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 15px; 
            }
            nav, .nav, .navigation { position: relative; z-index: 1000; }
            input, select, textarea, button { font: inherit; }
            table { width: 100%; border-collapse: collapse; }
            iframe { max-width: 100%; border: none; }
          </style>
          <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self' data:;">
        </head>`);
      
      setSnapshotHTML(processedHtml);
    } catch (err) {
      console.error("Error loading archived page:", err);
      setError("Failed to load page");
    }
  };

  const handleCompare = async () => {
    if (!selectedVersion1 || !selectedVersion2 || !domain || !archivedPages[0]) {
      setError("Please select two different versions to compare");
      return;
    }

    if (selectedVersion1 === selectedVersion2) {
      setError("Please select two different versions to compare");
      return;
    }

    setIsComparing(true);
    setError("");
    try {
      const response = await fetch('http://localhost:8000/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain,
          timestamp1: selectedVersion1,
          timestamp2: selectedVersion2,
          path: archivedPages[0],
        }),
      });
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setDiffResult(data);
      }
    } catch (error) {
      console.error("Compare error:", error);
      setError("Failed to compare versions");
    }
    setIsComparing(false);
  };

  const renderDiff = () => {
    if (!diffResult) return null;

    if (diffResult.error) {
      return <div style={{ color: "#dc3545", marginTop: "20px" }}>{diffResult.error}</div>;
    }

    return (
      <div style={{ marginTop: "20px", padding: "20px", backgroundColor: "#f8f9fa", borderRadius: "8px" }}>
        <h3 style={{ color: "#2c3e50", marginBottom: "15px" }}>Changes</h3>
        
        <div style={{ marginBottom: "20px" }}>
          <h4 style={{ color: "#2c3e50", marginBottom: "10px" }}>Text Changes</h4>
          {diffResult.diff.length === 0 ? (
            <div style={{ color: "#6c757d", fontStyle: "italic" }}>No text changes found</div>
          ) : (
            <pre style={{ backgroundColor: "white", padding: "15px", borderRadius: "4px", overflowX: "auto" }}>
              {diffResult.diff.map((line, index) => (
                <div key={index} style={{
                  color: line.startsWith('+') ? '#28a745' :
                         line.startsWith('-') ? '#dc3545' :
                         line.startsWith('@') ? '#007bff' : '#6c757d'
                }}>{line}</div>
              ))}
            </pre>
          )}
        </div>

        <div>
          <h4 style={{ color: "#2c3e50", marginBottom: "10px" }}>Image Changes</h4>
          {diffResult.added_images.length === 0 && diffResult.removed_images.length === 0 ? (
            <div style={{ color: "#6c757d", fontStyle: "italic" }}>No image changes found</div>
          ) : (
            <React.Fragment>
              {diffResult.added_images.length > 0 && (
                <div style={{ marginBottom: "15px" }}>
                  <div style={{ color: "#28a745", fontWeight: "bold", marginBottom: "5px" }}>Added Images:</div>
                  {diffResult.added_images.map((img, index) => (
                    <div key={index} style={{ fontSize: "0.9em", marginLeft: "10px" }}>{img}</div>
                  ))}
                </div>
              )}
              {diffResult.removed_images.length > 0 && (
                <div>
                  <div style={{ color: "#dc3545", fontWeight: "bold", marginBottom: "5px" }}>Removed Images:</div>
                  {diffResult.removed_images.map((img, index) => (
                    <div key={index} style={{ fontSize: "0.9em", marginLeft: "10px" }}>{img}</div>
                  ))}
                </div>
              )}
            </React.Fragment>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ color: "#2c3e50", marginBottom: "30px" }}>🕸️ Web Archiver</h1>
      
      <div style={{ marginBottom: "30px", padding: "20px", backgroundColor: "#f8f9fa", borderRadius: "8px" }}>
        <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
          <input
            type="text"
            placeholder="Enter URL (e.g., https://example.com)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{ flex: 1, padding: "10px", borderRadius: "4px", border: "1px solid #ddd" }}
          />
          <button 
            onClick={archive}
            disabled={isArchiving}
            style={{
              padding: "10px 20px",
              backgroundColor: isArchiving ? "#ccc" : "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: isArchiving ? "not-allowed" : "pointer"
            }}
          >
            {isArchiving ? "Archiving..." : "Archive"}
          </button>
        </div>
        {error && <div style={{ color: "#dc3545", marginTop: "10px" }}>{error}</div>}
      </div>

      {snapshots && snapshots.length > 0 && (
        <React.Fragment>
          <div style={{ marginBottom: "30px" }}>
            <h3 style={{ color: "#2c3e50", marginBottom: "15px" }}>Snapshots:</h3>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {snapshots.map((s) => (
                <button 
                  key={s} 
                  onClick={() => viewSnapshot(s)}
                  style={{ 
                    padding: "8px 15px",
                    backgroundColor: currentTimestamp === s ? "#007bff" : "#f8f9fa",
                    color: currentTimestamp === s ? "white" : "#2c3e50",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    cursor: "pointer"
                  }}
                >
                  {new Date(s).toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {archivedPages.length > 0 && (
            <div style={{ marginBottom: "30px", padding: "20px", backgroundColor: "#f8f9fa", borderRadius: "8px" }}>
              <VersionCompare 
                domain={domain}
                path={archivedPages[0]}
                snapshots={snapshots}
                onCompare={handleCompare}
                renderDiff={renderDiff}
              />
            </div>
          )}
        </React.Fragment>
      )}

      {snapshotHTML && (
        <div style={{ 
          border: "1px solid #ddd", 
          borderRadius: "8px",
          overflow: "hidden",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}>
          <iframe 
            srcDoc={snapshotHTML} 
            title="snapshot"
            style={{ width: "100%", height: "600px", border: "none" }}
            sandbox="allow-same-origin allow-scripts"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
}

// Error boundary component
const ErrorBoundary = ({ children }) => {
  const [hasError, setHasError] = React.useState(false);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    const handleError = (error) => {
      console.error("React error:", error);
      setHasError(true);
      setError(error);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div style={{ padding: "20px", color: "red" }}>
        <h2>Something went wrong</h2>
        <pre>{error && error.toString()}</pre>
      </div>
    );
  }

  return children;
};

// Render the main App
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

console.log("app.js has finished loading");
