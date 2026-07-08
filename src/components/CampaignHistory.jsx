import { useState, useEffect, useCallback } from "react";
import { fbList, fbDelete } from "../firebase";

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

export default function CampaignHistory({ user }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState("todas");
  const [deleting, setDeleting] = useState(null);

  const loadCampaigns = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    try {
      const data = await fbList(`marketing_campaigns_${user.uid}`, user.token);
      // Ordenar por fecha desc
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

  const togglePost = (campaignId, postIdx) => {
    const key = `${campaignId}_${postIdx}`;
    setExpanded(prev => prev === key ? null : key);
  };

  const redes = [...new Set(campaigns.map(c => c.red).filter(Boolean))];
  const filtradas = filter === "todas" ? campaigns : campaigns.filter(c => c.red === filter);

  if (loading) return <div style={{ padding: 48, textAlign: "center", color: "#555" }}>Cargando campañas…</div>;

  if (campaigns.length === 0) return (
    <div style={{ padding: 48, textAlign: "center" }}>
      <div style={{ fontSize: "2rem", marginBottom: 12 }}>📭</div>
      <div style={{ color: "#555", fontSize: ".9rem" }}>No hay campañas guardadas todavía.</div>
      <div style={{ color: "#333", fontSize: ".8rem", marginTop: 6 }}>Generá una campaña en la tab de Marketing y guardála.</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header + filtros */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: ".72rem", color: "#FF4500", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          📁 {campaigns.length} campaña{campaigns.length !== 1 ? "s" : ""} guardada{campaigns.length !== 1 ? "s" : ""}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
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

      {/* Lista de campañas */}
      {filtradas.map(campaign => {
        const posts = (() => { try { return JSON.parse(campaign.posts || "[]"); } catch { return []; } })();
        const utmLinks = (() => { try { return JSON.parse(campaign.utm_links || "[]"); } catch { return []; } })();
        const redColor = RED_COLORS[campaign.red] || "#FF4500";
        const publishedPosts = (() => { try { return JSON.parse(campaign.published_posts || "[]"); } catch { return []; } })();

        return (
          <div key={campaign.id} style={{ background: "#111", border: `1px solid ${redColor}22`, borderRadius: 12, overflow: "hidden" }}>
            {/* Campaign header */}
            <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: "1.1rem" }}>{RED_EMOJIS[campaign.red] || "📣"}</span>
                  <span style={{ fontFamily: "'Anton', sans-serif", fontSize: "1.1rem", color: redColor }}>
                    {campaign.titulo || "Campaña sin título"}
                  </span>
                  <span style={{ fontSize: ".68rem", color: "#444", background: "#1a1a1a", padding: "2px 8px", borderRadius: 20 }}>
                    {campaign.distancia}
                  </span>
                </div>
                <div style={{ color: "#666", fontSize: ".78rem" }}>{campaign.concepto}</div>
                <div style={{ color: "#333", fontSize: ".7rem", marginTop: 4 }}>
                  {new Date(campaign.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {" · "}{posts.length} posts
                  {publishedPosts.length > 0 && (
                    <span style={{ color: "#22c55e" }}> · {publishedPosts.length} publicados</span>
                  )}
                </div>
              </div>
              <button onClick={() => handleDelete(campaign.id)} disabled={deleting === campaign.id} style={{
                background: "transparent", border: "1px solid #2a2a2a", color: "#444",
                padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: ".72rem",
                fontFamily: "'DM Sans', sans-serif",
              }}>
                {deleting === campaign.id ? "⟳" : "🗑"}
              </button>
            </div>

            {/* Posts */}
            <div style={{ borderTop: "1px solid #1a1a1a" }}>
              {posts.map((post, idx) => {
                const key = `${campaign.id}_${idx}`;
                const isOpen = expanded === key;
                const isPublished = publishedPosts.includes(idx);

                return (
                  <div key={idx} style={{ borderBottom: "1px solid #1a1a1a" }}>
                    {/* Post row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", cursor: "pointer" }}
                      onClick={() => togglePost(campaign.id, idx)}>
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
                        background: isPublished ? "rgba(34,197,94,.1)" : "rgba(255,69,0,.05)",
                        border: `1px solid ${isPublished ? "rgba(34,197,94,.3)" : "rgba(255,69,0,.15)"}`,
                        color: isPublished ? "#22c55e" : "#555",
                      }}>
                        {isPublished ? "✓ Publicado" : "Pendiente"}
                      </span>
                      <span style={{ color: "#333", fontSize: ".8rem" }}>{isOpen ? "▲" : "▼"}</span>
                    </div>

                    {/* Post expandido */}
                    {isOpen && (
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
                        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                          <CopyBtn text={`${post.texto}\n\n${post.hashtags || ""}`} />
                          <MarkPublishedBtn
                            isPublished={isPublished}
                            onToggle={async () => {
                              const { fbSet } = await import("../firebase");
                              const newPublished = isPublished
                                ? publishedPosts.filter(i => i !== idx)
                                : [...publishedPosts, idx];
                              await fbSet(`marketing_campaigns_${user.uid}`, campaign.id, {
                                ...campaign,
                                published_posts: JSON.stringify(newPublished),
                              }, user.token);
                              setCampaigns(prev => prev.map(c => c.id === campaign.id
                                ? { ...c, published_posts: JSON.stringify(newPublished) }
                                : c
                              ));
                            }}
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
                    <span style={{ fontSize: ".72rem", color: "#666", minWidth: 100 }}>{link.label}</span>
                    <code style={{ fontSize: ".68rem", color: "#333", flex: 1, wordBreak: "break-all" }}>{link.url}</code>
                    <CopyBtn text={link.url} />
                  </div>
                ))}
              </div>
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