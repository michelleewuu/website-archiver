// VersionCompare component
// Compares two archived versions of a page and highlights any differences between them

const VersionCompare = ({ domain, path, snapshots }) => {
  const [selectedVersion1, setSelectedVersion1] = React.useState('');
  const [selectedVersion2, setSelectedVersion2] = React.useState('');
  const [diffResult, setDiffResult] = React.useState(null);
  const [isComparing, setIsComparing] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleCompare = async () => {
    if (!selectedVersion1 || !selectedVersion2 || !domain || !path) {
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
          path,
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
    <div style={{ padding: "20px" }}>
      <h3 style={{ color: "#2c3e50", marginBottom: "15px" }}>Compare Versions</h3>
      
      <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
        <select
          value={selectedVersion1}
          onChange={(e) => setSelectedVersion1(e.target.value)}
          style={{ flex: 1, padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
        >
          <option value="">Select first version</option>
          {snapshots.map((version) => (
            <option key={version} value={version}>
              {new Date(version).toLocaleString()}
            </option>
          ))}
        </select>

        <select
          value={selectedVersion2}
          onChange={(e) => setSelectedVersion2(e.target.value)}
          style={{ flex: 1, padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
        >
          <option value="">Select second version</option>
          {snapshots.map((version) => (
            <option key={version} value={version}>
              {new Date(version).toLocaleString()}
            </option>
          ))}
        </select>

        <button
          onClick={handleCompare}
          disabled={!selectedVersion1 || !selectedVersion2 || isComparing}
          style={{
            padding: "8px 20px",
            backgroundColor: (!selectedVersion1 || !selectedVersion2 || isComparing) ? "#ccc" : "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: (!selectedVersion1 || !selectedVersion2 || isComparing) ? "not-allowed" : "pointer"
          }}
        >
          {isComparing ? "Comparing..." : "Compare"}
        </button>
      </div>

      {error && <div style={{ color: "#dc3545", marginTop: "10px" }}>{error}</div>}
      {renderDiff()}
    </div>
  );
};

// Make VersionCompare available globally
window.VersionCompare = VersionCompare; 