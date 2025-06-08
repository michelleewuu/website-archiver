function App() {
  const [url, setUrl] = React.useState("");
  const [domain, setDomain] = React.useState("");
  const [snapshots, setSnapshots] = React.useState([]);
  const [snapshotHTML, setSnapshotHTML] = React.useState("");
  const [archivedPages, setArchivedPages] = React.useState([]);
  const [currentTimestamp, setCurrentTimestamp] = React.useState("");
  const [isArchiving, setIsArchiving] = React.useState(false);
  const [error, setError] = React.useState("");

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
      setError("Failed to connect to server");
    } finally {
      setIsArchiving(false);
    }
  };

  const fetchSnapshots = async (domain) => {
    try {
      const res = await fetch(`http://localhost:8000/archives/${domain}`);
      const list = await res.json();
      setSnapshots(list.reverse());
    } catch (err) {
      setError("Failed to fetch snapshots");
    }
  };

  const viewSnapshot = async (timestamp) => {
    setCurrentTimestamp(timestamp);
    try {
      const res = await fetch(`http://localhost:8000/archives/${domain}/${timestamp}`);
      const data = await res.json();
      
      if (typeof data === 'string') {
        setSnapshotHTML(data);
        setArchivedPages([]);
      } else {
        setArchivedPages(data.pages);
        if (data.pages.length > 0) {
          loadArchivedPage(data.pages[0]);
        }
      }
    } catch (err) {
      setError("Failed to load snapshot");
    }
  };

  const loadArchivedPage = async (path) => {
    try {
      const res = await fetch(`http://localhost:8000/archives/${domain}/${currentTimestamp}/${path}`);
      const html = await res.text();
      setSnapshotHTML(html);
    } catch (err) {
      setError("Failed to load page");
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ color: "#2c3e50", marginBottom: "30px" }}>🕸️ Web Archiver</h1>
      
      <div style={{ 
        marginBottom: "30px", 
        padding: "20px", 
        backgroundColor: "#f8f9fa", 
        borderRadius: "8px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
      }}>
        <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
          <input
            type="text"
            placeholder="Enter URL (e.g., https://example.com)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{ 
              flex: 1,
              padding: "10px",
              borderRadius: "4px",
              border: "1px solid #ddd"
            }}
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
        {error && (
          <div style={{ color: "#dc3545", marginTop: "10px" }}>
            {error}
          </div>
        )}
      </div>

      {snapshots.length > 0 && (
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
      )}

      {archivedPages.length > 0 && (
        <div style={{ marginBottom: "30px" }}>
          <h3 style={{ color: "#2c3e50", marginBottom: "15px" }}>Archived Pages:</h3>
          <div style={{ 
            display: "flex", 
            gap: "10px", 
            flexWrap: "wrap",
            maxHeight: "200px",
            overflowY: "auto",
            padding: "10px",
            backgroundColor: "#f8f9fa",
            borderRadius: "4px"
          }}>
            {archivedPages.map((page) => (
              <button 
                key={page} 
                onClick={() => loadArchivedPage(page)}
                style={{ 
                  padding: "5px 10px",
                  backgroundColor: "white",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "0.9em"
                }}
              >
                {page}
              </button>
            ))}
          </div>
        </div>
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
            style={{ 
              width: "100%", 
              height: "600px", 
              border: "none"
            }}
          />
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
