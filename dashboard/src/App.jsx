import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const STRESS_PROMPTS = [
  "What is machine learning", "Explain Python programming",
  "How does the internet work", "What is deep learning",
  "Explain artificial intelligence", "What is a neural network",
  "How does backpropagation work", "What is gradient descent",
  "Explain natural language processing", "What is a transformer model",
];

const C = {
  bg: "#f4f6f9",
  surface: "#ffffff",
  border: "#e2e6ed",
  text: "#111827",
  textMuted: "#6b7280",
  textSub: "#9ca3af",
  blue: "#2563eb",
  blueBg: "#eff6ff",
  green: "#16a34a",
  greenBg: "#f0fdf4",
  red: "#dc2626",
  redBg: "#fef2f2",
  amber: "#d97706",
  amberBg: "#fffbeb",
  purple: "#7c3aed",
  purpleBg: "#f5f3ff",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Syne:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { width: 100%; background: ${C.bg}; }
  body { font-family: 'Syne', system-ui; color: ${C.text}; }
  textarea { font-family: 'IBM Plex Mono', monospace; }
  .tab-btn { background: none; border: none; cursor: pointer; font-family: 'Syne', system-ui; transition: color 0.15s; }
  .send-btn { transition: opacity 0.15s, transform 0.1s; cursor: pointer; }
  .send-btn:hover { opacity: 0.88; }
  .send-btn:active { transform: scale(0.97); }
  .req-row { transition: background 0.12s; border-radius: 6px; padding: 7px 8px; }
  .req-row:hover { background: ${C.bg}; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
  .live-dot { animation: pulse 2s ease-in-out infinite; }
  @keyframes fadeIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
  .fade-in { animation: fadeIn 0.25s ease forwards; }
`;

function MetricCard({ label, value, sub, accent }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px", borderLeft: `4px solid ${accent || C.border}` }}>
      <div style={{ fontSize: 16, color: C.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 27, fontWeight: 700, color: accent || C.text, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 15, color: C.textSub, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function Badge({ cached }) {
  return (
    <span style={{ fontSize: 13, padding: "2px 8px", borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.04em", background: cached ? C.greenBg : C.blueBg, color: cached ? C.green : C.blue, border: `1px solid ${cached ? "#bbf7d0" : "#bfdbfe"}`, fontWeight: 500 }}>
      {cached ? "cached" : "model"}
    </span>
  );
}

export default function App() {
  const [tab, setTab] = useState("playground");
  const [metrics, setMetrics] = useState(null);
  const [history, setHistory] = useState([]);
  const [recentRequests, setRecentRequests] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stressStats, setStressStats] = useState(null);
  const [stressComplete, setStressComplete] = useState(false);
  const [alpacaPrompts, setAlpacaPrompts] = useState([]);

  useEffect(() => {
    fetch("/alpaca_prompts.json")
      .then(r => r.json())
      .then(data => setAlpacaPrompts(data))
      .catch(() => console.log("Could not load Alpaca prompts"));
  }, []);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [mRes, rRes] = await Promise.all([
          fetch(`${API_URL}/metrics`),
          fetch(`${API_URL}/recent-requests`)
        ]);
        const m = await mRes.json();
        const r = await rRes.json();
        if (m.total_requests !== undefined) {
          setMetrics(m);
          setHistory(prev => [...prev, {
            time: new Date().toLocaleTimeString(),
            avg: Math.round(m.avg_latency_ms),
            p95: Math.round(m.p95_latency_ms),
            hits: m.cache_hits,
            misses: m.cache_misses,
          }].slice(-20));
        } else {
          setMetrics({ total_requests: 0, cache_hit_rate_pct: 0, avg_latency_ms: 0, p95_latency_ms: 0, cache_hits: 0, cache_misses: 0 });
        }
        setRecentRequests(r);
      } catch (e) {}
    };
    fetchAll();
    const interval = setInterval(fetchAll, 3000);
    return () => clearInterval(interval);
  }, []);

  const sendPrompt = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setResponse(null);
    setStressStats(null);
    setStressComplete(false);
    try {
      const res = await fetch(`${API_URL}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      setResponse(data);
    } catch (e) {
      setResponse({ error: "Could not connect to server" });
    }
    setLoading(false);
  };

  const clearCache = async () => {
    await fetch(`${API_URL}/clear-cache`, { method: "POST" });
    setResponse(null);
    setPrompt("");
    setStressStats(null);
    setStressComplete(false);
  };

  const runStressTest = async () => {
    setStressStats({ hits: 0, misses: 0 });
    setStressComplete(false);
    setResponse(null);
    setPrompt("");
    let hits = 0, misses = 0;
    const pool = alpacaPrompts.length > 0 ? alpacaPrompts : STRESS_PROMPTS;
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 50);
    for (let i = 0; i < 50; i++) {
      const p = shuffled[i];
      fetch(`${API_URL}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p })
      }).then(r => r.json()).then(data => {
        if (data.cached) hits++; else misses++;
        setStressStats({ hits, misses });
      });
      await new Promise(r => setTimeout(r, 80));
    }
    setStressComplete(true);
  };

  const tooltipStyle = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, color: C.text };

  return (
    <>
      <style>{css}</style>
      <div style={{ width: "100%", minHeight: "100vh", background: C.bg, paddingBottom: 60 }}>
        <div style={{ width: "100%", padding: "24px 40px" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: C.text }}>vLLM mini</div>
                <div style={{ fontSize: 13, color: C.textMuted, fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>LLM inference engine · dynamic batching</div>
              </div>
              <div style={{ height: 36, width: 1, background: C.border }} />
              <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 20, background: C.blueBg, color: C.blue, border: `1px solid #bfdbfe`, fontFamily: "'IBM Plex Mono', monospace" }}>
                GPT-2 · CPU
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="live-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: metrics ? C.green : C.textMuted }} />
              <span style={{ fontSize: 12, color: metrics ? C.green : C.textMuted, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 500 }}>
                {metrics ? "live" : "connecting..."}
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 2, marginBottom: 24, borderBottom: `1px solid ${C.border}` }}>
            {["playground", "dashboard", "architecture"].map(t => (
              <button key={t} className="tab-btn" onClick={() => setTab(t)} style={{
                fontSize: 13, padding: "9px 20px",
                color: tab === t ? C.blue : C.textMuted,
                borderBottom: tab === t ? `2px solid ${C.blue}` : "2px solid transparent",
                fontWeight: tab === t ? 600 : 400,
                marginBottom: -1,
              }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Metric Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 14, marginBottom: 24 }}>
            <MetricCard label="Total requests" value={metrics?.total_requests ?? "—"} accent={C.textMuted} />
            <MetricCard label="Cache hit rate" value={metrics ? `${metrics.cache_hit_rate_pct}%` : "—"} sub="semantic similarity" accent={C.green} />
            <MetricCard label="Avg latency" value={metrics ? `${Math.round(metrics.avg_latency_ms)}ms` : "—"} accent={C.blue} />
            <MetricCard label="p95 latency" value={metrics ? `${Math.round(metrics.p95_latency_ms)}ms` : "—"} accent={C.red} />
          </div>

          {/* Playground */}
          {tab === "playground" && (
            <div className="fade-in" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(0,0.6fr)", gap: 16 }}>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12 }}>Send a prompt</div>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="Ex: What is machine learning?"
                  style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", fontSize: 13, color: C.text, resize: "none", height: 96, outline: "none", lineHeight: 1.6 }}
                />
                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <button className="send-btn" onClick={sendPrompt} disabled={loading} style={{ fontSize: 13, padding: "9px 22px", borderRadius: 8, border: "none", background: C.blue, color: "#fff", fontFamily: "'Syne', system-ui", fontWeight: 600 }}>
                    {loading ? "Generating..." : "Send prompt"}
                  </button>
                  <button className="send-btn" onClick={clearCache} style={{ fontSize: 13, padding: "9px 22px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, color: C.textMuted, fontFamily: "'Syne', system-ui", fontWeight: 600 }}>
                    Clear cache
                  </button>
                  <button className="send-btn" onClick={runStressTest} style={{ fontSize: 13, padding: "9px 22px", borderRadius: 8, border: `1px solid ${C.amber}`, background: C.amberBg, color: C.amber, fontFamily: "'Syne', system-ui", fontWeight: 600 }}>
                    Stress test (50)
                  </button>
                </div>

                {stressStats && (
                  <div style={{ display: "flex", gap: 20, marginTop: 14, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: stressComplete ? C.green : C.textMuted, fontFamily: "'IBM Plex Mono', monospace", fontWeight: stressComplete ? 600 : 400 }}>
                      {stressComplete ? "Test complete!" : "Stress test running..."}
                    </span>
                    <span style={{ fontSize: 12, color: C.green, fontFamily: "'IBM Plex Mono', monospace" }}>{stressStats.hits} cache hits</span>
                    <span style={{ fontSize: 12, color: C.blue, fontFamily: "'IBM Plex Mono', monospace" }}>{stressStats.misses} model calls</span>
                  </div>
                )}

                {response && (
                  <div className="fade-in" style={{ marginTop: 16, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 16px" }}>
                    <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>Response</div>
                    <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7, fontFamily: "'IBM Plex Mono', monospace", wordBreak: "break-word", overflowWrap: "break-word", maxHeight: 200, overflowY: "auto" }}>
                      {response.error || response.generated_text}
                    </div>
                    {!response.error && (
                      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                        <Badge cached={response.cached} />
                        <span style={{ fontSize: 11, color: C.textMuted, fontFamily: "'IBM Plex Mono', monospace" }}>{Math.round(response.latency_ms)}ms</span>
                        <span style={{ fontSize: 11, color: C.textMuted, fontFamily: "'IBM Plex Mono', monospace" }}>id: {response.request_id}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 14 }}>Live request feed</div>
                {recentRequests.length === 0 ? (
                  <div style={{ fontSize: 12, color: C.textMuted }}>No requests yet — send a prompt!</div>
                ) : (
                  recentRequests.map((r, i) => (
                    <div key={i} className="req-row" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ color: C.textSub, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, width: 52, flexShrink: 0 }}>#{r.request_id.slice(0, 6)}</span>
                      <span style={{ flex: 1, fontSize: 14, color: C.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.prompt}</span>
                      <Badge cached={r.cached} />
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.textSub, width: 48, textAlign: "right" }}>{Math.round(r.latency_ms)}ms</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Dashboard */}
          {tab === "dashboard" && (
            <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 16 }}>Latency over time (ms)</div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: C.textMuted }} />
                    <YAxis tick={{ fontSize: 10, fill: C.textMuted }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="avg" stroke={C.blue} dot={false} name="Avg latency" strokeWidth={2} />
                    <Line type="monotone" dataKey="p95" stroke={C.red} dot={false} name="p95 latency" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 16 }}>Cache hits vs model calls</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: C.textMuted }} />
                    <YAxis tick={{ fontSize: 10, fill: C.textMuted }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="hits" fill={C.green} name="Cache hits" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="misses" fill={C.blue} name="Model calls" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Architecture */}
          {tab === "architecture" && (
            <div className="fade-in" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 16 }}>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 20 }}>Request flow</div>
                {[
                  { step: "01", label: "FastAPI gateway", desc: "Receives prompt via POST /generate", color: C.blue, bg: C.blueBg },
                  { step: "02", label: "Semantic cache", desc: "Embeds prompt, checks cosine similarity > 0.80", color: C.green, bg: C.greenBg },
                  { step: "03", label: "Async queue", desc: "Assigns unique future, waits for result", color: C.amber, bg: C.amberBg },
                  { step: "04", label: "Dynamic batcher", desc: "Groups up to 8 requests within 50ms window", color: C.purple, bg: C.purpleBg },
                  { step: "05", label: "Model inference", desc: "Single forward pass for entire batch", color: C.red, bg: C.redBg },
                  { step: "06", label: "Response router", desc: "Resolves each future with correct result", color: C.blue, bg: C.blueBg },
                ].map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 14, marginBottom: 16, alignItems: "flex-start" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: s.color, flexShrink: 0, fontFamily: "'IBM Plex Mono', monospace", border: `1px solid ${s.color}22` }}>{s.step}</div>
                    <div style={{ flex: 1, paddingTop: 2 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 3 }}>{s.label}</div>
                      <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                  <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 14 }}>Tech stack</div>
                  {[
                    { label: "API", value: "FastAPI + uvicorn" },
                    { label: "Queue", value: "asyncio.Queue" },
                    { label: "Model", value: "HuggingFace Transformers" },
                    { label: "Cache", value: "Redis + sentence-transformers" },
                    { label: "Embeddings", value: "all-MiniLM-L6-v2" },
                    { label: "Load test", value: "k6" },
                  ].map((item, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 12, color: C.textMuted }}>{item.label}</span>
                      <span style={{ fontSize: 12, color: C.text, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 500 }}>{item.value}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                  <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 14 }}>Benchmarks</div>
                  {[
                    { label: "Cache hit latency", value: "< 50ms", color: C.green },
                    { label: "Model latency (CPU)", value: "~8s", color: C.blue },
                    { label: "Error rate (50 VUs)", value: "0%", color: C.green },
                    { label: "Max batch size", value: "8 requests", color: C.amber },
                    { label: "Cache threshold", value: "0.80 cosine", color: C.purple },
                  ].map((item, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 12, color: C.textMuted }}>{item.label}</span>
                      <span style={{ fontSize: 12, color: item.color, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
