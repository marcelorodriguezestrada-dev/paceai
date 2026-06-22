import { useState, useEffect } from "react";

/**
 * AdminPanel — Panel de analytics para el autor de PaceAI
 *
 * Cómo activarlo: agregar al VIEWS en App.jsx:
 *   admin: () => user?.email === "TU_EMAIL_AQUI" ? <AdminPanel user={user} FB={FB} /> : null
 *
 * Los eventos globales se guardan en la colección "analytics_global" en Firestore.
 * Para eso, trackEvent() debe también escribir ahí (ver instrucciones al final).
 */

const ADMIN_EMAIL = "marcelorodriguezestrada@gmail.com"; // ← cambiá por tu email

// ── Helpers Firestore ────────────────────────────────────────────────────────
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

// ── Componentes visuales ─────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = "#FF4500", icon }) {
  return (
    <div style={{
      background: "#111",
      border: "1px solid #2a2a2a",
      borderRadius: 12,
      padding: "18px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 4,
    }}>
      <div style={{ fontSize: ".72rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>
        {icon} {label}
      </div>
      <div style={{ fontFamily: "'Anton', sans-serif", fontSize: "2.2rem", color, lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: ".78rem", color: "#555" }}>{sub}</div>}
    </div>
  );
}

function MiniBar({ label, value, max, color = "#FF4500" }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
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
  };
  const color = colorMap[event.event] || "#888";
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "120px 160px 1fr",
      gap: 10,
      padding: "8px 0",
      borderBottom: "1px solid #1a1a1a",
      fontSize: ".78rem",
      alignItems: "center",
    }}>
      <span style={{ color: "#555" }}>{timeStr}</span>
      <span style={{
        padding: "2px 8px",
        borderRadius: 20,
        background: `${color}18`,
        color,
        fontWeight: 700,
        fontSize: ".7rem",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}>
        {event.event}
      </span>
      <span style={{ color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {event.view || ""} {event.data ? `· ${event.data}` : ""}
      </span>
    </div>
  );
}

// ── Panel principal ──────────────────────────────────────────────────────────
export default function AdminPanel({ user, projectId }) {
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [refreshing, setRefreshing] = useState(false);

  if (!user || user.email !== ADMIN_EMAIL) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#555" }}>
        Acceso restringido.
      </div>
    );
  }

  const pid = projectId || import.meta.env.VITE_FB_PROJECT_ID;

  const loadData = async () => {
    setRefreshing(true);
    try {
      // Eventos globales
      const evts = await fbListAll(pid, "analytics_global", user.token).catch(() => []);
      setEvents(evts.sort((a, b) => new Date(b.ts) - new Date(a.ts)));

      // Usuarios registrados (colección "users")
      const usrs = await fbListAll(pid, "users", user.token).catch(() => []);
      setUsers(usrs);

      // Suscripciones — buscamos en la colección global
      const subsData = await fbListAll(pid, "subscriptions_global", user.token).catch(() => []);
      setSubs(subsData);
    } catch (err) {
      console.error("[AdminPanel] load error:", err);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { loadData(); }, []);

  // ── Métricas calculadas ──
  const totalEvents = events.length;
  const uniqueUsers = [...new Set(events.map(e => e.userId).filter(Boolean))].length;

  const eventCounts = events.reduce((acc, e) => {
    acc[e.event] = (acc[e.event] || 0) + 1;
    return acc;
  }, {});

  const viewCounts = events.reduce((acc, e) => {
    if (e.view && e.view !== "unknown") acc[e.view] = (acc[e.view] || 0) + 1;
    return acc;
  }, {});

  const plansGenerated = (eventCounts["plan_generated"] || 0) + (eventCounts["multi_plan_generated"] || 0);
  const conversionRate = eventCounts["generate_click"]
    ? Math.round((plansGenerated / eventCounts["generate_click"]) * 100)
    : 0;

  const activeSubs = subs.filter(s => s.status === "active").length;
  const revenue = subs
    .filter(s => s.status === "active")
    .reduce((acc, s) => acc + (Number(s.amount) || 0), 0);

  // Eventos últimas 24h
  const now = Date.now();
  const last24h = events.filter(e => now - new Date(e.ts) < 86400000).length;

  // Top races
  const raceCounts = events
    .filter(e => e.event === "generate_click" && e.data)
    .reduce((acc, e) => {
      try {
        const d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (d.raceName) acc[d.raceName] = (acc[d.raceName] || 0) + 1;
      } catch {}
      return acc;
    }, {});

  const topRaces = Object.entries(raceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const maxRaceCount = topRaces[0]?.[1] || 1;
  const maxViewCount = Math.max(...Object.values(viewCounts), 1);
  const maxEventCount = Math.max(...Object.values(eventCounts), 1);

  const TABS = [
    { id: "overview", label: "📊 Overview" },
    { id: "funnel", label: "🔽 Funnel" },
    { id: "races", label: "🏃 Carreras" },
    { id: "events", label: "📋 Eventos" },
    { id: "users", label: "👥 Usuarios" },
  ];

  if (loading) return (
    <div style={{ padding: 60, textAlign: "center" }}>
      <div style={{
        width: 36, height: 36, border: "3px solid #2a2a2a", borderTopColor: "#FF4500",
        borderRadius: "50%", animation: "sp .8s linear infinite", margin: "0 auto 14px",
      }} />
      <div style={{ color: "#555", fontSize: ".9rem" }}>Cargando analytics...</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px", fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: ".72rem", color: "#FF4500", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
            Panel del autor
          </div>
          <h1 style={{ fontFamily: "'Anton', sans-serif", fontSize: "2.2rem", lineHeight: 1, margin: 0 }}>
            PACEAI <span style={{ color: "#FF4500" }}>ANALYTICS</span>
          </h1>
          <div style={{ color: "#555", fontSize: ".8rem", marginTop: 4 }}>
            {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
        <button
          onClick={loadData}
          disabled={refreshing}
          style={{
            background: refreshing ? "#1a1a1a" : "rgba(255,69,0,.12)",
            border: "1px solid rgba(255,69,0,.3)",
            color: refreshing ? "#555" : "#FF4500",
            padding: "8px 18px",
            borderRadius: 8,
            cursor: refreshing ? "not-allowed" : "pointer",
            fontWeight: 700,
            fontSize: ".82rem",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {refreshing ? "Actualizando..." : "↻ Actualizar"}
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 28 }}>
        <KpiCard icon="👥" label="Usuarios únicos" value={uniqueUsers || users.length} sub="con actividad registrada" color="#3b82f6" />
        <KpiCard icon="📋" label="Eventos totales" value={totalEvents} sub={`${last24h} en las últimas 24h`} color="#FF4500" />
        <KpiCard icon="🤖" label="Planes generados" value={plansGenerated} sub={`${conversionRate}% de los clicks`} color="#22c55e" />
        <KpiCard icon="💳" label="Suscripciones activas" value={activeSubs} sub={revenue > 0 ? `ARS ${revenue.toLocaleString()} MRR` : "sin pagos aún"} color="#FFD700" />
        <KpiCard icon="❌" label="Errores de plan" value={eventCounts["plan_error"] || 0} sub="al generar con IA" color="#ef4444" />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "7px 16px",
            borderRadius: 7,
            border: "1px solid",
            borderColor: tab === t.id ? "#FF4500" : "#2a2a2a",
            background: tab === t.id ? "rgba(255,69,0,.12)" : "transparent",
            color: tab === t.id ? "#FF4500" : "#888",
            fontWeight: 700,
            fontSize: ".8rem",
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Overview ── */}
      {tab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: ".72rem", color: "#FF4500", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>
              Pantallas más visitadas
            </div>
            {Object.entries(viewCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([view, count]) => (
              <MiniBar key={view} label={view} value={count} max={maxViewCount} color="#3b82f6" />
            ))}
            {Object.keys(viewCounts).length === 0 && <div style={{ color: "#444", fontSize: ".82rem" }}>Sin datos aún</div>}
          </div>

          <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: ".72rem", color: "#FF4500", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>
              Eventos por tipo
            </div>
            {Object.entries(eventCounts).sort((a, b) => b[1] - a[1]).map(([evt, count]) => (
              <MiniBar key={evt} label={evt.replace(/_/g, " ")} value={count} max={maxEventCount} color="#FF4500" />
            ))}
            {Object.keys(eventCounts).length === 0 && <div style={{ color: "#444", fontSize: ".82rem" }}>Sin datos aún</div>}
          </div>
        </div>
      )}

      {/* ── TAB: Funnel ── */}
      {tab === "funnel" && (
        <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: 24, maxWidth: 540 }}>
          <div style={{ fontSize: ".72rem", color: "#FF4500", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 20 }}>
            Funnel de conversión
          </div>
          {[
            { label: "Usuarios únicos", value: uniqueUsers || users.length, color: "#3b82f6" },
            { label: "Clicks en generar plan", value: eventCounts["generate_click"] || 0, color: "#8b5cf6" },
            { label: "Planes generados", value: plansGenerated, color: "#22c55e" },
            { label: "Análisis post-carrera", value: eventCounts["plan_recalibrated"] || 0, color: "#f59e0b" },
            { label: "Suscripciones activas", value: activeSubs, color: "#FFD700" },
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

      {/* ── TAB: Carreras ── */}
      {tab === "races" && (
        <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: ".72rem", color: "#FF4500", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 18 }}>
            Carreras más elegidas
          </div>
          {topRaces.length === 0 ? (
            <div style={{ color: "#444", fontSize: ".85rem" }}>Sin datos de carreras aún.</div>
          ) : (
            topRaces.map(([name, count], i) => (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: i === 0 ? "#FFD700" : i === 1 ? "#aaa" : i === 2 ? "#cd7f32" : "#2a2a2a",
                  color: i < 3 ? "#000" : "#666",
                  fontWeight: 900, fontSize: ".8rem",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: ".85rem", color: "#ccc", marginBottom: 4 }}>{name}</div>
                  <div style={{ height: 5, background: "#1a1a1a", borderRadius: 3 }}>
                    <div style={{
                      height: "100%",
                      width: `${(count / maxRaceCount) * 100}%`,
                      background: "#FF4500",
                      borderRadius: 3,
                    }} />
                  </div>
                </div>
                <div style={{ fontFamily: "'Anton', sans-serif", fontSize: "1.2rem", color: "#FF4500", minWidth: 30, textAlign: "right" }}>
                  {count}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── TAB: Eventos ── */}
      {tab === "events" && (
        <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: ".72rem", color: "#FF4500", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Últimos {Math.min(events.length, 50)} eventos
            </div>
            <div style={{ fontSize: ".78rem", color: "#555" }}>{events.length} total</div>
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "120px 160px 1fr",
            gap: 10,
            padding: "6px 0",
            marginBottom: 6,
            borderBottom: "1px solid #2a2a2a",
          }}>
            {["Fecha", "Evento", "Contexto"].map(h => (
              <span key={h} style={{ fontSize: ".68rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</span>
            ))}
          </div>
          <div style={{ maxHeight: 480, overflowY: "auto" }}>
            {events.slice(0, 50).map((e, i) => <EventRow key={i} event={e} />)}
            {events.length === 0 && (
              <div style={{ color: "#444", fontSize: ".85rem", padding: "20px 0" }}>
                Sin eventos aún. Los eventos se registran cuando los usuarios usan la app.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: Usuarios ── */}
      {tab === "users" && (
        <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: ".72rem", color: "#FF4500", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 18 }}>
            Perfiles de usuarios ({users.length})
          </div>
          {users.length === 0 ? (
            <div style={{ color: "#444", fontSize: ".85rem" }}>Sin usuarios registrados con perfil aún.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {users.map((u, i) => (
                <div key={i} style={{
                  background: "#0d0d0d",
                  border: "1px solid #1a1a1a",
                  borderRadius: 8,
                  padding: "12px 16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: ".88rem" }}>{u.name || "Sin nombre"}</div>
                    <div style={{ color: "#555", fontSize: ".78rem" }}>
                      {u.level || "—"} · {u.age ? `${u.age} años` : ""} · {u.weight ? `${u.weight}kg` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {u.level && (
                      <span style={{
                        padding: "2px 10px", borderRadius: 20, fontSize: ".72rem", fontWeight: 700,
                        background: u.level === "avanzado" ? "rgba(255,69,0,.15)" : u.level === "moderado" ? "rgba(245,158,11,.1)" : "rgba(34,197,94,.1)",
                        color: u.level === "avanzado" ? "#FF4500" : u.level === "moderado" ? "#f59e0b" : "#22c55e",
                      }}>
                        {u.level}
                      </span>
                    )}
                    {u.days && <span style={{ color: "#555", fontSize: ".78rem" }}>{u.days} días/sem</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Nota de implementación */}
      <div style={{
        marginTop: 28,
        padding: "14px 18px",
        background: "rgba(59,130,246,.05)",
        border: "1px solid rgba(59,130,246,.15)",
        borderRadius: 10,
        fontSize: ".78rem",
        color: "#555",
        lineHeight: 1.6,
      }}>
        <strong style={{ color: "#3b82f6" }}>Nota:</strong> Para que este panel vea todos los usuarios,
        trackEvent() debe escribir también en <code style={{ color: "#888" }}>analytics_global</code> con el
        campo <code style={{ color: "#888" }}>userId</code>. Ver instrucciones en el README.
      </div>
    </div>
  );
}