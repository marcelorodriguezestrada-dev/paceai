import { useState, useEffect } from "react";

const ADMIN_EMAIL = "marcelorodriguezestrada@gmail.com";
const SYNC_SECRET = import.meta.env.VITE_SYNC_SECRET || "paceai2026";

const fsBase = (projectId, col, doc = "") =>
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${col}${doc ? "/" + doc : ""}`;

const fromFS = (doc) =>
  doc?.fields
    ? Object.fromEntries(
        Object.entries(doc.fields).map(([k, v]) => {
          const val = v.stringValue ?? v.integerValue ?? v.doubleValue ?? v.booleanValue ?? null;
          try { return [k, JSON.parse(val)]; } catch { return [k, val]; }
        })
      )
    : null;

async function fbListAll(projectId, collection, token) {
  const r = await fetch(
    `${fsBase(projectId, collection)}?key=${import.meta.env.VITE_FB_API_KEY}&pageSize=300`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const d = await r.json();
  return (d.documents || []).map((doc) => ({
    id: doc.name.split("/").pop(),
    ...fromFS(doc),
  }));
}

function KpiCard({ label, value, sub, color = "#FF4500", icon }) {
  return (
    <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: ".72rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>{icon} {label}</div>
      <div style={{ fontFamily: "'Anton', sans-serif", fontSize: "2.2rem", color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: ".78rem", color: "#555" }}>{sub}</div>}
    </div>
  );
}

function MiniBar({ label, value, max, color = "#FF4500" }) {
  const numVal = typeof value === "number" ? value : 0;
  const pct = max > 0 ? Math.round((numVal / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: ".8rem", color: "#ccc" }}>{label}</span>
        <span style={{ fontSize: ".8rem", color, fontWeight: 700 }}>{value}</span>
      </div>
      <div style={{ height: 5, background: "#222", borderRadius: 3 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: ".4s" }} />
      </div>
    </div>
  );
}

function EventRow({ event }) {
  const d = new Date(event.ts);
  const timeStr = d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const colorMap = {
    plan_generated: "#22c55e",
    generate_click: "#3b82f6",
    multi_plan_generated: "#a855f7",
    plan_recalibrated: "#f59e0b",
    plan_error: "#ef4444",
    page_view: "#3b82f6",
    time_on_screen: "#555",
  };
  const color = colorMap[event.event] || "#888";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 160px 1fr 80px", gap: 10, padding: "8px 0", borderBottom: "1px solid #1a1a1a", fontSize: ".78rem", alignItems: "center" }}>
      <span style={{ color: "#555" }}>{timeStr}</span>
      <span style={{ padding: "2px 8px", borderRadius: 20, background: `${color}18`, color, fontWeight: 700, fontSize: ".7rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {event.event}
      </span>
      <span style={{ color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {event.view || ""} {event.data ? `· ${event.data}` : ""}
      </span>
      <span style={{ padding: "2px 7px", borderRadius: 20, fontSize: ".65rem", fontWeight: 700, background: event.utm_source && event.utm_source !== "directo" ? "rgba(225,48,108,.15)" : "rgba(255,255,255,.05)", color: event.utm_source && event.utm_source !== "directo" ? "#E1306C" : "#444", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {event.utm_source || "directo"}
      </span>
    </div>
  );
}

// ── Componente de sync de carreras ────────────────────────────────────────────
function RacesSyncPanel({ projectId, token }) {
  const [syncing, setSyncing]     = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncError, setSyncError]   = useState("");
  const [lastSync, setLastSync]     = useState(null);
  const [raceCount, setRaceCount]   = useState(null);

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const r = await fetch(
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/races_sync/_meta?key=${import.meta.env.VITE_FB_API_KEY}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const d = await r.json();
        const meta = fromFS(d);
        if (meta) {
          setLastSync(meta.updated_at || null);
          setRaceCount(meta.count || null);
        }
      } catch {}
    };
    loadMeta();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    setSyncError("");
    try {
      const r = await fetch("/api/sync-races", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: SYNC_SECRET }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error desconocido");
      setSyncResult(d);
      setLastSync(d.updated_at);
      setRaceCount(d.count);
    } catch (err) {
      setSyncError(err.message);
    }
    setSyncing(false);
  };

  return (
    <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: 20, marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: ".72rem", color: "#FF4500", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
            🏃 Sincronización de carreras
          </div>
          <div style={{ fontSize: ".82rem", color: "#555" }}>
            Extrae carreras de dondecorrer.com con Grok y las guarda en Firebase.
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          style={{
            background: syncing ? "#1a1a1a" : "rgba(255,69,0,.15)",
            border: `1px solid ${syncing ? "#2a2a2a" : "rgba(255,69,0,.4)"}`,
            color: syncing ? "#555" : "#FF4500",
            padding: "10px 20px",
            borderRadius: 8,
            cursor: syncing ? "not-allowed" : "pointer",
            fontWeight: 700,
            fontSize: ".85rem",
            fontFamily: "'DM Sans', sans-serif",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: ".2s",
          }}
        >
          {syncing ? (
            <>
              <div style={{ width: 14, height: 14, border: "2px solid #333", borderTopColor: "#FF4500", borderRadius: "50%", animation: "sp .8s linear infinite" }} />
              Sincronizando...
            </>
          ) : (
            "🔄 Sincronizar ahora"
          )}
        </button>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: syncResult || syncError ? 14 : 0 }}>
        <div style={{ padding: "8px 14px", background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 8 }}>
          <div style={{ fontSize: ".68rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Último sync</div>
          <div style={{ fontSize: ".82rem", color: lastSync ? "#ccc" : "#444" }}>
            {lastSync ? new Date(lastSync).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Nunca"}
          </div>
        </div>
        <div style={{ padding: "8px 14px", background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 8 }}>
          <div style={{ fontSize: ".68rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Carreras en Firebase</div>
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: "1.4rem", color: "#FF4500", lineHeight: 1 }}>
            {raceCount ?? "—"}
          </div>
        </div>
        <div style={{ padding: "8px 14px", background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 8 }}>
          <div style={{ fontSize: ".68rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Cron automático</div>
          <div style={{ fontSize: ".82rem", color: "#22c55e" }}>Lunes 8am ✓</div>
        </div>
      </div>

      {syncResult && (
        <div style={{ marginTop: 14, padding: "12px 16px", background: "rgba(34,197,94,.06)", border: "1px solid rgba(34,197,94,.2)", borderRadius: 8 }}>
          <div style={{ fontSize: ".78rem", color: "#22c55e", fontWeight: 700, marginBottom: 8 }}>
            ✓ Sync exitoso — {syncResult.count} carreras guardadas
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 160, overflowY: "auto" }}>
            {(syncResult.races || []).map((r, i) => (
              <div key={i} style={{ fontSize: ".75rem", color: "#555" }}>• {r}</div>
            ))}
          </div>
        </div>
      )}

      {syncError && (
        <div style={{ marginTop: 14, padding: "12px 16px", background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 8, fontSize: ".82rem", color: "#ef4444" }}>
          ❌ Error: {syncError}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AdminPanel({ user, projectId }) {
  const [events, setEvents]       = useState([]);
  const [users, setUsers]         = useState([]);
  const [subs, setSubs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState("overview");
  const [refreshing, setRefreshing] = useState(false);

  if (!user || user.email !== ADMIN_EMAIL) {
    return <div style={{ padding: 40, textAlign: "center", color: "#555" }}>Acceso restringido.</div>;
  }

  const pid = projectId || import.meta.env.VITE_FB_PROJECT_ID;

  const loadData = async () => {
    setRefreshing(true);
    try {
      const evts = await fbListAll(pid, "analytics_global", user.token).catch(() => []);
      setEvents(evts.sort((a, b) => new Date(b.ts) - new Date(a.ts)));
      const usrs = await fbListAll(pid, "users", user.token).catch(() => []);
      setUsers(usrs);
      const subsData = await fbListAll(pid, "subscriptions_global", user.token).catch(() => []);
      setSubs(subsData);
    } catch (err) {
      console.error("[AdminPanel] load error:", err);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { loadData(); }, []);

  // ── Métricas base ──
  const totalEvents   = events.length;
  const uniqueUsers   = [...new Set(events.map(e => e.userId).filter(Boolean))].length;
  const now           = Date.now();
  const last24h       = events.filter(e => now - new Date(e.ts) < 86400000).length;
  const eventCounts   = events.reduce((acc, e) => { acc[e.event] = (acc[e.event] || 0) + 1; return acc; }, {});
  const viewCounts    = events.reduce((acc, e) => { if (e.view && e.view !== "unknown") acc[e.view] = (acc[e.view] || 0) + 1; return acc; }, {});
  const plansGenerated = (eventCounts["plan_generated"] || 0) + (eventCounts["multi_plan_generated"] || 0);
  const conversionRate = eventCounts["generate_click"] ? Math.round((plansGenerated / eventCounts["generate_click"]) * 100) : 0;
  const activeSubs    = subs.filter(s => s.status === "active").length;
  const revenue       = subs.filter(s => s.status === "active").reduce((acc, s) => acc + (Number(s.amount) || 0), 0);

  const raceCounts = events.filter(e => e.event === "generate_click" && e.data).reduce((acc, e) => {
    try { const d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; if (d.raceName) acc[d.raceName] = (acc[d.raceName] || 0) + 1; } catch {}
    return acc;
  }, {});
  const topRaces      = Object.entries(raceCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxRaceCount  = topRaces[0]?.[1] || 1;
  const maxViewCount  = Math.max(...Object.values(viewCounts), 1);
  const maxEventCount = Math.max(...Object.values(eventCounts), 1);

  // ── UTM ──
  const sourceCounts   = events.reduce((acc, e) => { const src = e.utm_source || "directo"; acc[src] = (acc[src] || 0) + 1; return acc; }, {});
  const mediumCounts   = events.reduce((acc, e) => { const med = e.utm_medium || "ninguno"; acc[med] = (acc[med] || 0) + 1; return acc; }, {});
  const campaignCounts = events.reduce((acc, e) => { const cam = e.utm_campaign || "ninguna"; acc[cam] = (acc[cam] || 0) + 1; return acc; }, {});
  const maxSrc  = Math.max(...Object.values(sourceCounts), 1);
  const maxMed  = Math.max(...Object.values(mediumCounts), 1);
  const maxCam  = Math.max(...Object.values(campaignCounts), 1);
  const utmColorMap = { instagram: "#E1306C", facebook: "#1877F2", tiktok: "#69C9D0", whatsapp: "#25D366", twitter: "#1DA1F2", directo: "#555555", ninguno: "#333333", ninguna: "#333333" };
  const uniqueBySource = events.reduce((acc, e) => {
    const src = e.utm_source || "directo";
    if (!acc[src]) acc[src] = new Set();
    if (e.userId && e.userId !== "anonymous") acc[src].add(e.userId);
    return acc;
  }, {});

  // ── Navegación ──
  const navCounts = events.filter(e => e.event === "page_view").reduce((acc, e) => {
    try { const d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; if (d?.to) acc[d.to] = (acc[d.to] || 0) + 1; } catch {}
    return acc;
  }, {});
  const timeByScreen = events.filter(e => e.event === "time_on_screen").reduce((acc, e) => {
    try {
      const d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      if (d?.view && d?.seconds) {
        if (!acc[d.view]) acc[d.view] = { total: 0, count: 0 };
        acc[d.view].total += d.seconds;
        acc[d.view].count += 1;
      }
    } catch {}
    return acc;
  }, {});
  const avgTimeByScreen = Object.fromEntries(
    Object.entries(timeByScreen).map(([v, { total, count }]) => [v, Math.round(total / count)])
  );

  // ── Estadísticas por día ──
  const dailyStats = events.reduce((acc, e) => {
    const day = (e.ts || "").slice(0, 10); // YYYY-MM-DD
    if (!day) return acc;
    if (!acc[day]) {
      acc[day] = {
        date: day,
        total: 0,
        uniqueUsers: new Set(),
        plansGenerated: 0,
        generateClicks: 0,
        pageViews: 0,
        errors: 0,
        bySource: {},
      };
    }
    acc[day].total += 1;
    if (e.userId && e.userId !== "anonymous") acc[day].uniqueUsers.add(e.userId);
    if (e.event === "plan_generated" || e.event === "multi_plan_generated") acc[day].plansGenerated += 1;
    if (e.event === "generate_click") acc[day].generateClicks += 1;
    if (e.event === "page_view") acc[day].pageViews += 1;
    if (e.event === "plan_error") acc[day].errors += 1;
    const src = e.utm_source || "directo";
    acc[day].bySource[src] = (acc[day].bySource[src] || 0) + 1;
    return acc;
  }, {});

  const dailyArray = Object.values(dailyStats)
    .map(d => ({ ...d, uniqueUsers: d.uniqueUsers.size }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const maxDailyTotal = Math.max(...dailyArray.map(d => d.total), 1);

  const TABS = [
    { id: "overview", label: "📊 Overview"   },
    { id: "daily",    label: "📈 Diario"     },
    { id: "nav",      label: "🧭 Navegación" },
    { id: "funnel",   label: "🔽 Funnel"     },
    { id: "sources",  label: "🌐 Fuentes"    },
    { id: "races",    label: "🏃 Carreras"   },
    { id: "events",   label: "📋 Eventos"    },
    { id: "users",    label: "👥 Usuarios"   },
  ];

  if (loading) return (
    <div style={{ padding: 60, textAlign: "center" }}>
      <div style={{ width: 36, height: 36, border: "3px solid #2a2a2a", borderTopColor: "#FF4500", borderRadius: "50%", animation: "sp .8s linear infinite", margin: "0 auto 14px" }} />
      <div style={{ color: "#555", fontSize: ".9rem" }}>Cargando analytics...</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px", fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: ".72rem", color: "#FF4500", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Panel del autor</div>
          <h1 style={{ fontFamily: "'Anton', sans-serif", fontSize: "2.2rem", lineHeight: 1, margin: 0 }}>PACEAI <span style={{ color: "#FF4500" }}>ANALYTICS</span></h1>
          <div style={{ color: "#555", fontSize: ".8rem", marginTop: 4 }}>{new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
        </div>
        <button
          onClick={loadData}
          disabled={refreshing}
          style={{ background: refreshing ? "#1a1a1a" : "rgba(255,69,0,.12)", border: "1px solid rgba(255,69,0,.3)", color: refreshing ? "#555" : "#FF4500", padding: "8px 18px", borderRadius: 8, cursor: refreshing ? "not-allowed" : "pointer", fontWeight: 700, fontSize: ".82rem", fontFamily: "'DM Sans', sans-serif" }}
        >
          {refreshing ? "Actualizando..." : "↻ Actualizar"}
        </button>
      </div>

      {/* ── Panel sync de carreras ── */}
      <RacesSyncPanel projectId={pid} token={user.token} />

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 28 }}>
        <KpiCard icon="👥" label="Usuarios únicos"        value={uniqueUsers || users.length} sub="con actividad registrada"                                color="#3b82f6" />
        <KpiCard icon="📋" label="Eventos totales"        value={totalEvents}                 sub={`${last24h} en las últimas 24h`}                         color="#FF4500" />
        <KpiCard icon="🤖" label="Planes generados"       value={plansGenerated}              sub={`${conversionRate}% de los clicks`}                      color="#22c55e" />
        <KpiCard icon="💳" label="Suscripciones activas" value={activeSubs}                  sub={revenue > 0 ? `ARS ${revenue.toLocaleString()} MRR` : "sin pagos aún"} color="#FFD700" />
        <KpiCard icon="❌" label="Errores de plan"        value={eventCounts["plan_error"] || 0} sub="al generar con IA"                                    color="#ef4444" />
        <KpiCard icon="🌐" label="Fuente top"             value={Object.entries(sourceCounts).sort((a,b) => b[1]-a[1])[0]?.[0] || "—"} sub={`${Object.entries(sourceCounts).sort((a,b) => b[1]-a[1])[0]?.[1] || 0} eventos`} color="#E1306C" />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{ padding: "7px 16px", borderRadius: 7, border: "1px solid", borderColor: tab === t.id ? "#FF4500" : "#2a2a2a", background: tab === t.id ? "rgba(255,69,0,.12)" : "transparent", color: tab === t.id ? "#FF4500" : "#888", fontWeight: 700, fontSize: ".8rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: ".72rem", color: "#FF4500", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Pantallas más visitadas</div>
            {Object.entries(viewCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([v, c]) => <MiniBar key={v} label={v} value={c} max={maxViewCount} color="#3b82f6" />)}
            {Object.keys(viewCounts).length === 0 && <div style={{ color: "#444", fontSize: ".82rem" }}>Sin datos aún</div>}
          </div>
          <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: ".72rem", color: "#FF4500", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Eventos por tipo</div>
            {Object.entries(eventCounts).sort((a, b) => b[1] - a[1]).map(([evt, c]) => <MiniBar key={evt} label={evt.replace(/_/g, " ")} value={c} max={maxEventCount} color="#FF4500" />)}
            {Object.keys(eventCounts).length === 0 && <div style={{ color: "#444", fontSize: ".82rem" }}>Sin datos aún</div>}
          </div>
        </div>
      )}

      {/* ── Diario ── */}
      {tab === "daily" && (
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: ".72rem", color: "#FF4500", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
              Eventos por día (últimos 14 días)
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 140, overflowX: "auto", paddingBottom: 4 }}>
              {[...dailyArray].slice(0, 14).reverse().map(d => {
                const pct = Math.max(4, Math.round((d.total / maxDailyTotal) * 100));
                const dateObj = new Date(d.date + "T12:00:00");
                const label = dateObj.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
                return (
                  <div key={d.date} style={{ flex: "1 0 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ fontSize: ".65rem", color: "#FF4500", fontWeight: 700 }}>{d.total}</div>
                    <div style={{ width: "100%", height: `${pct}%`, minHeight: 4, background: "linear-gradient(180deg, #FF4500, #FF450055)", borderRadius: "4px 4px 0 0" }} />
                    <div style={{ fontSize: ".62rem", color: "#555", whiteSpace: "nowrap" }}>{label}</div>
                  </div>
                );
              })}
              {dailyArray.length === 0 && <div style={{ color: "#444", fontSize: ".85rem" }}>Sin datos aún.</div>}
            </div>
          </div>

          <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: ".72rem", color: "#FF4500", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
              Detalle diario ({dailyArray.length} días con actividad)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 90px 90px 90px 90px 80px", gap: 10, padding: "6px 0", marginBottom: 6, borderBottom: "1px solid #2a2a2a" }}>
              {["Fecha", "Actividad", "Usuarios", "Clicks gen.", "Planes", "Vistas", "Errores"].map(h => (
                <span key={h} style={{ fontSize: ".66rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
              ))}
            </div>
            <div style={{ maxHeight: 460, overflowY: "auto" }}>
              {dailyArray.map(d => {
                const dateObj = new Date(d.date + "T12:00:00");
                const label = dateObj.toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short" });
                const pct = Math.round((d.total / maxDailyTotal) * 100);
                return (
                  <div key={d.date} style={{ display: "grid", gridTemplateColumns: "100px 1fr 90px 90px 90px 90px 80px", gap: 10, padding: "9px 0", borderBottom: "1px solid #1a1a1a", alignItems: "center", fontSize: ".8rem" }}>
                    <span style={{ color: "#ccc", textTransform: "capitalize" }}>{label}</span>
                    <div style={{ height: 6, background: "#1a1a1a", borderRadius: 3 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "#FF4500", borderRadius: 3 }} />
                    </div>
                    <span style={{ color: "#3b82f6", fontWeight: 700 }}>{d.uniqueUsers}</span>
                    <span style={{ color: "#8b5cf6", fontWeight: 700 }}>{d.generateClicks}</span>
                    <span style={{ color: "#22c55e", fontWeight: 700 }}>{d.plansGenerated}</span>
                    <span style={{ color: "#555" }}>{d.pageViews}</span>
                    <span style={{ color: d.errors > 0 ? "#ef4444" : "#444", fontWeight: d.errors > 0 ? 700 : 400 }}>{d.errors}</span>
                  </div>
                );
              })}
              {dailyArray.length === 0 && <div style={{ color: "#444", fontSize: ".85rem", padding: "20px 0" }}>Sin eventos aún.</div>}
            </div>
          </div>

          {dailyArray.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <KpiCard icon="📅" label="Mejor día" value={[...dailyArray].sort((a,b) => b.total - a.total)[0]?.date.split("-").reverse().join("/") || "—"} sub={`${[...dailyArray].sort((a,b) => b.total - a.total)[0]?.total || 0} eventos`} color="#FF4500" />
              <KpiCard icon="📊" label="Promedio diario" value={Math.round(events.length / Math.max(dailyArray.length, 1))} sub="eventos por día activo" color="#3b82f6" />
              <KpiCard icon="🔥" label="Días con actividad" value={dailyArray.length} sub="desde el primer evento" color="#22c55e" />
            </div>
          )}
        </div>
      )}

      {/* ── Navegación ── */}
      {tab === "nav" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: ".72rem", color: "#FF4500", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Pantallas más visitadas (page_view)</div>
            {Object.entries(navCounts).sort((a, b) => b[1] - a[1]).map(([screen, count]) => (
              <MiniBar key={screen} label={screen} value={count} max={Math.max(...Object.values(navCounts), 1)} color="#3b82f6" />
            ))}
            {Object.keys(navCounts).length === 0 && <div style={{ color: "#444", fontSize: ".82rem" }}>Sin datos aún — se registran al navegar.</div>}
          </div>
          <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: ".72rem", color: "#FF4500", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Tiempo promedio por pantalla</div>
            {Object.entries(avgTimeByScreen).sort((a, b) => b[1] - a[1]).map(([screen, secs]) => {
              const label = secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`;
              return <MiniBar key={screen} label={screen} value={label} max={Math.max(...Object.values(avgTimeByScreen), 1)} color="#22c55e" />;
            })}
            {Object.keys(avgTimeByScreen).length === 0 && <div style={{ color: "#444", fontSize: ".82rem" }}>Sin datos de tiempo aún.</div>}
          </div>
          <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: 20, gridColumn: "1 / -1" }}>
            <div style={{ fontSize: ".72rem", color: "#FF4500", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Flujos más comunes (de → a)</div>
            {(() => {
              const flows = events.filter(e => e.event === "page_view").reduce((acc, e) => {
                try {
                  const d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
                  if (d?.from && d?.to && d.from !== d.to) { const key = `${d.from} → ${d.to}`; acc[key] = (acc[key] || 0) + 1; }
                } catch {}
                return acc;
              }, {});
              const sorted = Object.entries(flows).sort((a, b) => b[1] - a[1]).slice(0, 8);
              const maxFlow = sorted[0]?.[1] || 1;
              return sorted.length > 0
                ? sorted.map(([flow, count]) => <MiniBar key={flow} label={flow} value={count} max={maxFlow} color="#f59e0b" />)
                : <div style={{ color: "#444", fontSize: ".82rem" }}>Sin datos de flujo aún.</div>;
            })()}
          </div>
        </div>
      )}

      {/* ── Funnel ── */}
      {tab === "funnel" && (
        <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: 24, maxWidth: 540 }}>
          <div style={{ fontSize: ".72rem", color: "#FF4500", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 20 }}>Funnel de conversión</div>
          {[
            { label: "Usuarios únicos",         value: uniqueUsers || users.length,          color: "#3b82f6" },
            { label: "Clicks en generar plan",  value: eventCounts["generate_click"] || 0,   color: "#8b5cf6" },
            { label: "Planes generados",         value: plansGenerated,                        color: "#22c55e" },
            { label: "Análisis post-carrera",   value: eventCounts["plan_recalibrated"] || 0, color: "#f59e0b" },
            { label: "Suscripciones activas",   value: activeSubs,                            color: "#FFD700" },
          ].map((step, i, arr) => {
            const pct = arr[0].value > 0 ? Math.round((step.value / arr[0].value) * 100) : 0;
            return (
              <div key={step.label} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: step.color }} />
                    <span style={{ fontSize: ".85rem", color: "#ccc" }}>{step.label}</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                    <span style={{ fontFamily: "'Anton', sans-serif", fontSize: "1.3rem", color: step.color }}>{step.value}</span>
                    <span style={{ fontSize: ".72rem", color: "#444" }}>{pct}%</span>
                  </div>
                </div>
                <div style={{ height: 8, background: "#1a1a1a", borderRadius: 4 }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: step.color, borderRadius: 4, transition: ".5s" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Fuentes UTM ── */}
      {tab === "sources" && (
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
            {Object.entries(sourceCounts).sort((a,b) => b[1]-a[1]).map(([src, count]) => (
              <div key={src} style={{ background: "#111", border: `1px solid ${(utmColorMap[src] || "#444")}33`, borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: ".7rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{src}</div>
                <div style={{ fontFamily: "'Anton', sans-serif", fontSize: "1.8rem", color: utmColorMap[src] || "#FF4500", lineHeight: 1 }}>{count}</div>
                <div style={{ fontSize: ".72rem", color: "#444", marginTop: 3 }}>{uniqueBySource[src]?.size || 0} usuarios únicos</div>
              </div>
            ))}
            {Object.keys(sourceCounts).length === 0 && (
              <div style={{ color: "#444", fontSize: ".85rem", gridColumn: "1/-1", padding: "20px 0" }}>Sin datos UTM aún. Usá los links con ?utm_source= para empezar a rastrear.</div>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 }}>
            <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: ".72rem", color: "#E1306C", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Por red social</div>
              {Object.entries(sourceCounts).sort((a,b) => b[1]-a[1]).map(([src, count]) => <MiniBar key={src} label={src} value={count} max={maxSrc} color={utmColorMap[src] || "#FF4500"} />)}
              {Object.keys(sourceCounts).length === 0 && <div style={{ color: "#444", fontSize: ".82rem" }}>Sin datos aún</div>}
            </div>
            <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: ".72rem", color: "#8b5cf6", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Por medio</div>
              {Object.entries(mediumCounts).sort((a,b) => b[1]-a[1]).map(([med, count]) => <MiniBar key={med} label={med} value={count} max={maxMed} color="#8b5cf6" />)}
              {Object.keys(mediumCounts).length === 0 && <div style={{ color: "#444", fontSize: ".82rem" }}>Sin datos aún</div>}
            </div>
            <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: ".72rem", color: "#f59e0b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Por campaña</div>
              {Object.entries(campaignCounts).sort((a,b) => b[1]-a[1]).map(([cam, count]) => <MiniBar key={cam} label={cam} value={count} max={maxCam} color="#f59e0b" />)}
              {Object.keys(campaignCounts).length === 0 && <div style={{ color: "#444", fontSize: ".82rem" }}>Sin datos aún</div>}
            </div>
          </div>
          <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: ".72rem", color: "#FF4500", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Links UTM listos para copiar</div>
            {[
              { label: "Instagram Bio",   url: "https://paceia.ezeti.pro?utm_source=instagram&utm_medium=bio&utm_campaign=lanzamiento",    color: "#E1306C" },
              { label: "Instagram Story", url: "https://paceia.ezeti.pro?utm_source=instagram&utm_medium=story&utm_campaign=lanzamiento",  color: "#E1306C" },
              { label: "Instagram Reel",  url: "https://paceia.ezeti.pro?utm_source=instagram&utm_medium=reel&utm_campaign=lanzamiento",   color: "#E1306C" },
              { label: "Facebook Post",   url: "https://paceia.ezeti.pro?utm_source=facebook&utm_medium=post&utm_campaign=lanzamiento",    color: "#1877F2" },
              { label: "WhatsApp",        url: "https://paceia.ezeti.pro?utm_source=whatsapp&utm_medium=mensaje&utm_campaign=lanzamiento", color: "#25D366" },
              { label: "TikTok Bio",      url: "https://paceia.ezeti.pro?utm_source=tiktok&utm_medium=bio&utm_campaign=lanzamiento",       color: "#69C9D0" },
            ].map(({ label, url, color }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid #1a1a1a", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: ".82rem", color: "#ccc", minWidth: 120 }}>{label}</span>
                </div>
                <code style={{ fontSize: ".72rem", color: "#555", flex: 1, wordBreak: "break-all" }}>{url}</code>
                <button onClick={() => navigator.clipboard.writeText(url)} style={{ background: "rgba(255,69,0,.1)", border: "1px solid rgba(255,69,0,.3)", color: "#FF4500", padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontSize: ".72rem", fontWeight: 700, fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>
                  Copiar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Carreras ── */}
      {tab === "races" && (
        <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: ".72rem", color: "#FF4500", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 18 }}>Carreras más elegidas</div>
          {topRaces.length === 0 ? <div style={{ color: "#444", fontSize: ".85rem" }}>Sin datos de carreras aún.</div> : (
            topRaces.map(([name, count], i) => (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: i === 0 ? "#FFD700" : i === 1 ? "#aaa" : i === 2 ? "#cd7f32" : "#2a2a2a", color: i < 3 ? "#000" : "#666", fontWeight: 900, fontSize: ".8rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: ".85rem", color: "#ccc", marginBottom: 4 }}>{name}</div>
                  <div style={{ height: 5, background: "#1a1a1a", borderRadius: 3 }}>
                    <div style={{ height: "100%", width: `${(count / maxRaceCount) * 100}%`, background: "#FF4500", borderRadius: 3 }} />
                  </div>
                </div>
                <div style={{ fontFamily: "'Anton', sans-serif", fontSize: "1.2rem", color: "#FF4500", minWidth: 30, textAlign: "right" }}>{count}</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Eventos ── */}
      {tab === "events" && (
        <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: ".72rem", color: "#FF4500", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Últimos {Math.min(events.length, 50)} eventos</div>
            <div style={{ fontSize: ".78rem", color: "#555" }}>{events.length} total</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "120px 160px 1fr 80px", gap: 10, padding: "6px 0", marginBottom: 6, borderBottom: "1px solid #2a2a2a" }}>
            {["Fecha", "Evento", "Contexto", "Fuente"].map(h => (
              <span key={h} style={{ fontSize: ".68rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</span>
            ))}
          </div>
          <div style={{ maxHeight: 480, overflowY: "auto" }}>
            {events.slice(0, 50).map((e, i) => <EventRow key={i} event={e} />)}
            {events.length === 0 && <div style={{ color: "#444", fontSize: ".85rem", padding: "20px 0" }}>Sin eventos aún.</div>}
          </div>
        </div>
      )}

      {/* ── Usuarios ── */}
      {tab === "users" && (
        <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: ".72rem", color: "#FF4500", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 18 }}>Perfiles de usuarios ({users.length})</div>
          {users.length === 0 ? <div style={{ color: "#444", fontSize: ".85rem" }}>Sin usuarios registrados con perfil aún.</div> : (
            <div style={{ display: "grid", gap: 10 }}>
              {users.map((u, i) => (
                <div key={i} style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 8, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: ".88rem" }}>{u.name || "Sin nombre"}</div>
                    <div style={{ color: "#555", fontSize: ".78rem" }}>{u.level || "—"} · {u.age ? `${u.age} años` : ""} · {u.weight ? `${u.weight}kg` : ""}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {u.level && (
                      <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: ".72rem", fontWeight: 700, background: u.level === "avanzado" ? "rgba(255,69,0,.15)" : u.level === "moderado" ? "rgba(245,158,11,.1)" : "rgba(34,197,94,.1)", color: u.level === "avanzado" ? "#FF4500" : u.level === "moderado" ? "#f59e0b" : "#22c55e" }}>{u.level}</span>
                    )}
                    {u.days && <span style={{ color: "#555", fontSize: ".78rem" }}>{u.days} días/sem</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 28, padding: "14px 18px", background: "rgba(59,130,246,.05)", border: "1px solid rgba(59,130,246,.15)", borderRadius: 10, fontSize: ".78rem", color: "#555", lineHeight: 1.6 }}>
        <strong style={{ color: "#3b82f6" }}>Nota:</strong> Para ver fuentes UTM, asegurate de que <code style={{ color: "#888" }}>trackEvent()</code> incluya <code style={{ color: "#888" }}>utm_source</code>, <code style={{ color: "#888" }}>utm_medium</code> y <code style={{ color: "#888" }}>utm_campaign</code> leídos desde sessionStorage.
      </div>
    </div>
  );
}