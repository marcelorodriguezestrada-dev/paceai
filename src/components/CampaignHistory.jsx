import { useState, useEffect, useCallback } from "react";
import { fbList, fbDelete, fbSet, FB } from "../firebase";

const RED_COLORS = {
  instagram: "#E1306C",
  facebook:  "#1877F2",
  tiktok:    "#69C9D0",
  whatsapp:  "#25D366",
};

const RED_EMOJIS = {
  instagram: "📸",
  facebook:  "👥",
  tiktok:    "🎵",
  whatsapp:  "💬",
};

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }} style={{
      background: copied ? "rgba(34,197,94,.15)" : "rgba(255,69,0,.1)",
      border: `1px solid ${copied ? "rgba(34,197,94,.4)" : "rgba(255,69,0,.3)"}`,
      color: copied ? "#22c55e" : "#FF4500",
      padding: "3px 10px", borderRadius: 6, cursor: "pointer",
      fontSize: ".7rem", fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
      flexShrink: 0, transition: ".15s",
    }}>
      {copied ? "✓" : "Copiar"}
    </button>
  );
}

// Carga métricas de analytics_global filtradas por utm_campaign
async function loadCampaignMetrics(campaignKey, token) {
  try {
    const FS_URL = `https://firestore.googleapis.com/v1/projects/${FB.projectId}/databases/(default)/documents`;

    // Query analytics_global donde utm_campaign == campaignKey
    const res = await fetch(`${FS_URL}:runQuery?key=${FB.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "analytics_global" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "utm_campaign" },
              op: "EQUAL",
              value: { stringValue: campaignKey },
            },
          },
          limit: 500,
        },
      }),
    });

    const data = await res.json();
    const docs = (data || [])
      .filter(d => d.document)
      .map(d => {
        const fields = d.document.fields || {};
        const get = (k) => {
          const f = fields[k];
          return f?.stringValue ?? f?.doubleValue ?? f?.integerValue ?? null;
        };
        return {
          event: get("event"),
          utm_content: get("utm_content"),
          utm_medium: get("utm_medium"),
          userId: get("userId"),
          ts: get("ts"),
        };
      });

    // Calcular métricas
    const clicks = docs.filter(d => d.event === "page_view").length;
    const planEvents = docs.filter(d => d.event === "plan_generated");
    const plans = planEvents.length;
    const uniqueUsers = new Set(docs.map(d => d.userId).filter(Boolean)).size;
    const conversion = clicks > 0 ? ((plans / clicks) * 100).toFixed(1) : "0";

    // Clicks por post (utm_content)
    const byPost = {};
    docs.forEach(d => {
      if (d.utm_content && d.utm_content !== "ninguno") {
        byPost[d.utm_content] = (byPost[d.utm_content] || 0) + 1;
      }
    });
    const topPost = Object.entries(byPost).sort((a, b) => b[1] - a[1])[0];

    // Por medio (post vs bio vs story)
    const byMedium = {};
    docs.forEach(d => {
      if (d.utm_medium) byMedium[d.utm_medium] = (byMedium[d.utm_medium] || 0) + 1;
    });

    return { clicks, plans, uniqueUsers, conversion, topPost, byPost, byMedium, total: docs.length };
  } catch (e) {
    console.error("Error loading metrics:", e);
    return null;
  }
}

function MetricsPanel({ campaignKey, token, redColor }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCampaignMetrics(campaignKey, token)
      .then(setMetrics)
      .finally(() => setLoading(false));
  }, [campaignKey, token]);

  if (loading) return (
    <div style={{ padding: "16px 20px", borderTop: "1px solid #1a1a1a", color: "#444", fontSize: ".8rem" }}>
      ⟳ Cargando métricas…
    </div>
  );

  if (!metrics || metrics.total === 0) return (
    <div style={{ padding: "16px 20px", borderTop: "1px solid #1a1a1a" }}>
      <div style={{ color: "#333", fontSize: ".8rem" }}>
        📊 Todavía no hay clicks registrados para esta campaña.
        <div style={{ marginTop: 4, color: "#2a2a2a", fontSize: ".72rem" }}>
          Los datos aparecen cuando alguien hace click en el link UTM de la campaña.
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: "16px 20px", borderTop: "1px solid #1a1a1a", background: "#0a0a0a" }}>
      <div style={{ fontSize: ".68rem", color: redColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 14 }}>
        📊 Métricas reales de esta campaña
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Clicks", value: metrics.clicks, color: redColor },
          { label: "Usuarios únicos", value: metrics.uniqueUsers, color: "#4fc3f7" },
          { label: "Planes generados", value: metrics.plans, color: "#00ff88" },
          { label: "Conversión", value: `${metrics.conversion}%`, color: "#ffd54f" },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
            <div style={{ fontSize: ".68rem", color: "#444", marginTop: 4 }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Top post */}
      {metrics.topPost && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: ".68rem", color: "#444", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>
            🏆 Post con más engagement
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#111", border: `1px solid ${redColor}22`, borderRadius: 8, padding: "8px 14px" }}>
            <span style={{ color: redColor, fontWeight: 700, fontSize: ".85rem" }}>{metrics.topPost[0]}</span>
            <span style={{ color: "#555", fontSize: ".78rem" }}>{metrics.topPost[1]} clicks</span>
          </div>
        </div>
      )}

      {/* Por post breakdown */}
      {Object.keys(metrics.byPost).length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: ".68rem", color: "#444", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>
            Clicks por post
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {Object.entries(metrics.byPost).sort((a, b) => b[1] - a[1]).map(([post, count]) => {
              const max = Math.max(...Object.values(metrics.byPost));
              return (
                <div key={post} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: ".72rem", color: "#666", minWidth: 80 }}>{post}</span>
                  <div style={{ flex: 1, background: "#1a1a1a", borderRadius: 4, height: 6, overflow: "hidden" }}>
                    <div style={{ width: `${(count / max) * 100}%`, background: redColor, height: "100%", borderRadius: 4, transition: "width .5s" }} />
                  </div>
                  <span style={{ fontSize: ".72rem", color: "#555", minWidth: 30, textAlign: "right" }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Por medio */}
      {Object.keys(metrics.byMedium).length > 0 && (
        <div>
          <div style={{ fontSize: ".68rem", color: "#444", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>
            Por medio
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(metrics.byMedium).map(([medium, count]) => (
              <span key={medium} style={{ fontSize: ".72rem", padding: "3px 10px", borderRadius: 20, background: "#111", border: "1px solid #2a2a2a", color: "#666" }}>
                {medium}: {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CampaignHistory({ user }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCampaign, setExpandedCampaign] = useState(null);
  const [expandedPost, setExpandedPost] = useState(null);
  const [filter, setFilter] = useState("todas");
  const [deleting, setDeleting] = useState(null);

  const loadCampaigns = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    try {
      const data = await fbList(`marketing_campaigns_${user.uid}`, user.token);
      data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setCampaigns(data);
    } catch (e) {
      console.error("Error cargando campañas:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  const handleDelete = async (id) => {
    if (!confirm("¿Borrar esta campaña?")) return;
    setDeleting(id);
    try {
      await fbDelete(`marketing_campaigns_${user.uid}`, id, user.token);
      setCampaigns(prev => prev.filter(c => c.id !== id));
    } catch (e) { alert("Error: " + e.message); }
    finally { setDeleting(null); }
  };

  const toggleMarkPublished = async (campaign, postIdx) => {
    const published = (() => { try { return JSON.parse(campaign.published_posts || "[]"); } catch { return []; } })();
    const newPublished = published.includes(postIdx)
      ? published.filter(i => i !== postIdx)
      : [...published, postIdx];
    await fbSet(`marketing_campaigns_${user.uid}`, campaign.id, {
      ...campaign,
      published_posts: JSON.stringify(newPublished),
    }, user.token);
    setCampaigns(prev => prev.map(c => c.id === campaign.id
      ? { ...c, published_posts: JSON.stringify(newPublished) } : c
    ));
  };

  const redes = [...new Set(campaigns.map(c => c.red).filter(Boolean))];
  const filtradas = filter === "todas" ? campaigns : campaigns.filter(c => c.red === filter);

  if (loading) return <div style={{ padding: 48, textAlign: "center", color: "#555" }}>Cargando campañas…</div>;

  if (campaigns.length === 0) return (
    <div style={{ padding: 48, textAlign: "center" }}>
      <div style={{ fontSize: "2rem", marginBottom: 12 }}>📭</div>
      <div style={{ color: "#555", fontSize: ".9rem" }}>No hay campañas guardadas todavía.</div>
      <div style={{ color: "#333", fontSize: ".8rem", marginTop: 6 }}>Generá una campaña en Marketing y guardála con 💾</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header + filtros */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: ".72rem", color: "#FF4500", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          📁 {campaigns.length} campaña{campaigns.length !== 1 ? "s" : ""} guardada{campaigns.length !== 1 ? "s" : ""}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["todas", ...redes].map(r => (
            <button key={r} onClick={() => setFilter(r)} style={{
              padding: "4px 12px", borderRadius: 20, fontSize: ".72rem", fontWeight: 700,
              fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
              border: `1px solid ${filter === r ? (RED_COLORS[r] || "#FF4500") : "#2a2a2a"}`,
              background: filter === r ? `${RED_COLORS[r] || "#FF4500"}18` : "transparent",
              color: filter === r ? (RED_COLORS[r] || "#FF4500") : "#555",
            }}>
              {r === "todas" ? "Todas" : `${RED_EMOJIS[r] || ""} ${r}`}
            </button>
          ))}
        </div>
      </div>

      {filtradas.map(campaign => {
        const posts = (() => { try { return JSON.parse(campaign.posts || "[]"); } catch { return []; } })();
        const utmLinks = (() => { try { return JSON.parse(campaign.utm_links || "[]"); } catch { return []; } })();
        const publishedPosts = (() => { try { return JSON.parse(campaign.published_posts || "[]"); } catch { return []; } })();
        const kpis = (() => { try { return JSON.parse(campaign.kpis || "[]"); } catch { return []; } })();
        const redColor = RED_COLORS[campaign.red] || "#FF4500";
        const isExpanded = expandedCampaign === campaign.id;

        // Key para buscar en analytics — usar el valor del utm_campaign que se generó
        const campaignKey = campaign.distancia?.toLowerCase().replace(/\s+/g, '_') || campaign.id;

        return (
          <div key={campaign.id} style={{ background: "#111", border: `1px solid ${redColor}22`, borderRadius: 12, overflow: "hidden" }}>
            {/* Campaign header */}
            <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
              <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setExpandedCampaign(isExpanded ? null : campaign.id)}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: "1.1rem" }}>{RED_EMOJIS[campaign.red] || "📣"}</span>
                  <span style={{ fontFamily: "'Anton', sans-serif", fontSize: "1.1rem", color: redColor }}>
                    {campaign.titulo || "Campaña sin título"}
                  </span>
                  <span style={{ fontSize: ".68rem", color: "#444", background: "#1a1a1a", padding: "2px 8px", borderRadius: 20 }}>
                    {campaign.distancia}
                  </span>
                  <span style={{ fontSize: ".68rem", color: "#555", background: "#1a1a1a", padding: "2px 8px", borderRadius: 20 }}>
                    {campaign.objetivo}
                  </span>
                </div>
                <div style={{ color: "#666", fontSize: ".78rem" }}>{campaign.concepto}</div>
                <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                  <span style={{ color: "#333", fontSize: ".7rem" }}>
                    {new Date(campaign.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                  <span style={{ color: "#333", fontSize: ".7rem" }}>· {posts.length} posts</span>
                  {publishedPosts.length > 0 && (
                    <span style={{ color: "#22c55e", fontSize: ".7rem" }}>· {publishedPosts.length} publicados</span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: "#333", fontSize: ".85rem", cursor: "pointer" }} onClick={() => setExpandedCampaign(isExpanded ? null : campaign.id)}>
                  {isExpanded ? "▲" : "▼"}
                </span>
                <button onClick={() => handleDelete(campaign.id)} disabled={deleting === campaign.id} style={{
                  background: "transparent", border: "1px solid #2a2a2a", color: "#444",
                  padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: ".72rem",
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  {deleting === campaign.id ? "⟳" : "🗑"}
                </button>
              </div>
            </div>

            {/* KPIs esperados */}
            {kpis.length > 0 && (
              <div style={{ padding: "8px 20px", borderTop: "1px solid #1a1a1a", display: "flex", gap: 8, flexWrap: "wrap" }}>
                {kpis.map((k, i) => (
                  <span key={i} style={{ fontSize: ".68rem", padding: "2px 10px", borderRadius: 20, background: `${redColor}10`, border: `1px solid ${redColor}22`, color: redColor }}>
                    {k}
                  </span>
                ))}
              </div>
            )}

            {isExpanded && (
              <>
                {/* Métricas reales */}
                <MetricsPanel campaignKey={campaignKey} token={user.token} redColor={redColor} />

                {/* Posts */}
                <div style={{ borderTop: "1px solid #1a1a1a" }}>
                  <div style={{ padding: "12px 20px 8px", fontSize: ".68rem", color: "#444", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em" }}>
                    📝 Posts de la campaña
                  </div>
                  {posts.map((post, idx) => {
                    const postKey = `${campaign.id}_${idx}`;
                    const isPostOpen = expandedPost === postKey;
                    const isPublished = publishedPosts.includes(idx);

                    return (
                      <div key={idx} style={{ borderTop: "1px solid #1a1a1a" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", cursor: "pointer" }}
                          onClick={() => setExpandedPost(isPostOpen ? null : postKey)}>
                          <span style={{ fontSize: ".68rem", color: "#444", minWidth: 50 }}>Post {idx + 1}</span>
                          <span style={{ fontSize: ".72rem", color: "#555", background: "#1a1a1a", padding: "2px 8px", borderRadius: 20 }}>
                            {post.formato || "Feed"}
                          </span>
                          <span style={{ flex: 1, fontSize: ".8rem", color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {post.texto?.slice(0, 80)}…
                          </span>
                          {post.hora_optima && (
                            <span style={{ fontSize: ".68rem", color: "#444" }}>🕐 {post.hora_optima}</span>
                          )}
                          <span style={{
                            fontSize: ".68rem", padding: "2px 8px", borderRadius: 20,
                            background: isPublished ? "rgba(34,197,94,.1)" : "rgba(255,255,255,.03)",
                            border: `1px solid ${isPublished ? "rgba(34,197,94,.3)" : "#1a1a1a"}`,
                            color: isPublished ? "#22c55e" : "#333",
                          }}>
                            {isPublished ? "✓ Publicado" : "Pendiente"}
                          </span>
                          <span style={{ color: "#333", fontSize: ".8rem" }}>{isPostOpen ? "▲" : "▼"}</span>
                        </div>

                        {isPostOpen && (
                          <div style={{ padding: "12px 20px 16px", background: "#0d0d0d", display: "flex", flexDirection: "column", gap: 10 }}>
                            <div style={{ fontSize: ".85rem", color: "#ccc", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                              {post.texto}
                            </div>
                            {post.hashtags && (
                              <div style={{ fontSize: ".78rem", color: redColor }}>{post.hashtags}</div>
                            )}
                            {post.cta && (
                              <div style={{ fontSize: ".75rem", color: "#666", background: "#111", border: "1px solid #1a1a1a", borderRadius: 6, padding: "6px 10px" }}>
                                CTA: {post.cta}
                              </div>
                            )}
                            {post.tip_visual && (
                              <div style={{ fontSize: ".72rem", color: "#444" }}>🎨 Visual: {post.tip_visual}</div>
                            )}
                            <div style={{ display: "flex", gap: 8 }}>
                              <CopyBtn text={`${post.texto}\n\n${post.hashtags || ""}`} />
                              <MarkPublishedBtn
                                isPublished={isPublished}
                                onToggle={() => toggleMarkPublished(campaign, idx)}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* UTM Links */}
                {utmLinks.length > 0 && (
                  <div style={{ padding: "12px 20px", borderTop: "1px solid #1a1a1a", background: "#0a0a0a" }}>
                    <div style={{ fontSize: ".68rem", color: "#444", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>
                      🔗 UTM Links
                    </div>
                    {utmLinks.map((link, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: ".72rem", color: "#666", minWidth: 120 }}>{link.label}</span>
                        <code style={{ fontSize: ".68rem", color: "#333", flex: 1, wordBreak: "break-all" }}>{link.url}</code>
                        <CopyBtn text={link.url} />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MarkPublishedBtn({ isPublished, onToggle }) {
  const [loading, setLoading] = useState(false);
  return (
    <button onClick={async () => { setLoading(true); await onToggle(); setLoading(false); }} style={{
      background: isPublished ? "rgba(34,197,94,.1)" : "rgba(255,69,0,.1)",
      border: `1px solid ${isPublished ? "rgba(34,197,94,.3)" : "rgba(255,69,0,.2)"}`,
      color: isPublished ? "#22c55e" : "#FF4500",
      padding: "3px 10px", borderRadius: 6, cursor: "pointer",
      fontSize: ".7rem", fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
    }}>
      {loading ? "⟳" : isPublished ? "✓ Publicado" : "Marcar publicado"}
    </button>
  );
}