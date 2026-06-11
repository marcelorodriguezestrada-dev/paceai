import { useState, useEffect, useRef } from "react";

const FB = {
  apiKey:    import.meta.env.VITE_FB_API_KEY    || "TU_API_KEY",
  projectId: import.meta.env.VITE_FB_PROJECT_ID || "TU_PROJECT_ID",
  bucket:    import.meta.env.VITE_FB_BUCKET     || "TU_PROJECT_ID.appspot.com",
};

const fbRegister = async (email, password) => {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FB.apiKey}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return { uid: d.localId, email: d.email, token: d.idToken };
};

/**
 * Pasos para arreglar, guardar en git, hacer commit y correr en Vercel:
 *
 * 1. Arregla tu código si tienes errores (ejemplo: revisa las claves, URLs y el manejo de errores como ya te mostré arriba).
 *
 * 2. Guarda los cambios localmente en tu proyecto:
 *    Si editaste este archivo y corregiste errores, guarda el archivo (Ctrl+S o Cmd+S).
 * 
 * 3. En una terminal, ejecuta los siguientes comandos dentro de la carpeta de tu proyecto:
 * 
 *    git add .
 *    git commit -m "Arreglo errores de conexión o manejo de API"
 *    git push
 *
 * 4. Si ya tienes tu proyecto conectado a Vercel (https://vercel.com), Vercel desplegará automáticamente al hacer push.
 *    Si aún no lo hiciste:
 *      - Instala Vercel CLI si no la tienes: npm i -g vercel
 *      - Ejecuta: vercel
 *      - Sigue las instrucciones para conectar el proyecto.
 *
 * 5. Una vez terminado el deploy, recibirás una URL de preview en la terminal o en el dashboard de Vercel.
 *
 * Notas:
 * - Si usas claves/patrones secretos, confirma que estén en variables de entorno (Vercel > Project Settings > Environment Variables).
 * - Chequea la pestaña "Deployments" en Vercel para ver logs y errores si algo falla en producción.
 */



const fbLogin = async (email, password) => {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FB.apiKey}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return { uid: d.localId, email: d.email, token: d.idToken };
};

const toFS = (obj) => ({
  fields: Object.fromEntries(Object.entries(obj).map(([k, v]) => {
    if (v === null || v === undefined) return [k, { nullValue: null }];
    if (typeof v === "boolean") return [k, { booleanValue: v }];
    if (typeof v === "number") return [k, { doubleValue: v }];
    if (typeof v === "object") return [k, { stringValue: JSON.stringify(v) }];
    return [k, { stringValue: String(v) }];
  }))
});

const fromFS = (doc) => doc?.fields
  ? Object.fromEntries(Object.entries(doc.fields).map(([k, v]) => {
      const val = v.stringValue ?? v.integerValue ?? v.doubleValue ?? v.booleanValue ?? null;
      try { return [k, JSON.parse(val)]; } catch { return [k, val]; }
    }))
  : null;

const fsBase = (col, doc = "") => `https://firestore.googleapis.com/v1/projects/${FB.projectId}/databases/(default)/documents/${col}${doc ? "/" + doc : ""}`;

const fbSet = async (collection, docId, data, token) => {
  const r = await fetch(`${fsBase(collection, docId)}?key=${FB.apiKey}`, {
    method: "PATCH", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify(toFS(data)),
  });
  return r.json();
};

const fbGet = async (collection, docId, token) => {
  const r = await fetch(`${fsBase(collection, docId)}?key=${FB.apiKey}`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
  const d = await r.json();
  return fromFS(d);
};

const fbList = async (collection, token) => {
  const r = await fetch(`${fsBase(collection)}?key=${FB.apiKey}`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
  const d = await r.json();
  return (d.documents || []).map(doc => ({ id: doc.name.split("/").pop(), ...fromFS(doc) }));
};

const fbUpload = async (path, file, token) => {
  const r = await fetch(`https://firebasestorage.googleapis.com/v0/b/${FB.bucket}/o?uploadType=media&name=${encodeURIComponent(path)}`, {
    method: "POST", headers: { "Content-Type": file.type, "Authorization": `Bearer ${token}` },
    body: file,
  });
  const d = await r.json();
  return `https://firebasestorage.googleapis.com/v0/b/${FB.bucket}/o/${encodeURIComponent(path)}?alt=media&token=${d.downloadTokens}`;
};

const fileToBase64 = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result.split(",")[1]);
  r.onerror = rej;
  r.readAsDataURL(file);
});

const RACES = [
  { id: 1, name: "10K Palermo Classic", date: "2025-07-13", distance: "10K", location: "Parque Tres de Febrero, CABA", terrain: "asfalto plano", weather: "invierno", difficulty: "fácil", image: "🏃", registered: 3200, prize: "Medalla + remera técnica", tourism: { zone: "Palermo", hotel_zone: "Palermo Soho / Las Cañitas", parking: "Av. del Libertador y Av. Sarmiento", metro: "D - Palermo", cultural: "MALBA, Planetario, Jardín Japonés" }},
  { id: 2, name: "Media Maratón de Buenos Aires", date: "2025-08-17", distance: "21K", location: "Av. Figueroa Alcorta, CABA", terrain: "asfalto mixto", weather: "invierno tardío", difficulty: "moderado", image: "🌆", registered: 8500, prize: "Medalla finisher + cronometraje", tourism: { zone: "Recoleta / Palermo", hotel_zone: "Recoleta, Retiro o Palermo", parking: "Playa Figueroa Alcorta o Costa Salguero", metro: "D - Facultad de Medicina", cultural: "Cementerio de la Recoleta, Floralis Genérica, MUBA" }},
  { id: 3, name: "5K Nocturna del Rosedal", date: "2025-09-06", distance: "5K", location: "Jardín Japonés, CABA", terrain: "caminos de tierra", weather: "primavera", difficulty: "fácil", image: "🌙", registered: 1800, prize: "Medalla iluminada", tourism: { zone: "Palermo", hotel_zone: "Palermo Hollywood / Soho", parking: "Av. Casares o Av. del Libertador", metro: "D - Palermo", cultural: "Planetario (noche), Bosques de Palermo, Rosedal" }},
  { id: 4, name: "Maratón de Buenos Aires", date: "2025-10-19", distance: "42K", location: "Obelisco — Av. Corrientes", terrain: "asfalto con adoquines", weather: "primavera cálida", difficulty: "avanzado", image: "🏆", registered: 12000, prize: "Medalla + camiseta oficial", tourism: { zone: "Centro / San Telmo / Puerto Madero", hotel_zone: "Microcentro, San Telmo o Puerto Madero", parking: "Subterráneo Catalinas, Retiro", metro: "B - Callao, C - Diagonal Norte", cultural: "Caminito, Feria de San Telmo, Teatro Colón, Puerto Madero" }},
  { id: 5, name: "21K Villa del Parque", date: "2025-11-02", distance: "21K", location: "Parque del Centenario, CABA", terrain: "circuito urbano", weather: "primavera", difficulty: "moderado", image: "🌳", registered: 4200, prize: "Finisher kit completo", tourism: { zone: "Villa del Parque / Caballito", hotel_zone: "Caballito o Villa del Parque", parking: "Av. Ángel Gallardo al 700", metro: "B - Ángel Gallardo", cultural: "Parque del Centenario, Planetario, Feria de coleccionistas" }},
  { id: 6, name: "Trail Sierra Ventana", date: "2025-11-30", distance: "30K", location: "Sierra de la Ventana, Bs. As.", terrain: "montaña y senderos", weather: "verano inicial", difficulty: "avanzado", image: "⛰️", registered: 900, prize: "Trofeo artesanal + experiencia única", tourism: { zone: "Sierra de la Ventana (600km de CABA)", hotel_zone: "Villa Ventana, Tornquist o Sierra de la Ventana pueblo", parking: "Club Atlético Sierra de la Ventana", metro: "No aplica — tren desde Constitución o auto", cultural: "Cerro Tres Picos, Cueva de las Pinturas Rupestres, La Ventana pueblo" }},
];

const PLANS = [
  { id: "basico", name: "BÁSICO", price: "Gratis", color: "#555", accent: "#999", features: ["Hasta 3 carreras registradas", "1 mes de plan de entrenamiento", "Resumen semanal de actividades", "Calendario de carreras BA", "Acceso comunidad básica"], cta: "Comenzar gratis" },
  { id: "ilimitado", name: "ILIMITADO", price: "$4.990/mes", color: "#FF4500", accent: "#FF6B35", features: ["Carreras ilimitadas", "Coaching en nutrición y alimentación", "Gestión del esfuerzo por etapas", "Análisis post-carrera con fotos", "Guía turística por sede de carrera", "Chat con IA sin límites"], cta: "Activar plan", popular: true },
  { id: "experto", name: "EXPERTO", price: "$9.990/mes", color: "#FFD700", accent: "#FFF176", features: ["Todo lo anterior", "Métricas avanzadas: VO2Max, lactato", "Planes por ritmo (pace) personalizado", "Análisis biomecánico por video", "Sesiones 1:1 con coach humano", "Acceso a biblioteca de corredores élite"], cta: "Quiero optimizar" },
];

const diffColor = { "fácil": "#4CAF50", "moderado": "#FF9800", "avanzado": "#FF4500" };
const daysUntil = (d) => Math.ceil((new Date(d) - new Date()) / 86400000);
const coachPrompt = (profile) => `Sos PaceAI, el coach de running más avanzado de Argentina. Tenés el conocimiento técnico de Jack Daniels, la filosofía de Murakami sobre correr, y la calidez de un entrenador porteño.
${profile ? `Perfil del corredor: ${profile.name}, ${profile.age} años, ${profile.weight}kg, ${profile.height}cm, nivel ${profile.level}, objetivo: "${profile.goal}", entrena ${profile.days} días/semana.` : ""}
Hablás de vos a vos. Mezclás técnica con motivación. Respondés en español rioplatense, conciso (3-4 párrafos máx).`;

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=DM+Sans:wght@300;400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#080808;--bg2:#111;--bg3:#1a1a1a;--or:#FF4500;--gold:#FFD700;--tx:#F0F0F0;--mu:#888;--bd:#2a2a2a;--fd:'Anton',sans-serif;--fb:'DM Sans',sans-serif}
body{background:var(--bg);color:var(--tx);font-family:var(--fb)}
.app{min-height:100vh}
.nav{position:sticky;top:0;z-index:200;background:rgba(8,8,8,.96);backdrop-filter:blur(12px);border-bottom:1px solid var(--bd);padding:0 20px;display:flex;align-items:center;justify-content:space-between;height:58px;gap:12px}
.logo{font-family:var(--fd);font-size:1.5rem;color:var(--or);cursor:pointer;white-space:nowrap}
.logo span{color:var(--tx)}
.nav-links{display:flex;gap:2px;flex-wrap:nowrap}
.nl{background:none;border:none;color:var(--mu);font-family:var(--fb);font-size:.82rem;font-weight:500;padding:7px 12px;border-radius:6px;cursor:pointer;transition:.2s;white-space:nowrap}
.nl:hover{color:var(--tx);background:var(--bg3)}
.nl.act{color:var(--or);background:rgba(255,69,0,.1)}
.nav-r{display:flex;gap:8px;align-items:center;flex-shrink:0}
.nav-btn{background:var(--or);color:#fff;border:none;padding:7px 16px;border-radius:6px;font-family:var(--fb);font-weight:700;font-size:.82rem;cursor:pointer;white-space:nowrap}
.ava{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--or),var(--gold));display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:700;cursor:pointer;border:none;color:#000;flex-shrink:0}
.hero{position:relative;overflow:hidden;padding:72px 24px 56px}
.hero-bg{position:absolute;inset:0;background:radial-gradient(ellipse 70% 60% at 75% 50%,rgba(255,69,0,.11) 0,transparent 60%),radial-gradient(ellipse 50% 40% at 20% 80%,rgba(255,215,0,.05) 0,transparent 50%);pointer-events:none}
.hc{max-width:900px;margin:0 auto;position:relative}
.htag{display:inline-block;background:rgba(255,69,0,.14);border:1px solid rgba(255,69,0,.3);color:var(--or);padding:4px 14px;border-radius:20px;font-size:.72rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:18px}
.htitle{font-family:var(--fd);font-size:clamp(2.8rem,8vw,5.5rem);line-height:.95;margin-bottom:10px}
.htitle .ac{color:var(--or);display:block}
.hsub{font-size:1rem;color:var(--mu);max-width:460px;line-height:1.6;margin-bottom:28px}
.hacts{display:flex;gap:10px;flex-wrap:wrap}
.btnp{background:var(--or);color:#fff;border:none;padding:13px 26px;border-radius:8px;font-family:var(--fb);font-weight:700;font-size:.9rem;cursor:pointer;transition:.2s}
.btnp:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(255,69,0,.35)}
.btns{background:transparent;color:var(--tx);border:1px solid var(--bd);padding:13px 26px;border-radius:8px;font-family:var(--fb);font-weight:600;font-size:.9rem;cursor:pointer;transition:.2s}
.btns:hover{border-color:var(--or);color:var(--or)}
.hstats{display:flex;gap:36px;margin-top:44px;padding-top:28px;border-top:1px solid var(--bd);flex-wrap:wrap}
.stn{font-family:var(--fd);font-size:1.9rem;color:var(--or);line-height:1}
.stl{font-size:.72rem;color:var(--mu);text-transform:uppercase;letter-spacing:1px}
.fstrip{background:var(--bg2);border-top:1px solid var(--bd);border-bottom:1px solid var(--bd);padding:36px 24px}
.fi{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:28px}
.fitm .ico{font-size:1.6rem;display:block;margin-bottom:6px}
.fitm .fn{font-weight:700;font-size:.9rem;margin-bottom:3px}
.fitm .fd{font-size:.8rem;color:var(--mu);line-height:1.5}
.sec{padding:52px 24px;max-width:1100px;margin:0 auto}
.sh{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:28px;flex-wrap:wrap;gap:10px}
.st{font-family:var(--fd);font-size:2rem;color:var(--tx)}
.st span{color:var(--or)}
.sall{background:none;border:none;color:var(--or);font-size:.82rem;font-weight:700;cursor:pointer;padding:4px 0}
.rgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:14px}
.rcard{background:var(--bg2);border:1px solid var(--bd);border-radius:12px;overflow:hidden;cursor:pointer;transition:.25s}
.rcard:hover{border-color:var(--or);transform:translateY(-3px);box-shadow:0 10px 28px rgba(255,69,0,.14)}
.rch{padding:18px 18px 12px;border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:12px}
.remi{width:44px;height:44px;background:rgba(255,69,0,.1);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0}
.rn{font-weight:700;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rd{font-family:var(--fd);font-size:1.3rem;color:var(--or);line-height:1}
.rcb{padding:12px 18px;display:flex;flex-direction:column;gap:7px}
.rm{display:flex;align-items:center;gap:5px;font-size:.78rem;color:var(--mu)}
.rf{padding:10px 18px;border-top:1px solid var(--bd);display:flex;align-items:center;justify-content:space-between}
.dbadge{padding:3px 9px;border-radius:20px;font-size:.7rem;font-weight:700;text-transform:uppercase}
.daybadge{font-size:.78rem;font-weight:600;color:var(--gold)}
.pgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px}
.pcard{background:var(--bg2);border:1px solid var(--bd);border-radius:14px;padding:26px;position:relative;transition:.25s}
.pcard.pop{border-color:var(--or);background:linear-gradient(180deg,rgba(255,69,0,.06) 0,var(--bg2) 100%)}
.pcard:hover{transform:translateY(-4px)}
.pbadge{position:absolute;top:-11px;left:50%;transform:translateX(-50%);background:var(--or);color:#fff;padding:3px 14px;border-radius:20px;font-size:.7rem;font-weight:800;letter-spacing:1px;white-space:nowrap}
.pname{font-family:var(--fd);font-size:1.3rem;margin-bottom:4px}
.pprice{font-family:var(--fd);font-size:1.9rem;line-height:1;margin-bottom:18px}
.pfeats{list-style:none;display:flex;flex-direction:column;gap:9px;margin-bottom:22px}
.pf{display:flex;gap:7px;font-size:.82rem;color:var(--mu);align-items:flex-start}
.pf::before{content:"✓";color:var(--or);font-weight:700;flex-shrink:0}
.pbtn{width:100%;padding:11px;border-radius:7px;font-family:var(--fb);font-weight:700;font-size:.88rem;cursor:pointer;transition:.2s;border:none}
.ppage{max-width:520px;margin:0 auto;padding:40px 24px}
.ptitle{font-family:var(--fd);font-size:2.3rem;margin-bottom:6px}
.psub{color:var(--mu);font-size:.88rem;margin-bottom:28px;line-height:1.5}
.fg{margin-bottom:18px}
.fl{display:block;font-size:.75rem;font-weight:600;color:var(--mu);text-transform:uppercase;letter-spacing:1px;margin-bottom:7px}
.fi2{width:100%;background:var(--bg2);border:1px solid var(--bd);color:var(--tx);padding:11px 14px;border-radius:8px;font-family:var(--fb);font-size:.92rem;outline:none;transition:.2s}
.fi2:focus{border-color:var(--or)}
.fsel{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23888' stroke-width='1.5' fill='none'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 13px center;padding-right:34px}
.frow{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.lgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
.lopt{background:var(--bg2);border:1px solid var(--bd);padding:11px;border-radius:8px;cursor:pointer;transition:.2s;text-align:center}
.lopt.sel{border-color:var(--or);background:rgba(255,69,0,.1)}
.lic{font-size:1.3rem;display:block;margin-bottom:3px}
.ln{font-size:.78rem;font-weight:600}
.chat{display:flex;flex-direction:column;height:calc(100vh - 58px);max-width:740px;margin:0 auto;padding:0 20px}
.chatheader{padding:18px 0 14px;border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:12px}
.chatava{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,var(--or),#FF8C42);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0}
.chatname{font-family:var(--fd);font-size:1.6rem}
.chatsub{font-size:.8rem;color:var(--mu)}
.msgs{flex:1;overflow-y:auto;padding:18px 0;display:flex;flex-direction:column;gap:14px}
.msgs::-webkit-scrollbar{width:3px}
.msgs::-webkit-scrollbar-thumb{background:var(--bd);border-radius:2px}
.msg{display:flex;gap:9px;max-width:87%}
.msg.u{align-self:flex-end;flex-direction:row-reverse}
.mava{width:30px;height:30px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.85rem}
.msg.a .mava{background:linear-gradient(135deg,var(--or),#FF8C42)}
.msg.u .mava{background:var(--bg3);border:1px solid var(--bd)}
.mbub{padding:11px 14px;border-radius:11px;font-size:.88rem;line-height:1.6;white-space:pre-wrap}
.msg.a .mbub{background:var(--bg2);border:1px solid var(--bd);border-top-left-radius:3px}
.msg.u .mbub{background:var(--or);color:#fff;border-top-right-radius:3px}
.typing{display:flex;gap:4px;padding:12px 14px}
.dot{width:6px;height:6px;background:var(--mu);border-radius:50%;animation:bonce 1.2s infinite}
.dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}
@keyframes bonce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
.cinput{padding:14px 0 18px;border-top:1px solid var(--bd);display:flex;gap:9px}
.cinp{flex:1;background:var(--bg2);border:1px solid var(--bd);color:var(--tx);padding:11px 14px;border-radius:9px;font-family:var(--fb);font-size:.88rem;outline:none;resize:none;transition:.2s}
.cinp:focus{border-color:var(--or)}
.csend{background:var(--or);color:#fff;border:none;width:42px;height:42px;border-radius:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1rem;transition:.2s;flex-shrink:0}
.csend:hover{opacity:.8}.csend:disabled{opacity:.4;cursor:not-allowed}
.qps{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px}
.qp{background:var(--bg3);border:1px solid var(--bd);color:var(--mu);padding:5px 11px;border-radius:20px;font-size:.75rem;cursor:pointer;transition:.2s;font-family:var(--fb)}
.qp:hover{border-color:var(--or);color:var(--or)}
.tpage{max-width:880px;margin:0 auto;padding:30px 24px}
.ttitle{font-family:var(--fd);font-size:2rem}
.trace{font-size:.88rem;color:var(--mu);margin-top:3px}
.wtabs{display:flex;gap:7px;margin:20px 0;flex-wrap:wrap}
.wtab{background:var(--bg2);border:1px solid var(--bd);color:var(--mu);padding:7px 16px;border-radius:6px;font-size:.82rem;font-weight:600;cursor:pointer;transition:.2s;font-family:var(--fb)}
.wtab.act{background:var(--or);border-color:var(--or);color:#fff}
.wcont{background:var(--bg2);border:1px solid var(--bd);border-radius:11px;overflow:hidden}
.wobj{padding:14px 18px;border-bottom:1px solid var(--bd);font-size:.88rem}
.wobj strong{color:var(--or)}
.srow{display:grid;grid-template-columns:90px 110px 90px 1fr;gap:10px;align-items:center;padding:12px 18px;border-bottom:1px solid var(--bd);font-size:.82rem}
.srow:last-child{border-bottom:none}
.sday{font-weight:700}
.styp{padding:2px 9px;border-radius:20px;font-size:.7rem;font-weight:700;text-transform:uppercase;display:inline-block}
.sdist{font-family:var(--fd);font-size:.95rem;color:var(--gold)}
.sdesc{color:var(--mu);font-size:.79rem}
.wtip{padding:12px 18px;background:rgba(255,69,0,.05);border-top:1px solid var(--bd);font-size:.82rem;color:var(--mu)}
.extras{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px;margin-top:20px}
.exc{background:var(--bg2);border:1px solid var(--bd);border-radius:9px;padding:16px}
.ext{font-weight:700;font-size:.8rem;color:var(--or);margin-bottom:7px;text-transform:uppercase;letter-spacing:1px}
.exd{font-size:.82rem;color:var(--mu);line-height:1.6}
.prpage{max-width:740px;margin:0 auto;padding:36px 24px}
.dropzone{border:2px dashed var(--bd);border-radius:12px;padding:48px 24px;text-align:center;cursor:pointer;transition:.2s;margin-bottom:20px}
.dropzone:hover,.dropzone.has{border-color:var(--or);background:rgba(255,69,0,.04)}
.dropico{font-size:2.5rem;display:block;margin-bottom:10px}
.droptxt{font-size:.9rem;color:var(--mu)}
.dropimg{max-width:100%;border-radius:8px;margin-top:12px;max-height:280px;object-fit:contain}
.analysis{background:var(--bg2);border:1px solid var(--bd);border-radius:12px;padding:22px;margin-top:20px}
.analysis h3{font-family:var(--fd);font-size:1.4rem;margin-bottom:14px;color:var(--or)}
.analysis p{font-size:.88rem;line-height:1.7;color:var(--mu);white-space:pre-wrap}
.hist-item{background:var(--bg2);border:1px solid var(--bd);border-radius:9px;padding:14px 16px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px}
.hist-date{font-size:.75rem;color:var(--mu);flex-shrink:0}
.hist-preview{font-size:.82rem;color:var(--tx);flex:1}
.tourpage{max-width:900px;margin:0 auto;padding:36px 24px}
.tour-select{margin-bottom:28px}
.tour-label{font-family:var(--fd);font-size:1.6rem;margin-bottom:12px}
.race-pills{display:flex;flex-wrap:wrap;gap:8px}
.rpill{background:var(--bg2);border:1px solid var(--bd);padding:8px 16px;border-radius:20px;cursor:pointer;font-size:.82rem;transition:.2s;font-family:var(--fb)}
.rpill.sel{background:rgba(255,69,0,.15);border-color:var(--or);color:var(--or)}
.tour-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-bottom:24px}
.tc{background:var(--bg2);border:1px solid var(--bd);border-radius:10px;padding:16px}
.tci{font-size:1.4rem;margin-bottom:6px}
.tcn{font-weight:700;font-size:.85rem;margin-bottom:4px;color:var(--or)}
.tcd{font-size:.82rem;color:var(--mu);line-height:1.5}
.ai-tour{background:var(--bg2);border:1px solid var(--bd);border-radius:12px;padding:20px;margin-top:8px}
.ai-tour h3{font-family:var(--fd);font-size:1.3rem;margin-bottom:12px;color:var(--gold)}
.ai-tour p{font-size:.86rem;line-height:1.7;color:var(--mu);white-space:pre-wrap}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px}
.modal{background:var(--bg2);border:1px solid var(--bd);border-radius:16px;padding:32px;width:100%;max-width:400px;position:relative}
.modal h2{font-family:var(--fd);font-size:2rem;margin-bottom:6px}
.modal-sub{font-size:.85rem;color:var(--mu);margin-bottom:24px}
.ferr{color:#FF6666;font-size:.82rem;margin-top:10px;padding:10px 14px;background:rgba(255,68,68,.1);border-radius:6px;border:1px solid rgba(255,68,68,.2)}
.mtabs{display:flex;margin-bottom:24px;border:1px solid var(--bd);border-radius:8px;overflow:hidden}
.mtab{flex:1;padding:9px;background:none;border:none;color:var(--mu);font-family:var(--fb);font-weight:600;font-size:.85rem;cursor:pointer;transition:.2s}
.mtab.act{background:var(--or);color:#fff}
.mclose{position:absolute;right:14px;top:14px;background:none;border:none;color:var(--mu);font-size:1.3rem;cursor:pointer;padding:4px 8px;line-height:1;border-radius:4px}
.mclose:hover{color:var(--tx);background:var(--bg3)}
.pw{padding:40px 24px;max-width:1100px;margin:0 auto}
.back{background:none;border:none;color:var(--mu);font-size:.82rem;cursor:pointer;margin-bottom:20px;display:flex;align-items:center;gap:5px;padding:0;font-family:var(--fb)}
.back:hover{color:var(--or)}
.spin{width:44px;height:44px;border:3px solid var(--bd);border-top-color:var(--or);border-radius:50%;animation:sp .8s linear infinite;margin:0 auto 16px}
@keyframes sp{to{transform:rotate(360deg)}}
.lcenter{text-align:center;padding:72px 20px}
.ltxt{font-family:var(--fd);font-size:1.4rem;color:var(--mu)}
.saved-badge{background:rgba(76,175,80,.15);border:1px solid rgba(76,175,80,.3);color:#4CAF50;padding:6px 14px;border-radius:6px;font-size:.8rem;font-weight:600}
@media(max-width:600px){.frow{grid-template-columns:1fr}.nav-links{display:none}.srow{grid-template-columns:80px 1fr;grid-template-rows:auto auto}.sdist{display:none}}
`;

// ─────────────────────────────────────────────────────────────────────────────
// FIX: AuthModal, RaceCard y PlanCard definidos FUERA de RunnerAI
// para evitar re-mount en cada render (bug del cursor que desaparece)
// ─────────────────────────────────────────────────────────────────────────────

function AuthModal({ authTab, setAuthTab, authForm, setAuthForm, authLoading, authErr, doAuth, onClose }) {
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="mclose" onClick={onClose}>✕</button>
        <h2>BIENVENIDO<span style={{ color: "var(--or)" }}>.</span></h2>
        <p className="modal-sub">Guardá tus planes y análisis en la nube.</p>
        <div className="mtabs">
          <button
            className={`mtab ${authTab === "login" ? "act" : ""}`}
            onClick={() => setAuthTab("login")}
          >
            Ingresar
          </button>
          <button
            className={`mtab ${authTab === "register" ? "act" : ""}`}
            onClick={() => setAuthTab("register")}
          >
            Registrarse
          </button>
        </div>
        <div className="fg">
          <label className="fl">Email</label>
          <input
            className="fi2"
            type="email"
            placeholder="tu@email.com"
            value={authForm.email}
            onChange={e => setAuthForm(prev => ({ ...prev, email: e.target.value }))}
            autoComplete="email"
            autoFocus
          />
        </div>
        <div className="fg">
          <label className="fl">Contraseña</label>
          <input
            className="fi2"
            type="password"
            placeholder="Mínimo 6 caracteres"
            value={authForm.password}
            onChange={e => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && doAuth()}
            autoComplete={authTab === "login" ? "current-password" : "new-password"}
          />
        </div>
        <button
          className="btnp"
          style={{ width: "100%", padding: 14, marginTop: 4 }}
          onClick={doAuth}
          disabled={authLoading}
        >
          {authLoading ? "Cargando..." : authTab === "login" ? "Ingresar" : "Crear cuenta"}
        </button>
        {authErr && <div className="ferr">{authErr}</div>}
        <p style={{ textAlign: "center", color: "var(--mu)", fontSize: ".75rem", marginTop: 16 }}>
          Datos guardados en Firebase · Gratis
        </p>
      </div>
    </div>
  );
}

function RaceCard({ race, onClick }) {
  const days = daysUntil(race.date);
  const dateStr = new Date(race.date).toLocaleDateString("es-AR", { day: "numeric", month: "long" });
  return (
    <div className="rcard" onClick={onClick}>
      <div className="rch">
        <div className="remi">{race.image}</div>
        <div>
          <div className="rn">{race.name}</div>
          <div className="rd">{race.distance}</div>
        </div>
      </div>
      <div className="rcb">
        <div className="rm"><span>📅</span>{dateStr}</div>
        <div className="rm"><span>📍</span>{race.location}</div>
        <div className="rm"><span>🏔️</span>{race.terrain} · {race.weather}</div>
      </div>
      <div className="rf">
        <span className="dbadge" style={{ background: diffColor[race.difficulty] + "22", color: diffColor[race.difficulty] }}>{race.difficulty}</span>
        <span className="daybadge">{days > 0 ? `en ${days} días` : "¡Ya!"}</span>
      </div>
    </div>
  );
}

function PlanCard({ plan, onSelect }) {
  return (
    <div className={`pcard ${plan.popular ? "pop" : ""}`}>
      {plan.popular && <div className="pbadge">⭐ MÁS ELEGIDO</div>}
      <div className="pname" style={{ color: plan.color }}>{plan.name}</div>
      <div className="pprice" style={{ color: plan.accent }}>{plan.price}</div>
      <ul className="pfeats">{plan.features.map(f => <li key={f} className="pf">{f}</li>)}</ul>
      <button
        className="pbtn"
        style={{ background: plan.popular ? plan.color : "transparent", color: plan.popular ? "#fff" : plan.color, border: `1px solid ${plan.color}` }}
        onClick={() => onSelect(plan)}
      >
        {plan.cta}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function RunnerAI() {
  const [view, setView] = useState("home");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [pForm, setPForm] = useState({ name: "", age: "", weight: "", height: "", level: "principiante", goal: "", days: "4" });
  const [selRace, setSelRace] = useState(null);
  const [selPlan, setSelPlan] = useState(null);
  const [msgs, setMsgs] = useState([{ role: "assistant", content: "¡Hola! Soy PaceAI 🏃 Tu coach personal para las carreras de Buenos Aires. ¿Sobre qué querés charlar? Puedo armarte un plan, hablarte de nutrición o prepararte para tu próxima competencia." }]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [trainPlan, setTrainPlan] = useState(null);
  const [genPlan, setGenPlan] = useState(false);
  const [activeWeek, setActiveWeek] = useState(0);
  const [showAuth, setShowAuth] = useState(false);
  const [authTab, setAuthTab] = useState("login");
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [authLoading, setAuthLoading] = useState(false);
  const [authErr, setAuthErr] = useState("");
  const [prPhoto, setPrPhoto] = useState(null);
  const [prPreview, setPrPreview] = useState(null);
  const [prAnalysis, setPrAnalysis] = useState(null);
  const [prLoading, setPrLoading] = useState(false);
  const [prHistory, setPrHistory] = useState([]);
  const [savingPR, setSavingPR] = useState(false);
  const [tourRace, setTourRace] = useState(null);
  const [tourAI, setTourAI] = useState("");
  const [tourLoading, setTourLoading] = useState(false);
  const chatEnd = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const p = await fbGet("users", user.uid, user.token).catch(() => null);
      if (p) { setProfile(p); setPForm(p); }
      const analyses = await fbList(`analyses_${user.uid}`, user.token).catch(() => []);
      setPrHistory(analyses.reverse().slice(0, 5));
    })();
  }, [user]);

  const doAuth = async () => {
    if (!authForm.email || !authForm.password) {
      setAuthErr("Completá email y contraseña.");
      return;
    }
    setAuthErr("");
    setAuthLoading(true);
    try {
      const u = authTab === "login"
        ? await fbLogin(authForm.email, authForm.password)
        : await fbRegister(authForm.email, authForm.password);
      setUser(u);
      setShowAuth(false);
      setAuthForm({ email: "", password: "" });
    } catch (e) {
      const msg = e.message
        .replace("EMAIL_EXISTS", "Este email ya está registrado. Probá ingresar.")
        .replace("INVALID_LOGIN_CREDENTIALS", "Email o contraseña incorrectos.")
        .replace("WEAK_PASSWORD : Password should be at least 6 characters", "La contraseña debe tener al menos 6 caracteres.")
        .replace("INVALID_EMAIL", "El email no es válido.")
        .replace(/_/g, " ");
      setAuthErr(msg);
    }
    setAuthLoading(false);
  };

  const saveProfile = async () => {
    if (!pForm.name || !pForm.age) return;
    setProfile(pForm);
    if (user) await fbSet("users", user.uid, pForm, user.token).catch(() => null);
    setView("home");
  };

  const sendMsg = async (txt) => {
    const text = txt || chatInput.trim();
    if (!text) return;
    const newMsgs = [...msgs, { role: "user", content: text }];
    setMsgs(newMsgs); setChatInput(""); setChatLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: coachPrompt(profile), messages: newMsgs }),
      });
      const d = await res.json();
      setMsgs(p => [...p, { role: "assistant", content: d.content?.[0]?.text || "Error al responder." }]);
    } catch { setMsgs(p => [...p, { role: "assistant", content: "Error de conexión. Intentá de nuevo." }]); }
    setChatLoading(false);
  };

  const genTrainPlan = async (race) => {
    setGenPlan(true); setView("training"); setActiveWeek(0);
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: `Generá plan de entrenamiento para "${race.name}" (${race.distance}), fecha ${race.date}, terreno ${race.terrain}, clima ${race.weather}.${profile ? ` Perfil: nivel ${profile.level}, ${profile.age} años, ${profile.days} días/semana.` : ""}
Respondé SOLO con JSON sin markdown:
{"semanas":[{"numero":1,"objetivo":"string","sesiones":[{"dia":"Lunes","tipo":"Recuperación","distancia":"5K","ritmo":"6:30/km","descripcion":"string"}],"consejo":"string"}],"consejos_generales":["string"],"nutricion":"string","calzado":"string"}
4 semanas, 4-5 sesiones/semana.` }],
        }),
      });
      const d = await res.json();
      const text = d.content?.[0]?.text || "{}";
      const plan = JSON.parse(text.replace(/```json|```/g, "").trim());
      const full = { ...plan, race };
      setTrainPlan(full);
      if (user) await fbSet(`plans_${user.uid}`, `${race.id}_${Date.now()}`, { race: JSON.stringify(race), plan: JSON.stringify(plan), createdAt: new Date().toISOString() }, user.token).catch(() => null);
    } catch { setTrainPlan({ error: true, race }); }
    setGenPlan(false);
  };

  const handlePhotoSelect = (file) => {
    if (!file) return;
    setPrPhoto(file);
    setPrPreview(URL.createObjectURL(file));
    setPrAnalysis(null);
  };

  const analyzeRace = async () => {
    if (!prPhoto) return;
    setPrLoading(true);
    try {
      const b64 = await fileToBase64(prPhoto);
      const res = await fetch("/api/vision", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: b64,
          imageType: prPhoto.type,
          system: `Sos PaceAI, coach de running argentino. Analizás fotos post-carrera. Hablás en español rioplatense, de vos a vos.`,
          text: `Analizá esta imagen post-carrera${profile ? ` del corredor ${profile.name} (nivel ${profile.level}, objetivo: "${profile.goal}")` : ""}. Si es resultado: extraé tiempo, pace, posición. Si es foto: comentá postura y esfuerzo. Terminá con: (1) puntaje 0-100%, (2) principal logro, (3) área a mejorar.`,
        }),
      });
      const d = await res.json();
      const analysis = d.content?.[0]?.text || "No se pudo analizar.";
      setPrAnalysis(analysis);
      if (user) {
        setSavingPR(true);
        let photoUrl = null;
        try { photoUrl = await fbUpload(`photos/${user.uid}/${Date.now()}_${prPhoto.name}`, prPhoto, user.token); } catch {}
        const record = { analysis, photoUrl: photoUrl || "", race: selRace?.name || "Sin carrera", createdAt: new Date().toISOString() };
        await fbSet(`analyses_${user.uid}`, String(Date.now()), record, user.token).catch(() => null);
        setPrHistory(p => [record, ...p].slice(0, 5));
        setSavingPR(false);
      }
    } catch { setPrAnalysis("Error al analizar. Verificá tu conexión e intentá de nuevo."); }
    setPrLoading(false);
  };

  const loadTourism = async (race) => {
    setTourRace(race); setTourAI(""); setTourLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: `Guía turística completa para la "${race.name}" (${race.distance}) en ${race.location}. Incluí: 🍝 dónde comer la noche anterior (2-3 opciones con precio), 🏨 hoteles recomendados cerca (2-3), 🚗 estacionamiento y transporte público, 👨‍👩‍👧 qué hacer la familia mientras corro, 🎭 actividad cultural post-carrera, ⚡ 3 tips logísticos clave. Español rioplatense, concreto.` }],
        }),
      });
      const d = await res.json();
      setTourAI(d.content?.[0]?.text || "No se pudo cargar la guía.");
    } catch { setTourAI("Error al cargar. Verificá tu conexión."); }
    setTourLoading(false);
  };

  // ── VIEWS ──
  const renderHome = () => (
    <>
      <div className="hero">
        <div className="hero-bg" />
        <div className="hc">
          <div className="htag">IA de coaching · Buenos Aires · Firebase</div>
          <h1 className="htitle">CORRÉ<br /><span className="ac">MÁS INTELIGENTE</span></h1>
          <p className="hsub">El primer coach de running con IA para corredores porteños. No solo un calendario — un sistema que te conoce, te entrena y aprende con vos.</p>
          <div className="hacts">
            <button className="btnp" onClick={() => setView("calendar")}>Ver carreras 2025</button>
            <button className="btns" onClick={() => setView("coach")}>Hablar con PaceAI</button>
          </div>
          <div className="hstats">
            {[["6+","Carreras BA"],["42K","Maratón incluida"],["3","Niveles de plan"],["24/7","Coach IA"]].map(([n,l]) => (
              <div key={l}><div className="stn">{n}</div><div className="stl">{l}</div></div>
            ))}
          </div>
        </div>
      </div>
      <div className="fstrip">
        <div className="fi">
          {[["🧠","IA adaptativa","Planes que ajustan según clima, terreno y tu progreso"],["📅","Calendario real","Carreras de Buenos Aires con info completa"],["📸","Post-carrera","Subí tus fotos y la IA analiza tu desempeño"],["🗺️","Guía turística","Hoteles, restaurants y actividades por sede"],["🔥","Firebase","Datos guardados en la nube, gratis"]].map(([ic,n,d]) => (
            <div key={n} className="fitm"><span className="ico">{ic}</span><div className="fn">{n}</div><div className="fd">{d}</div></div>
          ))}
        </div>
      </div>
      <div className="sec">
        <div className="sh"><h2 className="st">PRÓXIMAS <span>CARRERAS</span></h2><button className="sall" onClick={() => setView("calendar")}>Ver todas →</button></div>
        <div className="rgrid">{RACES.slice(0,3).map(r => <RaceCard key={r.id} race={r} onClick={() => { setSelRace(r); setView("race"); }} />)}</div>
      </div>
      <div className="sec" style={{ paddingTop: 0 }}>
        <div className="sh"><h2 className="st">ELEGÍ TU <span>PLAN</span></h2></div>
        <div className="pgrid">{PLANS.map(p => <PlanCard key={p.id} plan={p} onSelect={(plan) => { setSelPlan(plan); if (!user) setShowAuth(true); }} />)}</div>
      </div>
    </>
  );

  const renderCalendar = () => (
    <div className="pw">
      <button className="back" onClick={() => setView("home")}>← Inicio</button>
      <div className="sh" style={{ marginBottom: 28 }}><h1 className="st">CALENDARIO <span>2025</span></h1></div>
      <div className="rgrid">{RACES.map(r => <RaceCard key={r.id} race={r} onClick={() => { setSelRace(r); setView("race"); }} />)}</div>
    </div>
  );

  const renderRace = () => {
    const race = selRace; if (!race) return null;
    const dateStr = new Date(race.date).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    return (
      <div className="pw" style={{ maxWidth: 700 }}>
        <button className="back" onClick={() => setView("calendar")}>← Calendario</button>
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 22 }}>
          <div style={{ fontSize: "2.8rem" }}>{race.image}</div>
          <div><h1 style={{ fontFamily: "var(--fd)", fontSize: "1.9rem", lineHeight: 1 }}>{race.name}</h1><div style={{ color: "var(--mu)", marginTop: 3, fontSize: ".88rem" }}>{dateStr}</div></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 24 }}>
          {[["Distancia",race.distance,"var(--or)"],["Terreno",race.terrain],["Clima",race.weather],["Inscritos",race.registered?.toLocaleString()]].map(([l,v,c]) => (
            <div key={l} style={{ background: "var(--bg2)", border: "1px solid var(--bd)", padding: "14px", borderRadius: "9px" }}>
              <div style={{ fontSize: ".72rem", color: "var(--mu)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "3px" }}>{l}</div>
              <div style={{ fontFamily: "var(--fd)", fontSize: "1.2rem", color: c || "var(--tx)" }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ background: "var(--bg2)", border: "1px solid var(--bd)", borderRadius: "9px", padding: "14px 18px", marginBottom: 14 }}>
          <div style={{ fontSize: ".78rem", color: "var(--or)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 6 }}>🏆 Premio</div>
          <div style={{ fontSize: ".88rem" }}>{race.prize}</div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btnp" onClick={() => genTrainPlan(race)}>🤖 Generar plan IA</button>
          <button className="btns" onClick={() => { setView("coach"); sendMsg(`Quiero prepararme para la ${race.name} (${race.distance}). Terreno: ${race.terrain}, clima: ${race.weather}.`); }}>💬 Preguntar al coach</button>
          <button className="btns" onClick={() => { setView("tourism"); loadTourism(race); }}>🗺️ Guía turística</button>
          <button className="btns" onClick={() => { setView("postrace"); setSelRace(race); }}>📸 Analizar resultados</button>
        </div>
      </div>
    );
  };

  const renderProfile = () => (
    <div className="ppage">
      {user && <div style={{ marginBottom: 16 }}><span className="saved-badge">✓ Sesión activa · {user.email}</span></div>}
      <h1 className="ptitle">TU PERFIL</h1>
      <p className="psub">La IA usa estos datos para personalizar cada plan. {user ? "Se guarda automáticamente en Firebase." : "Creá una cuenta para guardar en la nube."}</p>
      <div className="fg"><label className="fl">Nombre</label><input className="fi2" placeholder="¿Cómo te llamás?" value={pForm.name} onChange={e => setPForm(p => ({ ...p, name: e.target.value }))} /></div>
      <div className="frow">
        <div className="fg"><label className="fl">Edad</label><input className="fi2" type="number" placeholder="35" value={pForm.age} onChange={e => setPForm(p => ({ ...p, age: e.target.value }))} /></div>
        <div className="fg"><label className="fl">Peso (kg)</label><input className="fi2" type="number" placeholder="72" value={pForm.weight} onChange={e => setPForm(p => ({ ...p, weight: e.target.value }))} /></div>
      </div>
      <div className="frow">
        <div className="fg"><label className="fl">Altura (cm)</label><input className="fi2" type="number" placeholder="175" value={pForm.height} onChange={e => setPForm(p => ({ ...p, height: e.target.value }))} /></div>
        <div className="fg"><label className="fl">Días/semana</label>
          <select className="fi2 fsel" value={pForm.days} onChange={e => setPForm(p => ({ ...p, days: e.target.value }))}>
            {["2","3","4","5","6"].map(d => <option key={d} value={d}>{d} días</option>)}
          </select>
        </div>
      </div>
      <div className="fg"><label className="fl">Nivel</label>
        <div className="lgrid">
          {[["principiante","🌱","Principiante"],["moderado","🔥","Moderado"],["avanzado","⚡","Avanzado"]].map(([id,ic,lb]) => (
            <div key={id} className={`lopt ${pForm.level === id ? "sel" : ""}`} onClick={() => setPForm(p => ({ ...p, level: id }))}>
              <span className="lic">{ic}</span><span className="ln">{lb}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="fg"><label className="fl">Objetivo principal</label><input className="fi2" placeholder="Ej: Terminar mi primera maratón" value={pForm.goal} onChange={e => setPForm(p => ({ ...p, goal: e.target.value }))} /></div>
      <button className="btnp" style={{ width: "100%", padding: 14 }} onClick={saveProfile}>{user ? "Guardar en Firebase →" : "Guardar perfil →"}</button>
      {!user && <button className="btns" style={{ width: "100%", padding: 12, marginTop: 10 }} onClick={() => setShowAuth(true)}>Crear cuenta para sincronizar ☁️</button>}
    </div>
  );

  const renderPlans = () => (
    <div className="pw">
      <button className="back" onClick={() => setView("home")}>← Inicio</button>
      <div className="sh" style={{ marginBottom: 10 }}><h1 className="st">ELEGÍ TU <span>PLAN</span></h1></div>
      <p style={{ color: "var(--mu)", marginBottom: 36, fontSize: ".92rem" }}>Tres niveles de coaching. Desde tu primera carrera hasta las métricas de élite.</p>
      <div className="pgrid">{PLANS.map(p => <PlanCard key={p.id} plan={p} onSelect={(plan) => { setSelPlan(plan); if (!user) setShowAuth(true); }} />)}</div>
    </div>
  );

  const renderCoach = () => (
    <div className="chat">
      <div className="chatheader">
        <div className="chatava">🏃</div>
        <div><div className="chatname">PACE<span style={{ color: "var(--or)" }}>AI</span></div><div className="chatsub">{profile ? `Entrenando a ${profile.name} · ${profile.level}` : "Coach de running · Buenos Aires"}</div></div>
      </div>
      <div className="msgs">
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role === "user" ? "u" : "a"}`}>
            <div className="mava">{m.role === "assistant" ? "🏃" : (profile?.name?.[0] || "U")}</div>
            <div className="mbub">{m.content}</div>
          </div>
        ))}
        {chatLoading && <div className="msg a"><div className="mava">🏃</div><div className="mbub"><div className="typing"><div className="dot"/><div className="dot"/><div className="dot"/></div></div></div>}
        <div ref={chatEnd} />
      </div>
      <div>
        <div className="qps">
          {["¿Qué como antes de la carrera?","¿Cómo evito el pájaro?","¿Qué zapatillas me recomendás?","Armame un plan básico","¿Cómo manejo el fondo en invierno?"].map(q => (
            <button key={q} className="qp" onClick={() => sendMsg(q)}>{q}</button>
          ))}
        </div>
        <div className="cinput">
          <textarea className="cinp" rows={2} placeholder="Preguntale a PaceAI..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); } }} />
          <button className="csend" onClick={() => sendMsg()} disabled={chatLoading || !chatInput.trim()}>→</button>
        </div>
      </div>
    </div>
  );

  const renderTraining = () => {
    if (genPlan) return <div className="lcenter"><div className="spin"/><div className="ltxt">Generando tu plan...</div></div>;
    if (!trainPlan) return <div className="tpage"><p style={{ color: "var(--mu)" }}>Seleccioná una carrera para generar tu plan.</p><button className="btnp" style={{ marginTop: 14 }} onClick={() => setView("calendar")}>Ver calendario</button></div>;
    if (trainPlan.error) return <div className="tpage"><p style={{ color: "var(--or)" }}>Error al generar el plan.</p><button className="btnp" style={{ marginTop: 14 }} onClick={() => genTrainPlan(trainPlan.race)}>Reintentar</button></div>;
    const { semanas = [], consejos_generales = [], nutricion, calzado, race } = trainPlan;
    const sem = semanas[activeWeek] || {};
    const stColor = (t) => ({ "Recuperación":"#4CAF50","Intervalo":"#F44336","Long run":"#9C27B0","Tempo":"#FF9800","Fuerza":"#2196F3","Descanso":"#555","Rodaje":"#00BCD4" }[t] || "#FF9800");
    return (
      <div className="tpage">
        <button className="back" onClick={() => setView("race")}>← Carrera</button>
        <h1 className="ttitle">PLAN DE ENTRENAMIENTO</h1>
        <div className="trace">{race?.name} · {race?.distance}</div>
        {user && <div style={{ marginTop: 8 }}><span className="saved-badge">✓ Guardado en Firebase</span></div>}
        <div className="wtabs">{semanas.map((s, i) => <button key={i} className={`wtab ${activeWeek===i?"act":""}`} onClick={() => setActiveWeek(i)}>Sem {s.numero}</button>)}</div>
        {sem.sesiones && (
          <div className="wcont">
            <div className="wobj"><strong>Objetivo:</strong> {sem.objetivo}</div>
            {sem.sesiones.map((s,i) => (
              <div key={i} className="srow">
                <span className="sday">{s.dia}</span>
                <span className="styp" style={{ background: stColor(s.tipo)+"22", color: stColor(s.tipo) }}>{s.tipo}</span>
                <span className="sdist">{s.distancia}</span>
                <span className="sdesc">{s.descripcion} <span style={{ color: "var(--or)", fontWeight: 600 }}>{s.ritmo}</span></span>
              </div>
            ))}
            {sem.consejo && <div className="wtip">💡 {sem.consejo}</div>}
          </div>
        )}
        <div className="extras">
          {consejos_generales.length > 0 && <div className="exc"><div className="ext">✅ Consejos</div><ul style={{ paddingLeft: 14, display: "flex", flexDirection: "column", gap: 5 }}>{consejos_generales.map((c,i)=><li key={i} className="exd">{c}</li>)}</ul></div>}
          {nutricion && <div className="exc"><div className="ext">🍽️ Nutrición</div><div className="exd">{nutricion}</div></div>}
          {calzado && <div className="exc"><div className="ext">👟 Calzado</div><div className="exd">{calzado}</div></div>}
        </div>
      </div>
    );
  };

  const renderPostRace = () => (
    <div className="prpage">
      <button className="back" onClick={() => setView("home")}>← Inicio</button>
      <h1 className="ptitle">ANÁLISIS <span style={{ color: "var(--or)" }}>POST-CARRERA</span></h1>
      <p className="psub">Subí una foto de tu resultado, captura de Strava/Garmin, o foto de la llegada.</p>
      {!user && <div style={{ background: "rgba(255,69,0,.08)", border: "1px solid rgba(255,69,0,.2)", borderRadius: "8px", padding: "12px 16px", marginBottom: 18, fontSize: ".82rem", color: "var(--mu)" }}>
        💡 <button style={{ background: "none", border: "none", color: "var(--or)", cursor: "pointer", fontWeight: 700, padding: 0 }} onClick={() => setShowAuth(true)}>Iniciá sesión</button> para guardar tus análisis en Firebase.
      </div>}
      <input type="file" ref={fileRef} accept="image/*" style={{ display: "none" }} onChange={e => handlePhotoSelect(e.target.files[0])} />
      <div className={`dropzone ${prPhoto ? "has" : ""}`} onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handlePhotoSelect(e.dataTransfer.files[0]); }}>
        {prPreview ? (<><img src={prPreview} alt="Preview" className="dropimg" /><div style={{ marginTop: 10, fontSize: ".8rem", color: "var(--or)", fontWeight: 600 }}>📷 Hacé click para cambiar</div></>) : (<><span className="dropico">📸</span><div className="droptxt">Arrastrá tu foto aquí o hacé click para seleccionar</div><div style={{ fontSize: ".75rem", color: "var(--mu)", marginTop: 6 }}>JPG, PNG, WEBP</div></>)}
      </div>
      {prPhoto && !prAnalysis && <button className="btnp" style={{ width: "100%", padding: 14 }} onClick={analyzeRace} disabled={prLoading}>{prLoading ? "Analizando con IA..." : "🤖 Analizar con PaceAI"}</button>}
      {prLoading && <div className="lcenter" style={{ padding: "40px 0" }}><div className="spin"/><div className="ltxt" style={{ fontSize: "1rem" }}>Analizando...</div></div>}
      {prAnalysis && (
        <div className="analysis">
          <h3>📊 Análisis de PaceAI</h3>
          {savingPR && <div style={{ fontSize: ".78rem", color: "var(--or)", marginBottom: 10 }}>☁️ Guardando en Firebase...</div>}
          <p>{prAnalysis}</p>
          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <button className="btnp" onClick={() => { setPrPhoto(null); setPrPreview(null); setPrAnalysis(null); }}>Analizar otra foto</button>
            <button className="btns" onClick={() => sendMsg(`Acabo de analizar mi carrera: "${prAnalysis.slice(0,200)}..." ¿Qué me recomendás para mejorar?`)}>Hablar con el coach →</button>
          </div>
        </div>
      )}
      {prHistory.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h3 style={{ fontFamily: "var(--fd)", fontSize: "1.3rem", marginBottom: 12 }}>HISTORIAL <span style={{ color: "var(--or)" }}>EN FIREBASE</span></h3>
          {prHistory.map((h, i) => (
            <div key={i} className="hist-item">
              <div><div style={{ fontSize: ".8rem", color: "var(--or)", fontWeight: 600, marginBottom: 3 }}>{h.race || "Sin carrera"}</div><div className="hist-preview">{h.analysis?.slice(0, 120)}...</div></div>
              <div className="hist-date">{h.createdAt ? new Date(h.createdAt).toLocaleDateString("es-AR") : ""}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderTourism = () => (
    <div className="tourpage">
      <button className="back" onClick={() => setView("home")}>← Inicio</button>
      <h1 style={{ fontFamily: "var(--fd)", fontSize: "2rem", marginBottom: 6 }}>GUÍA <span style={{ color: "var(--or)" }}>TURÍSTICA</span></h1>
      <p style={{ color: "var(--mu)", fontSize: ".88rem", marginBottom: 24 }}>Hoteles, restaurantes y logística cerca de cada carrera.</p>
      <div className="tour-select">
        <div className="tour-label">Seleccioná la carrera</div>
        <div className="race-pills">
          {RACES.map(r => <button key={r.id} className={`rpill ${tourRace?.id === r.id ? "sel" : ""}`} onClick={() => loadTourism(r)}>{r.image} {r.name}</button>)}
        </div>
      </div>
      {tourRace && (
        <>
          <div className="tour-cards">
            {[["📍","Zona de largada",tourRace.tourism.zone],["🏨","Hoteles",tourRace.tourism.hotel_zone],["🚗","Estacionamiento",tourRace.tourism.parking],["🚇","Transporte",tourRace.tourism.metro],["🎭","Para ver cerca",tourRace.tourism.cultural]].map(([ic,n,d]) => (
              <div key={n} className="tc"><div className="tci">{ic}</div><div className="tcn">{n}</div><div className="tcd">{d}</div></div>
            ))}
          </div>
          {tourLoading && <div className="lcenter" style={{ padding: "40px 0" }}><div className="spin"/><div className="ltxt" style={{ fontSize: "1rem" }}>Generando guía completa...</div></div>}
          {tourAI && <div className="ai-tour"><h3>🤖 Guía completa de PaceAI</h3><p>{tourAI}</p><button className="btns" style={{ marginTop: 16 }} onClick={() => { setView("coach"); sendMsg(`Necesito más info logística para la ${tourRace.name}.`); }}>Hacer más preguntas →</button></div>}
        </>
      )}
      {!tourRace && <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--mu)" }}><div style={{ fontSize: "2rem", marginBottom: 10 }}>🗺️</div><div>Seleccioná una carrera arriba</div></div>}
    </div>
  );

  const VIEWS = { home: renderHome, calendar: renderCalendar, race: renderRace, profile: renderProfile, plans: renderPlans, coach: renderCoach, training: renderTraining, postrace: renderPostRace, tourism: renderTourism };

  return (
    <div className="app">
      <style>{CSS}</style>
      {showAuth && (
        <AuthModal
          authTab={authTab}
          setAuthTab={(tab) => { setAuthTab(tab); setAuthErr(""); }}
          authForm={authForm}
          setAuthForm={setAuthForm}
          authLoading={authLoading}
          authErr={authErr}
          doAuth={doAuth}
          onClose={() => setShowAuth(false)}
        />
      )}
      <nav className="nav">
        <div className="logo" onClick={() => setView("home")}>PACE<span>AI</span></div>
        <div className="nav-links">
          {[["home","Inicio"],["calendar","Carreras"],["tourism","Turismo"],["postrace","Post-carrera"],["plans","Planes"],["coach","PaceAI 🤖"]].map(([id,lb]) => (
            <button key={id} className={`nl ${view===id?"act":""}`} onClick={() => setView(id)}>{lb}</button>
          ))}
        </div>
        <div className="nav-r">
          {user ? (
            <button className="ava" onClick={() => setView("profile")} title={user.email}>{user.email[0].toUpperCase()}</button>
          ) : (
            <>
              <button className="nav-btn" style={{ background: "transparent", color: "var(--or)", border: "1px solid var(--or)" }} onClick={() => setShowAuth(true)}>Ingresar</button>
              <button className="nav-btn" onClick={() => setView("profile")}>Mi perfil</button>
            </>
          )}
        </div>
      </nav>
      <main>{(VIEWS[view] || VIEWS.home)()}</main>
    </div>
  );
}