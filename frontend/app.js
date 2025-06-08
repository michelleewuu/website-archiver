function App() {
  const [url, setUrl] = React.useState("");
  const [domain, setDomain] = React.useState("");
  const [snapshots, setSnapshots] = React.useState([]);
  const [snapshotHTML, setSnapshotHTML] = React.useState("");

  const archive = async () => {
    const res = await fetch("http://localhost:8000/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });
    const data = await res.json();
    if (data.status === "success") {
      setDomain(data.domain);
      fetchSnapshots(data.domain);
    }
  };

  const fetchSnapshots = async (domain) => {
    const res = await fetch(`http://localhost:8000/archives/${domain}`);
    const list = await res.json();
    setSnapshots(list.reverse());
  };

  const viewSnapshot = async (timestamp) => {
    const res = await fetch(`http://localhost:8000/archives/${domain}/${timestamp}`);
    const html = await res.text();
    setSnapshotHTML(html);
  };

  return (
    <div>
      <h1>🕸️ Web Archiver</h1>
      <input
        type="text"
        placeholder="Enter URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <button onClick={archive}>Archive</button>

      {snapshots.length > 0 && (
        <div>
          <h3>Snapshots:</h3>
          {snapshots.map((s) => (
            <button key={s} onClick={() => viewSnapshot(s)}>{s}</button>
          ))}
        </div>
      )}

      {snapshotHTML && (
        <iframe srcDoc={snapshotHTML} title="snapshot"></iframe>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
