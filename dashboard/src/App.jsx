import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";

const METRICS_URL = "http://127.0.0.1:8000/metrics";

function MetricCard({ label, value, sub, color }) {
  return (
    <div style={{ background: "#f9f9f9", borderRadius: 10, padding: "16px 20px", flex: 1 }}>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, color: color || "#111" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function App() {
  const [metrics, setMetrics] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch(METRICS_URL);
        const data = await res.json();
        setMetrics(data);
        setHistory(prev => {
          const next = [...prev, {
            time: new Date().toLocaleTimeString(),
            avg_latency: Math.round(data.avg_latency_ms),
            p95_latency: Math.round(data.p95_latency_ms),
            cache_hits: data.cache_hits,
            cache_misses: data.cache_misses,
          }];
          return next.slice(-20);
        });
      } catch (e) {
        console.error("Failed to fetch metrics", e);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!metrics) return <div style={{ padding: 40, color: "#888" }}>Connecting to server...</div>;

  return (
    <div style={{ fontFamily: "system-ui", padding: "24px 32px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>LLM Inference Dashboard</h1>
        <p style={{ color: "#888", margin: "4px 0 0", fontSize: 13 }}>Live metrics — refreshes every 2s</p>
      </div>

      {/* Metric Cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <MetricCard label="Total Requests" value={metrics.total_requests} />
        <MetricCard label="Cache Hit Rate" value={`${metrics.cache_hit_rate_pct}%`} color="#16a34a" sub="semantic cache" />
        <MetricCard label="Avg Latency" value={`${Math.round(metrics.avg_latency_ms)}ms`} color="#2563eb" />
        <MetricCard label="p95 Latency" value={`${Math.round(metrics.p95_latency_ms)}ms`} color="#dc2626" />
      </div>

      {/* Latency Chart */}
      <div style={{ background: "#f9f9f9", borderRadius: 10, padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, color: "#444" }}>Latency over time (ms)</div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="avg_latency" stroke="#2563eb" dot={false} name="Avg latency" strokeWidth={2} />
            <Line type="monotone" dataKey="p95_latency" stroke="#dc2626" dot={false} name="p95 latency" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Cache hits vs misses */}
      <div style={{ background: "#f9f9f9", borderRadius: 10, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, color: "#444" }}>Cache hits vs misses</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={history}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="cache_hits" fill="#16a34a" name="Cache hits" />
            <Bar dataKey="cache_misses" fill="#dc2626" name="Cache misses" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}