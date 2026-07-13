import { useState, useEffect } from "react";
import { fbSet } from "../firebase";

const STORAGE_KEY = "paceai_marketing_draft";

function loadDraft() {
  try {
    const d = sessionStorage.getItem(STORAGE_KEY);
    return d ? JSON.parse(d) : null;
  } catch { return null; }
}

function saveDraft(form, campaign) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ form, campaign }));
  } catch {}
}

const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY;
const BASE_URL = "https://paceia.ezeti.pro";

const REDES = [
  { id: "instagram", label: "Instagram", color: "#E1306C", emoji: "📸" },
  { id: "facebook",  label: "Facebook",  color: "#1877F2", emoji: "👥" },
  { id: "tiktok",    label: "TikTok",    color: "#69C9D0", emoji: "🎵" },
  { id: "whatsapp",  label: "WhatsApp",  color: "#25D366", emoji: "💬" },
];

const DISTANCIAS = ["5K", "10K", "Medio maratón (21K)", "Maratón (42K)", "Trail", "Otra"];
const OBJETIVOS  = ["Conseguir inscripciones", "Generar awareness de PaceAI", "Promoción especial", "Lanzamiento de feature"];
const TONOS      = ["Motivacional", "Técnico/datos", "Humor corredor", "Emocional/historia"];

async function callGroq(prompt) {
  const res = await fetch(GROQ_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 2000,
      messages: [
        {
          role: "system",
          content: `Sos un experto en marketing digital para running y apps fitness en Argentina.
Creás contenido para redes sociales en español rioplatense, cercano, auténtico y que genere engagement.
Respondés SOLO con JSON válido, sin markdown, sin texto extra.`,
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Groq error ${res.status}`);
  const d = await res.json();
  return d.choices[0].message.content;
}

function CopyBtn({ text, small }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} style={{
      background: copied ? "rgba(34,197,94,.15)" : "rgba(255,69,0,.1)",
      border: `1px solid ${copied ? "rgba(34,197,94,.4)" : "rgba(255,69,0,.3)"}`,
      color: copied ? "#22c55e" : "#FF4500",
      padding: small ? "3px 10px" : "5px 14px",
      borderRadius: 6, cursor: "pointer",
      fontSize: small ? ".7rem" : ".75rem",
      fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
      flexShrink: 0, transition: ".15s",
    }}>
      {copied ? "✓" : "Copiar"}
    </button>
  );
}

function PostCard({ post, idx, red }) {
  const color = REDES.find(r => r.id === red)?.color || "#FF4500";
  return (
    <div style={{ background: "#0d0d0d", border: `1px solid ${color}22`, borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: ".68rem", color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em" }}>
          Post {idx + 1} · {post.formato || "Feed"}
        </span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {post.hora_optima && (
            <span style={{ fontSize: ".68rem", color: "#555", background: "#1a1a1a", padding: "2px 8px", borderRadius: 20 }}>
              🕐 {post.hora_optima}
            </span>
          )}
          <CopyBtn text={`${post.texto}\n\n${post.hashtags}`} />
        </div>
      </div>
      <div style={{ fontSize: ".85rem", color: "#ccc", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
        {post.texto}
      </div>
      {post.hashtags && (
        <div style={{ fontSize: ".78rem", color: color, lineHeight: 1.6 }}>{post.hashtags}</div>
      )}
      {post.cta && (
        <div style={{ fontSize: ".75rem", color: "#888", background: "#111", border: "1px solid #1a1a1a", borderRadius: 6, padding: "6px 10px" }}>
          CTA: {post.cta}
        </div>
      )}
    </div>
  );
}

export default function MarketingTab({ topRaces = [], user }) {
  const draft = loadDraft();
  const [form, setForm] = useState(draft?.form || {
    red: "instagram",
    distancia: "21K",
    carrera: "",
    fecha: "",
    objetivo: "Conseguir inscripciones",
    tono: "Motivacional",
    oferta: "",
    cantPosts: 5,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [campaign, setCampaign] = useState(draft?.campaign || null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Persistir en sessionStorage cuando cambia form o campaign
  useEffect(() => {
    saveDraft(form, campaign);
  }, [form, campaign]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!campaign) { alert("No hay campaña para guardar"); return; }
    if (!user?.token) { alert("Error: no hay sesión activa. Cerrá sesión y volvé a entrar."); return; }
    setSaving(true);
    try {
      // Refrescar token antes de guardar
      let token = user.token;
      try {
        const session = JSON.parse(localStorage.getItem("paceai_session") || "{}");
        if (session.refreshToken) {
          const r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${import.meta.env.VITE_FB_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `grant_type=refresh_token&refresh_token=${session.refreshToken}`,
          });
          const d = await r.json();
          if (d.id_token) token = d.id_token;
        }
      } catch {}

      const id = `camp_${Date.now()}`;
      const result = await fbSet(`marketing_campaigns_${user.uid}`, id, {
        titulo: campaign.titulo_campana,
        concepto: campaign.concepto,
        publico: campaign.publico_objetivo,
        red: form.red,
        distancia: form.distancia,
        carrera: form.carrera,
        fecha: form.fecha,
        objetivo: form.objetivo,
        tono: form.tono,
        posts: JSON.stringify(campaign.posts || []),
        calendario: JSON.stringify(campaign.calendario || []),
        utm_links: JSON.stringify(campaign.utm_links || []),
        kpis: JSON.stringify(campaign.kpis || []),
        presupuesto: campaign.presupuesto_sugerido || "",
        published_posts: JSON.stringify([]),
        created_at: new Date().toISOString(),
      }, token);
      if (result?.error) throw new Error(result.error.message || JSON.stringify(result.error));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert("Error guardando campaña: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setCampaign(null);

    const redObj = REDES.find(r => r.id === form.red);

    const prompt = `Creá una campaña de ${form.cantPosts} posts para ${redObj?.label} para promocionar PaceAI (app de entrenamiento para runners) en Argentina.

CONTEXTO DE LA CAMPAÑA:
- Objetivo: ${form.objetivo}
- Red social: ${redObj?.label}
- Distancia/tipo de carrera: ${form.distancia}
${form.carrera ? `- Carrera específica: ${form.carrera}` : ""}
${form.fecha ? `- Fecha de la carrera: ${form.fecha}` : ""}
- Tono: ${form.tono}
${form.oferta ? `- Oferta especial: ${form.oferta}` : ""}

SOBRE PACEAI:
PaceAI es una app gratuita que genera planes de entrenamiento personalizados para carreras de running usando IA.
Disponible en paceia.ezeti.pro
URL con tracking: ${BASE_URL}?utm_source=${form.red}&utm_medium=post&utm_campaign=${form.distancia.toLowerCase().replace(/\s+/g, '_')}

REGLA OBLIGATORIA según red social:
- Si es INSTAGRAM: el campo "texto" DEBE terminar con "👆 Link en bio para entrenar gratis" (NO poner URL en el texto)
- Si es FACEBOOK o WHATSAPP: el campo "texto" DEBE terminar con el link completo "👉 paceia.ezeti.pro?utm_source=${form.red}&utm_medium=post&utm_campaign=${form.distancia.toLowerCase().replace(/\s+/g, '_')}&utm_content=post_[NUMERO_DEL_POST]"
- Si es TIKTOK: el campo "texto" DEBE terminar con "👆 Link en bio" (NO poner URL)
Red actual: ${form.red}. Aplicar la regla correspondiente. Sin excepción.

Respondé ÚNICAMENTE con este JSON:
{
  "titulo_campana": "nombre corto de la campaña",
  "concepto": "idea central de la campaña en 1 oración",
  "publico_objetivo": "descripción del público al que apunta",
  "posts": [
    {
      "formato": "Feed|Story|Reel|Carrusel",
      "texto": "copy completo del post listo para publicar con emojis en español rioplatense. SIEMPRE terminar con el link 👉 paceia.ezeti.pro",
      "hashtags": "#hashtag1 #hashtag2 ...",
      "cta": "llamada a la acción específica",
      "hora_optima": "HH:MM",
      "tip_visual": "descripción breve de qué imagen/video usar"
    }
  ],
  "calendario": [
    { "dia": 1, "post_idx": 0, "nota": "por qué este día" }
  ],
  "utm_links": [
    { "label": "nombre del link", "url": "URL completa con UTM" }
  ],
  "kpis": ["KPI 1 a medir", "KPI 2"],
  "presupuesto_sugerido": "rango sugerido para ads pagos si aplica"
}`;

    try {
      const raw = await callGroq(prompt);
      const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
      const data = JSON.parse(cleaned);
      setCampaign(data);
    } catch (e) {
      setError("Error generando campaña: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const redObj = REDES.find(r => r.id === form.red);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Formulario */}
      <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: 24 }}>
        <div style={{ fontSize: ".72rem", color: "#FF4500", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 20 }}>
          🤖 Generador de campañas con Groq
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
          {/* Red social */}
          <div>
            <div style={lbl}>Red social</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {REDES.map(r => (
                <button key={r.id} onClick={() => set("red", r.id)} style={{
                  padding: "6px 12px", borderRadius: 8, border: `1px solid ${form.red === r.id ? r.color : "#2a2a2a"}`,
                  background: form.red === r.id ? `${r.color}18` : "transparent",
                  color: form.red === r.id ? r.color : "#555",
                  cursor: "pointer", fontSize: ".8rem", fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
                }}>
                  {r.emoji} {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Distancia */}
          <div>
            <div style={lbl}>Distancia / tipo</div>
            <select value={form.distancia} onChange={e => set("distancia", e.target.value)} style={sel}>
              {DISTANCIAS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Objetivo */}
          <div>
            <div style={lbl}>Objetivo</div>
            <select value={form.objetivo} onChange={e => set("objetivo", e.target.value)} style={sel}>
              {OBJETIVOS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 120px", gap: 16, marginBottom: 20 }}>
          {/* Carrera */}
          <div>
            <div style={lbl}>Carrera (opcional)</div>
            <input
              value={form.carrera}
              onChange={e => set("carrera", e.target.value)}
              placeholder={topRaces[0] ? topRaces[0][0] : "ej. Maratón de Buenos Aires"}
              style={inp}
            />
          </div>

          {/* Fecha */}
          <div>
            <div style={lbl}>Fecha de la carrera</div>
            <input type="date" value={form.fecha} onChange={e => set("fecha", e.target.value)} style={inp} />
          </div>

          {/* Tono */}
          <div>
            <div style={lbl}>Tono</div>
            <select value={form.tono} onChange={e => set("tono", e.target.value)} style={sel}>
              {TONOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Cantidad */}
          <div>
            <div style={lbl}>Cant. posts</div>
            <select value={form.cantPosts} onChange={e => set("cantPosts", Number(e.target.value))} style={sel}>
              {[3, 5, 7, 10].map(n => <option key={n} value={n}>{n} posts</option>)}
            </select>
          </div>
        </div>

        {/* Oferta especial */}
        <div style={{ marginBottom: 20 }}>
          <div style={lbl}>Oferta especial (opcional)</div>
          <input
            value={form.oferta}
            onChange={e => set("oferta", e.target.value)}
            placeholder="ej. 30 días gratis para los primeros 100 inscriptos"
            style={{ ...inp, width: "100%", boxSizing: "border-box" }}
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          style={{
            background: loading ? "#1a1a1a" : "#FF4500",
            border: "none", color: loading ? "#555" : "#fff",
            padding: "12px 28px", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 700, fontSize: ".9rem", fontFamily: "'DM Sans', sans-serif",
            display: "flex", alignItems: "center", gap: 10,
          }}
        >
          {loading ? (
            <>
              <div style={{ width: 16, height: 16, border: "2px solid #333", borderTopColor: "#FF4500", borderRadius: "50%", animation: "sp .8s linear infinite" }} />
              Groq está generando la campaña...
            </>
          ) : (
            `🚀 Generar campaña para ${redObj?.label}`
          )}
        </button>

        {error && (
          <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 8, color: "#ef4444", fontSize: ".82rem" }}>
            ⚠ {error}
          </div>
        )}
      </div>

      {/* Resultado */}
      {campaign && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Header campaña */}
          <div style={{ background: "#111", border: `1px solid ${redObj?.color}33`, borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontFamily: "'Anton', sans-serif", fontSize: "1.6rem", color: redObj?.color, lineHeight: 1 }}>
                  {campaign.titulo_campana}
                </div>
                <div style={{ color: "#888", fontSize: ".85rem", marginTop: 6 }}>{campaign.concepto}</div>
                <div style={{ color: "#555", fontSize: ".78rem", marginTop: 4 }}>👥 {campaign.publico_objetivo}</div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {campaign.kpis?.map((k, i) => (
                  <span key={i} style={{ fontSize: ".72rem", padding: "4px 12px", borderRadius: 20, background: "rgba(255,69,0,.1)", border: "1px solid rgba(255,69,0,.2)", color: "#FF4500" }}>
                    {k}
                  </span>
                ))}
              </div>
            </div>
            {campaign.presupuesto_sugerido && (
              <div style={{ marginTop: 12, fontSize: ".78rem", color: "#555" }}>
                💰 Presupuesto sugerido para ads: {campaign.presupuesto_sugerido}
              </div>
            )}
          </div>

          {/* Bio link para Instagram/TikTok */}
          {(form.red === "instagram" || form.red === "tiktok") && (
            <div style={{ background: "rgba(225,48,108,0.06)", border: "1px solid rgba(225,48,108,0.2)", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: ".72rem", color: "#E1306C", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                🔗 Link para tu bio de {form.red === "instagram" ? "Instagram" : "TikTok"}
              </div>
              <div style={{ fontSize: ".8rem", color: "#888", marginBottom: 12 }}>
                Poné este link en tu bio — los posts van a decir "link en bio 👆" y los usuarios hacen click acá:
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 8, padding: "10px 14px", flexWrap: "wrap" }}>
                <code style={{ color: "#4fc3f7", fontSize: ".78rem", flex: 1, wordBreak: "break-all" }}>
                  {`${BASE_URL}?utm_source=${form.red}&utm_medium=bio&utm_campaign=${form.distancia.toLowerCase().replace(/\s+/g, '_')}`}
                </code>
                <CopyBtn text={`${BASE_URL}?utm_source=${form.red}&utm_medium=bio&utm_campaign=${form.distancia.toLowerCase().replace(/\s+/g, '_')}`} />
              </div>
            </div>
          )}

          {/* Posts */}
          <div>
            <div style={{ fontSize: ".72rem", color: "#FF4500", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>
              📝 {campaign.posts?.length} posts generados
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {campaign.posts?.map((post, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <PostCard post={post} idx={i} red={form.red} />
                  {post.tip_visual && (
                    <div style={{ fontSize: ".72rem", color: "#444", paddingLeft: 8 }}>
                      🎨 Visual: {post.tip_visual}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Calendario */}
          {campaign.calendario?.length > 0 && (
            <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize: ".72rem", color: "#FF4500", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  📅 Calendario sugerido
                </div>
                <button
                  onClick={() => {
                    // Agregar todos los eventos al calendario
                    campaign.calendario.forEach((c, i) => {
                      const post = campaign.posts?.[c.post_idx || 0];
                      if (!post) return;
                      const baseDate = form.fecha ? new Date(form.fecha) : new Date();
                      baseDate.setDate(baseDate.getDate() - (30 - (c.dia || i * 3)));
                      const [h, m] = (post.hora_optima || "09:00").split(":").map(Number);
                      baseDate.setHours(h, m, 0, 0);
                      const end = new Date(baseDate.getTime() + 30 * 60000);
                      const fmt = d => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
                      const desc = [
                        post.texto,
                        post.hashtags && `\n${post.hashtags}`,
                        post.cta && `\nCTA: ${post.cta}`,
                        post.tip_visual && `\n🎨 Visual: ${post.tip_visual}`,
                        campaign.utm_links?.[0]?.url && `\n🔗 ${campaign.utm_links[0].url}`,
                      ].filter(Boolean).join("");
                      const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`📸 Post ${(c.post_idx||0)+1} — ${post.formato||"Feed"} | PaceAI ${form.distancia}`)}&dates=${fmt(baseDate)}/${fmt(end)}&details=${encodeURIComponent(desc)}`;
                      setTimeout(() => window.open(url, "_blank"), i * 300);
                    });
                  }}
                  style={{ fontSize: ".72rem", background: "rgba(66,133,244,.1)", border: "1px solid rgba(66,133,244,.3)", color: "#4285f4", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}
                >
                  📅 Agregar todos a Calendar
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {campaign.calendario.map((c, i) => {
                  const post = campaign.posts?.[c.post_idx || 0];
                  const baseDate = form.fecha ? new Date(form.fecha) : new Date();
                  baseDate.setDate(baseDate.getDate() - (30 - (c.dia || i * 3)));
                  const [h, m] = (post?.hora_optima || "09:00").split(":").map(Number);
                  baseDate.setHours(h, m, 0, 0);
                  const end = new Date(baseDate.getTime() + 30 * 60000);
                  const fmt = d => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
                  const desc = post ? [
                    post.texto,
                    post.hashtags && `\n${post.hashtags}`,
                    post.cta && `\nCTA: ${post.cta}`,
                    post.tip_visual && `\n🎨 Visual: ${post.tip_visual}`,
                    campaign.utm_links?.[0]?.url && `\n🔗 ${campaign.utm_links[0].url}`,
                  ].filter(Boolean).join("") : "";
                  const calUrl = post ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`📸 Post ${(c.post_idx||0)+1} — ${post.formato||"Feed"} | PaceAI ${form.distancia}`)}&dates=${fmt(baseDate)}/${fmt(end)}&details=${encodeURIComponent(desc)}` : null;

                  return (
                    <div key={i} style={{ display: "flex", gap: 14, alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1a1a1a" }}>
                      <span style={{ background: "rgba(255,69,0,.1)", border: "1px solid rgba(255,69,0,.2)", color: "#FF4500", padding: "2px 10px", borderRadius: 20, fontSize: ".72rem", fontWeight: 700, flexShrink: 0 }}>
                        Día {c.dia}
                      </span>
                      <span style={{ fontSize: ".78rem", color: "#888", flex: 1 }}>
                        Post {(c.post_idx || 0) + 1} — {c.nota}
                      </span>
                      {post?.hora_optima && (
                        <span style={{ fontSize: ".68rem", color: "#555" }}>🕐 {post.hora_optima}</span>
                      )}
                      {calUrl && (
                        <a href={calUrl} target="_blank" rel="noreferrer" style={{
                          fontSize: ".68rem", background: "rgba(66,133,244,.08)", border: "1px solid rgba(66,133,244,.2)",
                          color: "#4285f4", padding: "3px 10px", borderRadius: 6, textDecoration: "none",
                          fontWeight: 700, fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", flexShrink: 0,
                        }}>
                          📅 Agendar
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* UTM Links */}
          {campaign.utm_links?.length > 0 && (
            <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: ".72rem", color: "#FF4500", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>
                🔗 Links UTM para esta campaña
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {campaign.utm_links.map((link, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #1a1a1a", flexWrap: "wrap" }}>
                    <span style={{ fontSize: ".8rem", color: "#ccc", minWidth: 140 }}>{link.label}</span>
                    <code style={{ fontSize: ".7rem", color: "#555", flex: 1, wordBreak: "break-all" }}>{link.url}</code>
                    <CopyBtn text={link.url} small />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botones acción */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={handleGenerate}
              disabled={loading}
              style={{
                background: "transparent", border: "1px solid #2a2a2a", color: "#555",
                padding: "10px 20px", borderRadius: 8, cursor: "pointer",
                fontSize: ".82rem", fontFamily: "'DM Sans', sans-serif", fontWeight: 700,
              }}
            >
              ↺ Regenerar campaña
            </button>
            <button
              onClick={handleSave}
              disabled={saving || saved || !user?.token}
              style={{
                background: saved ? "rgba(34,197,94,.15)" : "rgba(255,69,0,.1)",
                border: `1px solid ${saved ? "rgba(34,197,94,.4)" : "rgba(255,69,0,.3)"}`,
                color: saved ? "#22c55e" : "#FF4500",
                padding: "10px 20px", borderRadius: 8, cursor: "pointer",
                fontSize: ".82rem", fontFamily: "'DM Sans', sans-serif", fontWeight: 700,
              }}
            >
              {saved ? "✓ Campaña guardada" : saving ? "⟳ Guardando..." : "💾 Guardar campaña"}
            </button>
            <button
              onClick={() => {
                sessionStorage.removeItem(STORAGE_KEY);
                setCampaign(null);
              }}
              style={{
                background: "transparent", border: "1px solid #1a1a1a", color: "#333",
                padding: "10px 16px", borderRadius: 8, cursor: "pointer",
                fontSize: ".78rem", fontFamily: "'DM Sans', sans-serif",
              }}
            >
              🗑 Limpiar borrador
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const lbl = { fontSize: ".7rem", color: "#555", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700, marginBottom: 6 };
const sel = { background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 8, color: "#ccc", padding: "8px 12px", fontSize: ".82rem", fontFamily: "'DM Sans', sans-serif", width: "100%", outline: "none" };
const inp = { background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 8, color: "#ccc", padding: "8px 12px", fontSize: ".82rem", fontFamily: "'DM Sans', sans-serif", outline: "none" };