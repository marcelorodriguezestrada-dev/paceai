import { useState, useEffect, useRef } from "react";
import CalendarTimeline from "./components/CalendarTimeline";
import AdminPanel from "./components/AdminPanel";
import DailyCoach from "./components/DailyCoach";
import { buildMultiRacePrompt, buildRecalibrationPrompt, mergeRecalibratedWeeks } from "./utils/multiRace";

const FB = {
  apiKey: import.meta.env.VITE_FB_API_KEY || "TU_API_KEY",
  projectId: import.meta.env.VITE_FB_PROJECT_ID || "TU_PROJECT_ID",
  bucket: import.meta.env.VITE_FB_BUCKET || "TU_PROJECT_ID.appspot.com",
};

const fbRegister = async (email, password) => {
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FB.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return {
    uid: d.localId,
    email: d.email,
    token: d.idToken,
    refreshToken: d.refreshToken,
  };
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
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FB.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return {
    uid: d.localId,
    email: d.email,
    token: d.idToken,
    refreshToken: d.refreshToken,
  };
};

const fbRefreshToken = async (refreshToken) => {
  const r = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${FB.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
    },
  );
  const d = await r.json();
  if (d.error)
    throw new Error(d.error.message || "No se pudo refrescar el token.");
  return {
    uid: d.user_id,
    token: d.id_token,
    refreshToken: d.refresh_token,
    email: d.email || null,
  };
};

const toFS = (obj) => ({
  fields: Object.fromEntries(
    Object.entries(obj).map(([k, v]) => {
      if (v === null || v === undefined) return [k, { nullValue: null }];
      if (typeof v === "boolean") return [k, { booleanValue: v }];
      if (typeof v === "number") return [k, { doubleValue: v }];
      if (typeof v === "object") return [k, { stringValue: JSON.stringify(v) }];
      return [k, { stringValue: String(v) }];
    }),
  ),
});

const fromFS = (doc) =>
  doc?.fields
    ? Object.fromEntries(
        Object.entries(doc.fields).map(([k, v]) => {
          const val =
            v.stringValue ??
            v.integerValue ??
            v.doubleValue ??
            v.booleanValue ??
            null;
          try {
            return [k, JSON.parse(val)];
          } catch {
            return [k, val];
          }
        }),
      )
    : null;

const fsBase = (col, doc = "") =>
  `https://firestore.googleapis.com/v1/projects/${FB.projectId}/databases/(default)/documents/${col}${doc ? "/" + doc : ""}`;

const fbSet = async (collection, docId, data, token) => {
  const r = await fetch(`${fsBase(collection, docId)}?key=${FB.apiKey}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(toFS(data)),
  });
  return r.json();
};

const fbDelete = async (collection, docId, token) => {
  const r = await fetch(`${fsBase(collection, docId)}?key=${FB.apiKey}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return r.json();
};

const fbGet = async (collection, docId, token) => {
  const r = await fetch(`${fsBase(collection, docId)}?key=${FB.apiKey}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const d = await r.json();
  return fromFS(d);
};

const fbList = async (collection, token) => {
  const r = await fetch(`${fsBase(collection)}?key=${FB.apiKey}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const d = await r.json();
  return (d.documents || []).map((doc) => ({
    id: doc.name.split("/").pop(),
    ...fromFS(doc),
  }));
};

const fbUpload = async (path, file, token) => {
  const r = await fetch(
    `https://firebasestorage.googleapis.com/v0/b/${FB.bucket}/o?uploadType=media&name=${encodeURIComponent(path)}`,
    {
      method: "POST",
      headers: { "Content-Type": file.type, Authorization: `Bearer ${token}` },
      body: file,
    },
  );
  const d = await r.json();
  return `https://firebasestorage.googleapis.com/v0/b/${FB.bucket}/o/${encodeURIComponent(path)}?alt=media&token=${d.downloadTokens}`;
};

const fileToBase64 = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

const RACES = [
  {
    id: 1,
    name: "10K Palermo Classic",
    date: "2025-07-13",
    distance: "10K",
    location: "Parque Tres de Febrero, CABA",
    terrain: "asfalto plano",
    weather: "invierno",
    difficulty: "fácil",
    image: "🏃",
    registered: 3200,
    prize: "Medalla + remera técnica",
    tourism: {
      zone: "Palermo",
      hotel_zone: "Palermo Soho / Las Cañitas",
      parking: "Av. del Libertador y Av. Sarmiento",
      metro: "D - Palermo",
      cultural: "MALBA, Planetario, Jardín Japonés",
    },
  },
  {
    id: 2,
    name: "Media Maratón de Buenos Aires",
    date: "2025-08-17",
    distance: "21K",
    location: "Av. Figueroa Alcorta, CABA",
    terrain: "asfalto mixto",
    weather: "invierno tardío",
    difficulty: "moderado",
    image: "🌆",
    registered: 8500,
    prize: "Medalla finisher + cronometraje",
    tourism: {
      zone: "Recoleta / Palermo",
      hotel_zone: "Recoleta, Retiro o Palermo",
      parking: "Playa Figueroa Alcorta o Costa Salguero",
      metro: "D - Facultad de Medicina",
      cultural: "Cementerio de la Recoleta, Floralis Genérica, MUBA",
    },
  },
  {
    id: 3,
    name: "5K Nocturna del Rosedal",
    date: "2025-09-06",
    distance: "5K",
    location: "Jardín Japonés, CABA",
    terrain: "caminos de tierra",
    weather: "primavera",
    difficulty: "fácil",
    image: "🌙",
    registered: 1800,
    prize: "Medalla iluminada",
    tourism: {
      zone: "Palermo",
      hotel_zone: "Palermo Hollywood / Soho",
      parking: "Av. Casares o Av. del Libertador",
      metro: "D - Palermo",
      cultural: "Planetario (noche), Bosques de Palermo, Rosedal",
    },
  },
  {
    id: 4,
    name: "Maratón de Buenos Aires",
    date: "2025-10-19",
    distance: "42K",
    location: "Obelisco — Av. Corrientes",
    terrain: "asfalto con adoquines",
    weather: "primavera cálida",
    difficulty: "avanzado",
    image: "🏆",
    registered: 12000,
    prize: "Medalla + camiseta oficial",
    tourism: {
      zone: "Centro / San Telmo / Puerto Madero",
      hotel_zone: "Microcentro, San Telmo o Puerto Madero",
      parking: "Subterráneo Catalinas, Retiro",
      metro: "B - Callao, C - Diagonal Norte",
      cultural: "Caminito, Feria de San Telmo, Teatro Colón, Puerto Madero",
    },
  },
  {
    id: 5,
    name: "21K Villa del Parque",
    date: "2025-11-02",
    distance: "21K",
    location: "Parque del Centenario, CABA",
    terrain: "circuito urbano",
    weather: "primavera",
    difficulty: "moderado",
    image: "🌳",
    registered: 4200,
    prize: "Finisher kit completo",
    tourism: {
      zone: "Villa del Parque / Caballito",
      hotel_zone: "Caballito o Villa del Parque",
      parking: "Av. Ángel Gallardo al 700",
      metro: "B - Ángel Gallardo",
      cultural: "Parque del Centenario, Planetario, Feria de coleccionistas",
    },
  },
  {
    id: 6,
    name: "Trail Sierra Ventana",
    date: "2025-11-30",
    distance: "30K",
    location: "Sierra de la Ventana, Bs. As.",
    terrain: "montaña y senderos",
    weather: "verano inicial",
    difficulty: "avanzado",
    image: "⛰️",
    registered: 900,
    prize: "Trofeo artesanal + experiencia única",
    tourism: {
      zone: "Sierra de la Ventana (600km de CABA)",
      hotel_zone: "Villa Ventana, Tornquist o Sierra de la Ventana pueblo",
      parking: "Club Atlético Sierra de la Ventana",
      metro: "No aplica — tren desde Constitución o auto",
      cultural:
        "Cerro Tres Picos, Cueva de las Pinturas Rupestres, La Ventana pueblo",
    },
  },
];

const ENGINES = [
  {
    id: "llm",
    name: "LLM estándar",
    description: "Rápido y gratis para ideas generales",
    model: "llama-3.3-70b-versatile",
  },
  {
    id: "dedicated",
    name: "Modelo dedicado",
    description: "Más preciso para planes de entrenamiento",
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
  },
];

const PLANS = [
  {
    id: "basico",
    name: "BÁSICO",
    price: "Gratis",
    amount: 0,
    color: "#555",
    accent: "#999",
    features: [
      "Hasta 3 carreras registradas",
      "1 mes de plan de entrenamiento",
      "Resumen semanal de actividades",
      "Calendario de carreras BA",
      "Acceso comunidad básica",
    ],
    cta: "Comenzar gratis",
  },
  {
    id: "ilimitado",
    name: "ILIMITADO",
    price: "$4.990/mes",
    amount: 4990,
    color: "#FF4500",
    accent: "#FF6B35",
    features: [
      "Carreras ilimitadas",
      "Coaching en nutrición y alimentación",
      "Gestión del esfuerzo por etapas",
      "Análisis post-carrera con fotos",
      "Guía turística por sede de carrera",
      "Chat con IA sin límites",
    ],
    cta: "Activar plan",
    popular: true,
  },
  {
    id: "experto",
    name: "EXPERTO",
    price: "$9.990/mes",
    amount: 9990,
    color: "#FFD700",
    accent: "#FFF176",
    features: [
      "Todo lo anterior",
      "Métricas avanzadas: VO2Max, lactato",
      "Planes por ritmo (pace) personalizado",
      "Análisis biomecánico por video",
      "Sesiones 1:1 con coach humano",
      "Acceso a biblioteca de corredores élite",
    ],
    cta: "Quiero optimizar",
  },
];

const diffColor = {
  fácil: "#4CAF50",
  moderado: "#FF9800",
  avanzado: "#FF4500",
};

// ─── Pace zones + Macrocycle helpers (Metodología Ortiguera / Rodríguez) ──────
const parseTime1600 = (str) => {
  if (!str || !String(str).trim()) return null;
  const s = String(str).trim();
  if (s.includes(":")) {
    const [m, sec] = s.split(":").map(Number);
    return m * 60 + (sec || 0);
  }
  return parseFloat(s) || null;
};

const calcPaceZones = (time1600Str) => {
  const secs = parseTime1600(time1600Str);
  if (!secs || secs <= 0) return null;
  const p = secs / 1.6;
  const fmt = (s) =>
    `${Math.floor(s / 60)}:${Math.round(s % 60)
      .toString()
      .padStart(2, "0")}/km`;
  return {
    recovery: fmt(p * 1.45),
    easy: fmt(p * 1.3),
    long_run: fmt(p * 1.25),
    tempo: fmt(p * 1.1),
    interval_1k: fmt(p * 1.0),
    interval_400: fmt(p * 0.95),
    race_10k: fmt(p * 1.05),
    race_21k: fmt(p * 1.12),
    race_42k: fmt(p * 1.22),
  };
};

const calcMacrocycle = (weeksAvailable, distanceStr) => {
  const dist = (distanceStr || "").toLowerCase();
  const is42 = dist.includes("42");
  if (weeksAvailable >= 12) {
    const base = Math.round(weeksAvailable * 0.34);
    const spec = Math.round(weeksAvailable * 0.33);
    const sharp = Math.round(weeksAvailable * 0.17);
    const taper = Math.max(1, weeksAvailable - base - spec - sharp);
    return [
      {
        fase: "Base / Fuerza",
        semanas: base,
        enfoque: "Fondo largo progresivo + cuestas + fuerza core",
        volMin: is42 ? 55 : 40,
        volMax: is42 ? 75 : 60,
      },
      {
        fase: "Específica",
        semanas: spec,
        enfoque: "Intervalos (1K–4K) + Tempo + Fartlek + progresivos",
        volMin: is42 ? 65 : 50,
        volMax: is42 ? 90 : 75,
      },
      {
        fase: "Sharpening",
        semanas: sharp,
        enfoque: "Velocidad punta + reducción gradual de volumen",
        volMin: is42 ? 45 : 35,
        volMax: is42 ? 65 : 55,
      },
      {
        fase: "Tapering",
        semanas: taper,
        enfoque: "Trote suave + elongación + preparación mental",
        volMin: is42 ? 25 : 18,
        volMax: is42 ? 45 : 32,
      },
    ];
  } else if (weeksAvailable >= 8) {
    return [
      {
        fase: "Base / Fuerza",
        semanas: 2,
        enfoque: "Fondo + cuestas + fuerza core",
        volMin: 35,
        volMax: 55,
      },
      {
        fase: "Específica",
        semanas: Math.max(3, weeksAvailable - 5),
        enfoque: "Series + Tempo",
        volMin: 45,
        volMax: 65,
      },
      {
        fase: "Sharpening",
        semanas: 2,
        enfoque: "Velocidad + reducción",
        volMin: 30,
        volMax: 48,
      },
      {
        fase: "Tapering",
        semanas: 1,
        enfoque: "Descanso activo",
        volMin: 18,
        volMax: 28,
      },
    ];
  } else {
    return [
      {
        fase: "Activación",
        semanas: Math.max(1, Math.floor(weeksAvailable * 0.4)),
        enfoque: "Fondo suave + fuerza básica",
        volMin: 28,
        volMax: 45,
      },
      {
        fase: "Específica compacta",
        semanas: Math.max(1, Math.round(weeksAvailable * 0.4)),
        enfoque: "Series cortas + Tempo",
        volMin: 35,
        volMax: 52,
      },
      {
        fase: "Tapering",
        semanas: Math.max(1, Math.ceil(weeksAvailable * 0.2)),
        enfoque: "Descanso + preparación mental",
        volMin: 15,
        volMax: 28,
      },
    ];
  }
};

const validateGoalPace = (profile, race) => {
  if (!profile?.goalTime || !profile?.time1600) return null;
  const dist = (race?.distance || "").toLowerCase();
  const distKm = dist.includes("42")
    ? 42.2
    : dist.includes("21")
      ? 21.1
      : dist.includes("10")
        ? 10
        : 5;
  const parts = String(profile.goalTime).split(":").map(Number);
  let goalSecs = 0;
  if (parts.length === 3)
    goalSecs = parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
  else if (parts.length === 2) goalSecs = parts[0] * 60 + (parts[1] || 0);
  else return null;
  const goalPace = goalSecs / distKm;
  const secs1600 = parseTime1600(profile.time1600);
  if (!secs1600) return null;
  const pace1km = secs1600 / 1.6;
  const minPace =
    pace1km * (dist.includes("42") ? 1.18 : dist.includes("21") ? 1.1 : 1.04);
  if (goalPace < minPace) {
    const fmt = (s) =>
      `${Math.floor(s / 60)}:${Math.round(s % 60)
        .toString()
        .padStart(2, "0")}/km`;
    return `⚠️ Tu objetivo de ${fmt(goalPace)} parece muy ambicioso para tu marca actual. Un ritmo más realista sería ~${fmt(minPace)}.`;
  }
  return null;
};

const buildPlanPrompt = (
  race,
  profile,
  weeksAvailable,
  macrocycle,
  paceZones,
) => {
  const dist = (race?.distance || "").toLowerCase();
  const is42 = dist.includes("42");
  const is21 = dist.includes("21");
  const longRunPeak = is42 ? "32-35km" : is21 ? "24-26km" : "15-18km";
  const totalSemanas = macrocycle.reduce((acc, f) => acc + f.semanas, 0);
  let semOffset = 1;
  const macroStr = macrocycle
    .map((f) => {
      const inicio = semOffset;
      semOffset += f.semanas;
      return `  Fase: ${f.fase} (semanas ${inicio}-${semOffset - 1}) — ${f.enfoque} — ${f.volMin}-${f.volMax}km/semana`;
    })
    .join("\n");
  const paceStr = paceZones
    ? `RITMOS CALCULADOS PARA ESTE ATLETA:\n  Recuperación: ${paceZones.recovery} | Fácil: ${paceZones.easy} | Fondo largo: ${paceZones.long_run}\n  Tempo: ${paceZones.tempo} | Intervalos 1K: ${paceZones.interval_1k} | Intervalos 400m: ${paceZones.interval_400}\n  Ritmo objetivo carrera: ${is42 ? paceZones.race_42k : is21 ? paceZones.race_21k : paceZones.race_10k}`
    : "Sin marca de tiempo — usá ritmos apropiados para el nivel del corredor.";
  const profileStr = profile
    ? `CORREDOR: ${profile.name || "sin nombre"} | Nivel: ${profile.level || "principiante"} | ${profile.age ? profile.age + " años" : ""} | ${profile.weight ? profile.weight + "kg" : ""} | ${profile.height ? profile.height + "cm" : ""} | ${profile.days || 4} días/semana | Ritmo de vida: ${profile.lifeRhythm || "moderado"} | Alimentación: ${profile.alimentacion || "sin restricciones"}${profile.goalTime ? " | Tiempo objetivo: " + profile.goalTime : ""}`
    : "CORREDOR: perfil no disponible, adaptar para principiante";
  return `Sos PaceAI, coach de running que aplica la metodología del Prof. Diego Ortiguera y los planes de Marcelo Rodríguez (maratonista élite argentino). Generás macrociclos periodizados, NO planes genéricos.

CARRERA: ${race.name} · ${race.distance} · Fecha: ${race.date} · Terreno: ${race.terrain} · Clima: ${race.weather}
SEMANAS DISPONIBLES: ${weeksAvailable} semanas
${profileStr}
${paceStr}

MACROCICLO PERIODIZADO (${totalSemanas} semanas — respetá esta estructura):
${macroStr}

REGLAS METODOLÓGICAS OBLIGATORIAS (Ortiguera/Rodríguez):
1. FONDO LARGO: siempre el sábado, progresivo, llega a ${longRunPeak} en el pico
2. CALIDAD: sesiones de intervalos/tempo/fartlek el martes y/o jueves
3. DESCANSO: domingo post-fondo, lunes descanso activo o muy suave
4. CALENTAMIENTO: 10-15' trote suave antes de cada sesión de calidad (obligatorio)
5. VUELTA A LA CALMA: 10' trote suave al finalizar cualquier sesión dura
6. FUERZA CORE: abdominales + espinales 15-20min, mínimo 3x semana (marcar core:true)
7. ELONGACIÓN: siempre al final, especialmente después del fondo largo
8. CUESTAS: obligatorias en Fase Base (6-10 reps de 100-200m)
9. PROGRESIÓN: máximo +10% volumen por semana; reducir en sharpening y tapering
10. SERIES por fase — Base: cuestas/fartlek/progresivos · Específica: 1000-4000m · Sharpening: 400-1000m rápidos

RESPONDÉ ÚNICAMENTE CON JSON VÁLIDO SIN MARKDOWN:
{
  "macrociclo": [{"fase":"string","semanas_inicio":1,"semanas_fin":4,"objetivo":"string"}],
  "semanas": [{
    "numero":1,
    "fase":"Base / Fuerza",
    "objetivo":"string",
    "volumen_km":"45",
    "sesiones":[
      {"dia":"Lunes","tipo":"Descanso","distancia":"-","ritmo":"-","descripcion":"Descanso activo + elongación 10min","core":false},
      {"dia":"Martes","tipo":"Calidad","distancia":"10km","ritmo":"string","descripcion":"10' suaves + [sesión específica] + 10' suaves + core 15min + elongación","core":true},
      {"dia":"Miércoles","tipo":"Rodaje","distancia":"8km","ritmo":"string","descripcion":"Trote fácil + elongación","core":false},
      {"dia":"Jueves","tipo":"Calidad","distancia":"10km","ritmo":"string","descripcion":"10' suaves + [sesión específica] + 10' suaves + core","core":true},
      {"dia":"Viernes","tipo":"Descanso","distancia":"-","ritmo":"-","descripcion":"Descanso o caminata suave","core":false},
      {"dia":"Sábado","tipo":"Fondo Largo","distancia":"18km","ritmo":"string","descripcion":"Fondo suave progresivo + elongación completa post-fondo","core":false},
      {"dia":"Domingo","tipo":"Descanso","distancia":"-","ritmo":"-","descripcion":"Descanso total. Hidratación y nutrición de recuperación.","core":false}
    ],
    "consejo":"string"
  }],
  "consejos_generales":["string"],
  "nutricion":"string",
  "calzado":"string",
  "validacion":"Observación del coach sobre el objetivo y el perfil del atleta"
}
Generá exactamente ${totalSemanas} semanas. Cada semana DEBE incluir los 7 días (incluso los de descanso).`;
};
const daysUntil = (d) => Math.ceil((new Date(d) - new Date()) / 86400000);
const coachPrompt = (
  profile,
) => `Sos PaceAI, el coach de running más avanzado de Argentina. Tenés el conocimiento técnico de Jack Daniels, la filosofía de Murakami sobre correr, y la calidez de un entrenador porteño.
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

function AuthModal({
  authTab,
  setAuthTab,
  authForm,
  setAuthForm,
  authLoading,
  authErr,
  doAuth,
  onClose,
}) {
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="mclose" onClick={onClose}>
          ✕
        </button>
        <h2>
          BIENVENIDO<span style={{ color: "var(--or)" }}>.</span>
        </h2>
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
            onChange={(e) =>
              setAuthForm((prev) => ({ ...prev, email: e.target.value }))
            }
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
            onChange={(e) =>
              setAuthForm((prev) => ({ ...prev, password: e.target.value }))
            }
            onKeyDown={(e) => e.key === "Enter" && doAuth()}
            autoComplete={
              authTab === "login" ? "current-password" : "new-password"
            }
          />
        </div>
        <button
          className="btnp"
          style={{ width: "100%", padding: 14, marginTop: 4 }}
          onClick={doAuth}
          disabled={authLoading}
        >
          {authLoading
            ? "Cargando..."
            : authTab === "login"
              ? "Ingresar"
              : "Crear cuenta"}
        </button>
        {authErr && <div className="ferr">{authErr}</div>}
        <p
          style={{
            textAlign: "center",
            color: "var(--mu)",
            fontSize: ".75rem",
            marginTop: 16,
          }}
        >
          Datos guardados en Firebase · Gratis
        </p>
      </div>
    </div>
  );
}

function RaceCard({ race, onClick }) {
  const days = daysUntil(race.date);
  const dateStr = new Date(race.date).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
  });
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
        <div className="rm">
          <span>📅</span>
          {dateStr}
        </div>
        <div className="rm">
          <span>📍</span>
          {race.location}
        </div>
        <div className="rm">
          <span>🏔️</span>
          {race.terrain} · {race.weather}
        </div>
      </div>
      <div className="rf">
        <span
          className="dbadge"
          style={{
            background: diffColor[race.difficulty] + "22",
            color: diffColor[race.difficulty],
          }}
        >
          {race.difficulty}
        </span>
        <span className="daybadge">
          {days > 0 ? `en ${days} días` : "¡Ya!"}
        </span>
      </div>
    </div>
  );
}

function PlanCard({ plan, onSelect, activePlanId }) {
  const isActive = activePlanId === plan.id;
  return (
    <div className={`pcard ${plan.popular ? "pop" : ""}`}>
      {plan.popular && <div className="pbadge">⭐ MÁS ELEGIDO</div>}
      <div className="pname" style={{ color: plan.color }}>
        {plan.name}
      </div>
      <div className="pprice" style={{ color: plan.accent }}>
        {plan.price}
      </div>
      {isActive && (
        <div style={{ marginBottom: 14, color: "var(--or)", fontWeight: 700 }}>
          Plan actual
        </div>
      )}
      <ul className="pfeats">
        {plan.features.map((f) => (
          <li key={f} className="pf">
            {f}
          </li>
        ))}
      </ul>
      <button
        className="pbtn"
        style={{
          background: plan.popular ? plan.color : "transparent",
          color: plan.popular ? "#fff" : plan.color,
          border: `1px solid ${plan.color}`,
          opacity: isActive ? 0.65 : 1,
          cursor: isActive ? "not-allowed" : "pointer",
        }}
        onClick={() => !isActive && onSelect(plan)}
        disabled={isActive}
      >
        {isActive ? "Plan activo" : plan.cta}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function RunnerAI() {
  const [view, setView] = useState("home");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [pForm, setPForm] = useState({
    name: "",
    age: "",
    weight: "",
    height: "",
    level: "principiante",
    goal: "",
    days: "4",
    time1600: "",
    lifeRhythm: "moderado",
    alimentacion: "sin_restricciones",
    goalTime: "",
  });
  const [onboardingStep, setOnboardingStep] = useState(0); // 0=off, 1=datos, 2=auth, 3=extra
  const [adjustCounts, setAdjustCounts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("paceai_adjust_counts") || "{}");
    } catch {
      return {};
    }
  });
  const [postRaceExtra, setPostRaceExtra] = useState({
    tiempo: "",
    sensacion: "3",
    comentarios: "",
  });
  const [selRace, setSelRace] = useState(null);
  // ── Multi-carrera ──────────────────────────────────────────────────────────
  const [selectedRaces, setSelectedRaces] = useState([]); // array de carreras seleccionadas
  const [isMultiRaceMode, setIsMultiRaceMode] = useState(false);
  const [recalibrating, setRecalibrating] = useState(false);
  const [recalibrationData, setRecalibrationData] = useState(null); // diagnóstico y ajuste post-carrera
  const [planStartDate, setPlanStartDate] = useState(new Date()); // fecha inicio del plan
  const [adjustedSession, setAdjustedSession] = useState(null); // sesión ajustada por el coach diario
  // ──────────────────────────────────────────────────────────────────────────
  const [selPlan, setSelPlan] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState("");
  const [activeSubscription, setActiveSubscription] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [aiEngine, setAiEngine] = useState("llm");
  const [autoUpdatePlan, setAutoUpdatePlan] = useState(false);
  const freePlansLimit = 3;
  const freePlansUsed = plans.length;
  const freePlansRemaining = Math.max(0, freePlansLimit - freePlansUsed);
  const currentPlanId = user ? activeSubscription?.planId || "basico" : null;
  const currentEngine = ENGINES.find((e) => e.id === aiEngine) || ENGINES[0];
  const [autoGenerateAfterAuth, setAutoGenerateAfterAuth] = useState(false);
  const [paymentPendingData, setPaymentPendingData] = useState(null);
  const [msgs, setMsgs] = useState([
    {
      role: "assistant",
      content:
        "¡Hola! Soy PaceAI 🏃 Tu coach personal para las carreras de Buenos Aires. ¿Sobre qué querés charlar? Puedo armarte un plan, hablarte de nutrición o prepararte para tu próxima competencia.",
    },
  ]);
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

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const restoreUser = async () => {
      const savedUserRaw = window.localStorage.getItem("paceai_user");
      const savedProfile = window.localStorage.getItem("paceai_profile");
      if (savedProfile) {
        try {
          const parsed = JSON.parse(savedProfile);
          setProfile(parsed);
          setPForm(parsed);
        } catch {}
      }
      if (savedUserRaw) {
        try {
          let savedUser = JSON.parse(savedUserRaw);
          if (savedUser.refreshToken) {
            try {
              const refreshed = await fbRefreshToken(savedUser.refreshToken);
              savedUser = {
                ...savedUser,
                ...refreshed,
                email: savedUser.email || refreshed.email,
              };
              window.localStorage.setItem(
                "paceai_user",
                JSON.stringify(savedUser),
              );
              setUser(savedUser);
            } catch (refreshError) {
              console.warn(
                "[auth] Token refresh failed, clearing saved session",
                refreshError,
              );
              window.localStorage.removeItem("paceai_user");
              // don't set user with expired token
            }
          } else {
            // no refresh token available, restore as-is
            setUser(savedUser);
          }

          const savedSubscription = window.localStorage.getItem(
            "paceai_subscription",
          );
          if (savedSubscription) {
            try {
              setActiveSubscription(JSON.parse(savedSubscription));
            } catch {}
          }
          const savedAutoUpdate = window.localStorage.getItem(
            "paceai_auto_update_plan",
          );
          if (savedAutoUpdate) {
            try {
              setAutoUpdatePlan(JSON.parse(savedAutoUpdate));
            } catch {}
          }
        } catch (err) {
          console.warn("[auth] restore parse failed", err);
        }
      }

      const params = new URLSearchParams(window.location.search);
      const payment = params.get("payment");
      const collectionId = params.get("collection_id");
      const preferenceId = params.get("preference_id");
      const planId = params.get("plan");
      const savedEngine = window.localStorage.getItem("paceai_engine");
      if (savedEngine && ENGINES.some((e) => e.id === savedEngine)) {
        setAiEngine(savedEngine);
      }

      if (payment === "success" && collectionId && planId) {
        setPaymentPendingData({ collectionId, preferenceId, planId });
        return;
      }

      if (payment === "failure")
        setPaymentError("Pago rechazado o cancelado. Intentá de nuevo.");
      else if (payment === "pending")
        setPaymentSuccess("Pago pendiente. Verificá tu medio de pago.");
    };

    restoreUser();
  }, []);

  useEffect(() => {
    if (!paymentPendingData || !user) return;
    verifyPayment(paymentPendingData);
  }, [paymentPendingData, user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("paceai_engine", aiEngine);
  }, [aiEngine]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "paceai_auto_update_plan",
      JSON.stringify(autoUpdatePlan),
    );
  }, [autoUpdatePlan]);

  useEffect(() => {
    if (!autoUpdatePlan || !user || !trainPlan || view !== "training") return;
    if (!trainPlan.race) return;
    genTrainPlan(trainPlan.race, user);
  }, [aiEngine]);

  const refreshUserData = async (currentUser) => {
    const p = await fbGet("users", currentUser.uid, currentUser.token).catch(
      () => null,
    );
    if (p) {
      setProfile(p);
      setPForm(p);
      if (typeof window !== "undefined")
        window.localStorage.setItem("paceai_profile", JSON.stringify(p));
    }
    const analyses = await fbList(
      `analyses_${currentUser.uid}`,
      currentUser.token,
    ).catch(() => []);
    setPrHistory(analyses.reverse().slice(0, 5));
    const subs = await fbList(
      `subscriptions_${currentUser.uid}`,
      currentUser.token,
    ).catch(() => []);
    const orderedSubs = subs.reverse();
    setSubscriptions(orderedSubs);
    const activeSub = orderedSubs.find((s) => s.status === "active") || null;
    setActiveSubscription(activeSub);
    if (typeof window !== "undefined") {
      if (activeSub)
        window.localStorage.setItem(
          "paceai_subscription",
          JSON.stringify(activeSub),
        );
      else window.localStorage.removeItem("paceai_subscription");
    }
    const savedPlans = await fbList(
      `plans_${currentUser.uid}`,
      currentUser.token,
    ).catch(() => []);
    setPlans(savedPlans.reverse());
  };

  useEffect(() => {
    if (!user) return;
    refreshUserData(user);
  }, [user]);

  const doAuth = async () => {
    if (!authForm.email || !authForm.password) {
      setAuthErr("Completá email y contraseña.");
      return;
    }
    setAuthErr("");
    setAuthLoading(true);
    try {
      const u =
        authTab === "login"
          ? await fbLogin(authForm.email, authForm.password)
          : await fbRegister(authForm.email, authForm.password);
      setUser(u);
      if (typeof window !== "undefined")
        window.localStorage.setItem("paceai_user", JSON.stringify(u));
      await refreshUserData(u);
      setShowAuth(false);
      setAuthForm({ email: "", password: "" });
      if (selPlan && selPlan.id !== "basico") {
        await buyPlan(selPlan);
      }
      // If user requested generation before auth, continue now
      if (autoGenerateAfterAuth && selRace) {
        setAutoGenerateAfterAuth(false);
        await handleGenerateClick(selRace, u);
      }
    } catch (e) {
      const msg = e.message
        .replace(
          "EMAIL_EXISTS",
          "Este email ya está registrado. Probá ingresar.",
        )
        .replace("INVALID_LOGIN_CREDENTIALS", "Email o contraseña incorrectos.")
        .replace(
          "WEAK_PASSWORD : Password should be at least 6 characters",
          "La contraseña debe tener al menos 6 caracteres.",
        )
        .replace("INVALID_EMAIL", "El email no es válido.")
        .replace(/_/g, " ");
      setAuthErr(msg);
    }
    setAuthLoading(false);
  };

  const saveProfile = async () => {
    if (!pForm.name || !pForm.age) return;
    setProfile(pForm);
    if (user) {
      await fbSet("users", user.uid, pForm, user.token).catch(() => null);
      if (typeof window !== "undefined")
        window.localStorage.setItem("paceai_profile", JSON.stringify(pForm));
    }
    if (autoUpdatePlan && user && trainPlan && trainPlan.race) {
      await genTrainPlan(trainPlan.race, user);
      setView("training");
      return;
    }
    setView("home");
  };

  const logout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("paceai_user");
      window.localStorage.removeItem("paceai_profile");
      window.localStorage.removeItem("paceai_subscription");
    }
    setUser(null);
    setProfile(null);
    setPlans([]);
    setActiveSubscription(null);
    setTrainPlan(null);
    setView("home");
  };

  // ─── Admin event tracking ──────────────────────────────────────────────
  const trackEvent = (eventName, data = {}) => {
    try {
      const event = {
        event: eventName,
        data: JSON.stringify(data),
        ts: new Date().toISOString(),
        view: view || "unknown",
        ua: (navigator?.userAgent || "").slice(0, 80),
        userId: user?.uid || "anonymous",
        userEmail: user?.email || "anonymous",
      };
      if (user?.token) {
        // Guardar en colección propia del usuario
        fbSet(`analytics_${user.uid}`, String(Date.now()), event, user.token).catch(() => {});
        // Guardar en colección global para el panel del autor
        fbSet("analytics_global", `${user.uid}_${Date.now()}`, event, user.token).catch(() => {});
      } else {
        const stored = JSON.parse(localStorage.getItem("paceai_events") || "[]");
        stored.push(event);
        localStorage.setItem("paceai_events", JSON.stringify(stored.slice(-30)));
      }
    } catch {}
  };

  const verifyPayment = async ({ collectionId, preferenceId, planId }) => {
    setPaymentError("");
    setPaymentSuccess("");
    setPaymentLoading(true);
    const plan = PLANS.find((p) => p.id === planId);
    if (!plan) {
      setPaymentError("Plan desconocido. No se puede validar el pago.");
      setPaymentLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/mercadopago-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collectionId,
          preferenceId,
          planId,
          expectedAmount: plan.amount,
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "No se pudo verificar el pago.");

      const subscription = {
        planId: plan.id,
        planName: plan.name,
        amount: plan.amount,
        currency: "ARS",
        status: "active",
        collectionId: data.collectionId,
        preferenceId: data.preferenceId,
        paymentType: data.paymentType,
        approvedAt: new Date().toISOString(),
      };

      if (user) {
        await fbSet(
          `subscriptions_${user.uid}`,
          String(data.collectionId),
          subscription,
          user.token,
        ).catch(() => null);
      }

      setActiveSubscription(subscription);
      setSubscriptions((prev) => [
        subscription,
        ...prev.filter((s) => s.collectionId !== subscription.collectionId),
      ]);
      if (typeof window !== "undefined")
        window.localStorage.setItem(
          "paceai_subscription",
          JSON.stringify(subscription),
        );
      setPaymentSuccess(`Pago aprobado y plan ${plan.name} activado.`);
      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", window.location.pathname);
        setPaymentPendingData(null);
      }
    } catch (err) {
      console.error("[verifyPayment]", err);
      setPaymentError(err.message || "No se pudo verificar el pago.");
    }
    setPaymentLoading(false);
  };

  const buyPlan = async (plan) => {
    if (!plan) return;
    setPaymentError("");
    setPaymentSuccess("");
    setPaymentLoading(true);
    try {
      const res = await fetch("/api/mercadopago", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          planName: plan.name,
          price: plan.amount,
          email: user?.email,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo iniciar el pago.");
      if (!data.init_point)
        throw new Error("No se recibió init_point de Mercado Pago.");
      window.location.href = data.init_point;
    } catch (err) {
      console.error("[buyPlan]", err);
      setPaymentError(err.message || "No se pudo iniciar el pago.");
    }
    setPaymentLoading(false);
  };

  const handlePlanSelect = async (plan) => {
    setSelPlan(plan);
    if (plan.id === "basico") {
      setPaymentSuccess("Seleccionaste el plan gratis. ¡A disfrutar!");
      return setView("plans");
    }
    if (activeSubscription && activeSubscription.planId === plan.id) {
      setPaymentSuccess(`Ya tenés el plan ${plan.name} activo.`);
      return setView("plans");
    }
    if (!user) {
      setShowAuth(true);
      return;
    }
    await buyPlan(plan);
  };

  const handleGenerateClick = async (race, currentUser = user) => {
    setSelRace(race);
    trackEvent("generate_click", { raceId: race.id, raceName: race.name });

    // If no basic profile data → go to onboarding wizard
    const hasMinProfile = !!(pForm.weight && pForm.height);
    if (!hasMinProfile) {
      setOnboardingStep(1);
      setView("onboarding");
      return;
    }

    // If profile exists but no login → go to auth step of onboarding
    if (!currentUser) {
      setOnboardingStep(2);
      setView("onboarding");
      return;
    }

    // Enforce freemium limit: 3 plans gratis
    if (!activeSubscription) {
      let saved = plans || [];
      if (saved.length < 3) {
        const remoteSaved = await fbList(
          `plans_${currentUser.uid}`,
          currentUser.token,
        ).catch(() => []);
        if (remoteSaved.length > saved.length) {
          setPlans(remoteSaved.reverse());
          saved = remoteSaved;
        }
      }
      if (saved.length >= 3) {
        setPaymentError(
          "Has alcanzado 3 planes gratis. Activá ILIMITADO para generar más.",
        );
        setView("plans");
        return;
      }
    }

    genTrainPlan(race, currentUser);
  };

  const sendMsg = async (txt) => {
    const text = txt || chatInput.trim();
    if (!text) return;
    const newMsgs = [...msgs, { role: "user", content: text }];
    setMsgs(newMsgs);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: coachPrompt(profile),
          messages: newMsgs,
        }),
      });
      const d = await res.json();
      setMsgs((p) => [
        ...p,
        {
          role: "assistant",
          content: d.content?.[0]?.text || "Error al responder.",
        },
      ]);
    } catch {
      setMsgs((p) => [
        ...p,
        { role: "assistant", content: "Error de conexión. Intentá de nuevo." },
      ]);
    }
    setChatLoading(false);
  };

  const genTrainPlan = async (race, currentUser = user) => {
    setGenPlan(true);
    setView("training");
    setActiveWeek(0);

    // Build structured macrocycle prompt (Ortiguera / Rodríguez methodology)
    const raceDate = new Date(race.date);
    const today = new Date();
    const weeksAvailable = Math.max(
      4,
      Math.ceil((raceDate - today) / (7 * 24 * 60 * 60 * 1000)),
    );
    const macrocycle = calcMacrocycle(weeksAvailable, race.distance);
    const activeProfile = pForm.weight ? pForm : profile;
    const paceZones = activeProfile?.time1600
      ? calcPaceZones(activeProfile.time1600)
      : null;
    const prompt = buildPlanPrompt(
      race,
      activeProfile,
      weeksAvailable,
      macrocycle,
      paceZones,
    );

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: currentEngine.model,
          max_tokens: 6000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const d = await res.json();

      let text =
        d?.content?.[0]?.text ||
        d?.choices?.[0]?.message?.content ||
        JSON.stringify(d || {});
      text = String(text || "")
        .replace(/```(?:json)?\n?|```/g, "")
        .trim();

      let jsonText = null;
      const objMatch = text.match(/\{[\s\S]*\}/);
      if (objMatch) jsonText = objMatch[0];
      else jsonText = text;

      let plan;
      try {
        plan = JSON.parse(jsonText);
      } catch (e) {
        console.error("[genTrainPlan] JSON parse failed:", e);
        throw e;
      }

      const full = { ...plan, race, weeksAvailable, paceZones, macrocycle };
      setTrainPlan(full);
      trackEvent("plan_generated", { raceId: race.id, weeks: weeksAvailable });

      if (currentUser) {
        const docId = `${race.id}_${Date.now()}`;
        const createdAt = new Date().toISOString();
        const record = {
          id: docId,
          race: JSON.stringify(race),
          plan: JSON.stringify(plan),
          createdAt,
        };
        await fbSet(
          `plans_${currentUser.uid}`,
          docId,
          record,
          currentUser.token,
        ).catch(() => null);
        setPlans((prev) => [{ id: docId, race, plan, createdAt }, ...prev]);
      }
    } catch (err) {
      console.error("[genTrainPlan] error:", err);
      setTrainPlan({ error: true, race });
      trackEvent("plan_error", { raceId: race.id });
    }
    setGenPlan(false);
  };

  // ── Generación de plan multi-carrera ──────────────────────────────────────
  const genMultiRacePlan = async (races, currentUser = user) => {
    if (!races || races.length === 0) return;
    setGenPlan(true);
    setView("training");
    setActiveWeek(0);
    setPlanStartDate(new Date());

    const activeProfile = pForm.weight ? pForm : profile;
    const paceZones = activeProfile?.time1600
      ? calcPaceZones(activeProfile.time1600)
      : null;
    const prompt = buildMultiRacePrompt(races, activeProfile, paceZones);
    const mainRace = [...races].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    )[races.length - 1];

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: currentEngine.model,
          max_tokens: 8000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const d = await res.json();
      let text =
        d?.content?.[0]?.text ||
        d?.choices?.[0]?.message?.content ||
        JSON.stringify(d || {});
      text = String(text || "")
        .replace(/```(?:json)?\n?|```/g, "")
        .trim();
      const objMatch = text.match(/\{[\s\S]*\}/);
      const plan = JSON.parse(objMatch ? objMatch[0] : text);

      const full = {
        ...plan,
        race: mainRace,
        races,
        isMultiRace: true,
        paceZones,
        weeksAvailable: plan.semanas?.length || 0,
      };
      setTrainPlan(full);
      setIsMultiRaceMode(true);
      trackEvent("multi_plan_generated", { raceCount: races.length });

      if (currentUser) {
        const docId = `multi_${Date.now()}`;
        const createdAt = new Date().toISOString();
        await fbSet(
          `plans_${currentUser.uid}`,
          docId,
          {
            id: docId,
            race: JSON.stringify(mainRace),
            races: JSON.stringify(races),
            plan: JSON.stringify(plan),
            createdAt,
            isMultiRace: true,
          },
          currentUser.token
        ).catch(() => null);
        setPlans((prev) => [
          { id: docId, race: mainRace, races, plan, createdAt, isMultiRace: true },
          ...prev,
        ]);
      }
    } catch (err) {
      console.error("[genMultiRacePlan] error:", err);
      setTrainPlan({ error: true, race: mainRace });
    }
    setGenPlan(false);
  };

  // ── Recalibración post-carrera control ───────────────────────────────────
  const recalibratePlan = async (controlRace, postRaceData) => {
    if (!trainPlan || !trainPlan.races) return;
    setRecalibrating(true);

    const mainRace = trainPlan.race;
    const remainingWeeks = trainPlan.semanas.length - activeWeek - 1;
    if (remainingWeeks <= 0) {
      setRecalibrating(false);
      return;
    }

    const activeProfile = pForm.weight ? pForm : profile;
    const prompt = buildRecalibrationPrompt(
      mainRace,
      controlRace,
      postRaceData,
      remainingWeeks,
      activeProfile,
      trainPlan
    );

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: currentEngine.model,
          max_tokens: 6000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const d = await res.json();
      let text =
        d?.content?.[0]?.text ||
        d?.choices?.[0]?.message?.content ||
        JSON.stringify(d || {});
      text = String(text || "")
        .replace(/```(?:json)?\n?|```/g, "")
        .trim();
      const objMatch = text.match(/\{[\s\S]*\}/);
      const result = JSON.parse(objMatch ? objMatch[0] : text);

      setRecalibrationData(result.recalibracion);
      const newPlan = mergeRecalibratedWeeks(
        trainPlan,
        result.semanas || [],
        activeWeek + 1
      );
      setTrainPlan(newPlan);
      trackEvent("plan_recalibrated", { controlRace: controlRace.name });
    } catch (err) {
      console.error("[recalibratePlan] error:", err);
    }
    setRecalibrating(false);
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: b64,
          imageType: prPhoto.type,
          system: `Sos PaceAI, coach de running argentino. Analizás fotos post-carrera. Hablás en español rioplatense, de vos a vos.`,
          text: `Analizá esta imagen post-carrera${profile ? ` del corredor ${profile.name} (nivel ${profile.level}, objetivo: "${profile.goal}")` : ""}.${postRaceExtra.tiempo ? ` Tiempo reportado: ${postRaceExtra.tiempo}.` : ""}${postRaceExtra.sensacion ? ` Sensación: ${postRaceExtra.sensacion}/5.` : ""}${postRaceExtra.comentarios ? ` Comentarios: "${postRaceExtra.comentarios}".` : ""} Si es resultado: extraé tiempo, pace, posición. Si es foto: comentá postura y esfuerzo. Terminá con: (1) puntaje 0-100%, (2) principal logro, (3) área a mejorar para el próximo plan.`,
        }),
      });
      const d = await res.json();
      const analysis = d.content?.[0]?.text || "No se pudo analizar.";
      setPrAnalysis(analysis);
      if (user) {
        setSavingPR(true);
        let photoUrl = null;
        try {
          photoUrl = await fbUpload(
            `photos/${user.uid}/${Date.now()}_${prPhoto.name}`,
            prPhoto,
            user.token,
          );
        } catch {}
        const record = {
          analysis,
          photoUrl: photoUrl || "",
          race: selRace?.name || "Sin carrera",
          tiempoFinal: postRaceExtra.tiempo || "",
          sensacion: postRaceExtra.sensacion || "",
          comentarios: postRaceExtra.comentarios || "",
          createdAt: new Date().toISOString(),
        };
        await fbSet(
          `analyses_${user.uid}`,
          String(Date.now()),
          record,
          user.token,
        ).catch(() => null);
        setPrHistory((p) => [record, ...p].slice(0, 5));
        setSavingPR(false);
      }
    } catch {
      setPrAnalysis(
        "Error al analizar. Verificá tu conexión e intentá de nuevo.",
      );
    }
    setPrLoading(false);
  };

  const loadTourism = async (race) => {
    setTourRace(race);
    setTourAI("");
    setTourLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `Guía turística completa para la "${race.name}" (${race.distance}) en ${race.location}. Incluí: 🍝 dónde comer la noche anterior (2-3 opciones con precio), 🏨 hoteles recomendados cerca (2-3), 🚗 estacionamiento y transporte público, 👨‍👩‍👧 qué hacer la familia mientras corro, 🎭 actividad cultural post-carrera, ⚡ 3 tips logísticos clave. Español rioplatense, concreto.`,
            },
          ],
        }),
      });
      const d = await res.json();
      setTourAI(d.content?.[0]?.text || "No se pudo cargar la guía.");
    } catch {
      setTourAI("Error al cargar. Verificá tu conexión.");
    }
    setTourLoading(false);
  };

  // ── VIEWS ──
  const renderHome = () => (
    <>
      <div className="hero">
        <div className="hero-bg" />
        <div className="hc">
          <div className="htag">IA de coaching · Buenos Aires · Firebase</div>
          <h1 className="htitle">
            CORRÉ
            <br />
            <span className="ac">MÁS INTELIGENTE</span>
          </h1>
          <p className="hsub">
            El primer coach de running con IA para corredores porteños. No solo
            un calendario — un sistema que te conoce, te entrena y aprende con
            vos.
          </p>
          <div className="hacts">
            <button className="btnp" onClick={() => setView("calendar")}>
              Ver carreras 2025
            </button>
            <button className="btns" onClick={() => setView("coach")}>
              Hablar con PaceAI
            </button>
          </div>
          {user && (
            <div
              style={{
                marginTop: 22,
                padding: 18,
                borderRadius: 14,
                background: "rgba(255,69,0,.06)",
                border: "1px solid rgba(255,69,0,.18)",
                color: "var(--tx)",
                maxWidth: 620,
              }}
            >
              <strong style={{ display: "block", marginBottom: 6 }}>
                Tu plan actual:
              </strong>
              {activeSubscription ? (
                <span>
                  {activeSubscription.planName} · {activeSubscription.currency}{" "}
                  {activeSubscription.amount.toLocaleString()} · activo
                </span>
              ) : (
                <span>BÁSICO gratis · hasta 3 carreras guardadas</span>
              )}
            </div>
          )}
          <div className="hstats">
            {[
              ["6+", "Carreras BA"],
              ["42K", "Maratón incluida"],
              ["3", "Niveles de plan"],
              ["24/7", "Coach IA"],
            ].map(([n, l]) => (
              <div key={l}>
                <div className="stn">{n}</div>
                <div className="stl">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="fstrip">
        <div className="fi">
          {[
            [
              "🧠",
              "IA adaptativa",
              "Planes que ajustan según clima, terreno y tu progreso",
            ],
            [
              "📅",
              "Calendario real",
              "Carreras de Buenos Aires con info completa",
            ],
            [
              "📸",
              "Post-carrera",
              "Subí tus fotos y la IA analiza tu desempeño",
            ],
            [
              "🗺️",
              "Guía turística",
              "Hoteles, restaurants y actividades por sede",
            ],
            ["🔥", "Firebase", "Datos guardados en la nube, gratis"],
          ].map(([ic, n, d]) => (
            <div key={n} className="fitm">
              <span className="ico">{ic}</span>
              <div className="fn">{n}</div>
              <div className="fd">{d}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="sec">
        <div className="sh">
          <h2 className="st">
            PRÓXIMAS <span>CARRERAS</span>
          </h2>
          <button className="sall" onClick={() => setView("calendar")}>
            Ver todas →
          </button>
        </div>
        <div className="rgrid">
          {RACES.slice(0, 3).map((r) => (
            <RaceCard
              key={r.id}
              race={r}
              onClick={() => {
                setSelRace(r);
                setView("race");
              }}
            />
          ))}
        </div>
      </div>
      <div className="sec" style={{ paddingTop: 0 }}>
        <div className="sh">
          <h2 className="st">
            ELEGÍ TU <span>PLAN</span>
          </h2>
        </div>
        <div className="pgrid">
          {PLANS.map((p) => (
            <PlanCard key={p.id} plan={p} onSelect={handlePlanSelect} />
          ))}
        </div>
      </div>
    </>
  );

  const renderCalendar = () => {
    const toggleRaceSelection = (race) => {
      setSelectedRaces((prev) => {
        const exists = prev.find((r) => r.id === race.id);
        if (exists) return prev.filter((r) => r.id !== race.id);
        return [...prev, race];
      });
    };

    const handleGenMultiRace = async () => {
      if (selectedRaces.length < 1) return;
      if (selectedRaces.length === 1) {
        handleGenerateClick(selectedRaces[0]);
        return;
      }
      // Verificar perfil
      const hasMinProfile = !!(pForm.weight && pForm.height);
      if (!hasMinProfile) {
        setOnboardingStep(1);
        setView("onboarding");
        return;
      }
      if (!user) {
        setOnboardingStep(2);
        setView("onboarding");
        return;
      }
      if (!activeSubscription && plans.length >= 3) {
        setPaymentError("Has alcanzado 3 planes gratis. Activá ILIMITADO para generar más.");
        setView("plans");
        return;
      }
      await genMultiRacePlan(selectedRaces, user);
    };

    return (
      <div className="pw">
        <button className="back" onClick={() => setView("home")}>
          ← Inicio
        </button>
        <div className="sh" style={{ marginBottom: 12 }}>
          <h1 className="st">
            CALENDARIO <span>2025</span>
          </h1>
        </div>

        {/* Banner de selección múltiple */}
        <div
          style={{
            background: "var(--bg2)",
            border: "1px solid var(--bd)",
            borderRadius: 12,
            padding: "14px 18px",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: ".72rem",
              color: "var(--or)",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 8,
            }}
          >
            Plan evolutivo multi-carrera
          </div>
          <p style={{ fontSize: ".85rem", color: "var(--mu)", marginBottom: 12 }}>
            Seleccioná <strong style={{ color: "var(--tx)" }}>una o más carreras</strong> para
            generar un plan unificado. Las intermedias se tratan como escalones de preparación,
            no como eventos aislados.
          </p>

          {selectedRaces.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: ".72rem",
                  color: "var(--mu)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 6,
                }}
              >
                Seleccionadas ({selectedRaces.length}):
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[...selectedRaces]
                  .sort((a, b) => new Date(a.date) - new Date(b.date))
                  .map((r, i) => {
                    const isMain =
                      r.id ===
                      [...selectedRaces].sort(
                        (a, b) => new Date(b.date) - new Date(a.date)
                      )[0].id;
                    return (
                      <div
                        key={r.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "5px 10px",
                          borderRadius: 20,
                          background: isMain
                            ? "rgba(255,69,0,.15)"
                            : "rgba(255,255,255,.05)",
                          border: `1px solid ${isMain ? "rgba(255,69,0,.4)" : "var(--bd)"}`,
                          fontSize: ".78rem",
                        }}
                      >
                        <span>{r.image}</span>
                        <span style={{ color: isMain ? "var(--or)" : "var(--tx)" }}>
                          {r.name}
                        </span>
                        <span style={{ color: "var(--mu)" }}>·</span>
                        <span style={{ color: "var(--mu)" }}>{r.distance}</span>
                        {isMain && selectedRaces.length > 1 && (
                          <span
                            style={{
                              fontSize: ".65rem",
                              color: "var(--or)",
                              fontWeight: 700,
                              textTransform: "uppercase",
                            }}
                          >
                            objetivo
                          </span>
                        )}
                        <button
                          onClick={() => toggleRaceSelection(r)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--mu)",
                            cursor: "pointer",
                            fontSize: ".75rem",
                            padding: "0 0 0 2px",
                            lineHeight: 1,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              className="btnp"
              disabled={selectedRaces.length === 0}
              style={{ opacity: selectedRaces.length === 0 ? 0.4 : 1 }}
              onClick={handleGenMultiRace}
            >
              {selectedRaces.length <= 1
                ? "🤖 Generar plan"
                : `🤖 Generar plan evolutivo (${selectedRaces.length} carreras)`}
            </button>
            {selectedRaces.length > 0 && (
              <button
                className="btns"
                onClick={() => setSelectedRaces([])}
              >
                Limpiar selección
              </button>
            )}
          </div>
        </div>

        <div className="rgrid">
          {RACES.map((r) => {
            const isSelected = !!selectedRaces.find((s) => s.id === r.id);
            return (
              <div key={r.id} style={{ position: "relative" }}>
                {/* Checkbox de selección */}
                <div
                  onClick={() => toggleRaceSelection(r)}
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    zIndex: 3,
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    border: `2px solid ${isSelected ? "var(--or)" : "var(--bd)"}`,
                    background: isSelected ? "var(--or)" : "var(--bg3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: ".15s",
                    fontSize: "12px",
                    color: "#fff",
                  }}
                >
                  {isSelected && "✓"}
                </div>
                <div
                  style={{
                    outline: isSelected ? "2px solid var(--or)" : "none",
                    outlineOffset: -1,
                    borderRadius: 12,
                  }}
                >
                  <RaceCard
                    race={r}
                    onClick={() => {
                      setSelRace(r);
                      setView("race");
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderRace = () => {
    const race = selRace;
    if (!race) return null;
    const dateStr = new Date(race.date).toLocaleDateString("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return (
      <div className="pw" style={{ maxWidth: 700 }}>
        <button className="back" onClick={() => setView("calendar")}>
          ← Calendario
        </button>
        <div
          style={{
            display: "flex",
            gap: 14,
            alignItems: "center",
            marginBottom: 22,
          }}
        >
          <div style={{ fontSize: "2.8rem" }}>{race.image}</div>
          <div>
            <h1
              style={{
                fontFamily: "var(--fd)",
                fontSize: "1.9rem",
                lineHeight: 1,
              }}
            >
              {race.name}
            </h1>
            <div
              style={{ color: "var(--mu)", marginTop: 3, fontSize: ".88rem" }}
            >
              {dateStr}
            </div>
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
            gap: 10,
            marginBottom: 24,
          }}
        >
          {[
            ["Distancia", race.distance, "var(--or)"],
            ["Terreno", race.terrain],
            ["Clima", race.weather],
            ["Inscritos", race.registered?.toLocaleString()],
          ].map(([l, v, c]) => (
            <div
              key={l}
              style={{
                background: "var(--bg2)",
                border: "1px solid var(--bd)",
                padding: "14px",
                borderRadius: "9px",
              }}
            >
              <div
                style={{
                  fontSize: ".72rem",
                  color: "var(--mu)",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  marginBottom: "3px",
                }}
              >
                {l}
              </div>
              <div
                style={{
                  fontFamily: "var(--fd)",
                  fontSize: "1.2rem",
                  color: c || "var(--tx)",
                }}
              >
                {v}
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            background: "var(--bg2)",
            border: "1px solid var(--bd)",
            borderRadius: "9px",
            padding: "14px 18px",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: ".78rem",
              color: "var(--or)",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: 6,
            }}
          >
            🏆 Premio
          </div>
          <div style={{ fontSize: ".88rem" }}>{race.prize}</div>
        </div>
        {user && !activeSubscription && (
          <div
            style={{ marginBottom: 12, color: "var(--mu)", fontSize: ".92rem" }}
          >
            Plan gratis: {freePlansUsed} de {freePlansLimit} guardados.{" "}
            {freePlansRemaining > 0
              ? `Te quedan ${freePlansRemaining} cupos.`
              : "Activa ILIMITADO para generar más."}
          </div>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
            gap: 10,
            marginBottom: 18,
          }}
        >
          {ENGINES.map((engine) => (
            <div
              key={engine.id}
              className={`lopt ${aiEngine === engine.id ? "sel" : ""}`}
              onClick={() => setAiEngine(engine.id)}
              style={{ cursor: "pointer" }}
            >
              <div className="lic">{engine.name}</div>
              <div
                className="ln"
                style={{ color: "var(--mu)", fontSize: ".78rem" }}
              >
                {engine.description}
              </div>
            </div>
          ))}
        </div>
        <div
          style={{ color: "var(--mu)", fontSize: ".85rem", marginBottom: 14 }}
        >
          Motor seleccionado: <strong>{currentEngine.name}</strong>. Esto define
          si tu plan IA se genera con el LLM rápido o con el modelo dedicado
          para planes.
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btnp" onClick={() => handleGenerateClick(race)}>
            🤖 Generar plan IA
          </button>
          <button
            className="btns"
            style={{ borderColor: "rgba(255,69,0,.4)", color: "var(--or)" }}
            onClick={() => {
              // Agregar esta carrera a la selección y ir al calendario
              setSelectedRaces((prev) => {
                const exists = prev.find((r) => r.id === race.id);
                if (exists) return prev;
                return [...prev, race];
              });
              setView("calendar");
            }}
          >
            + Agregar a plan multi-carrera
          </button>

          <button
            className="btns"
            onClick={() => {
              setView("coach");
              sendMsg(
                `Quiero prepararme para la ${race.name} (${race.distance}). Terreno: ${race.terrain}, clima: ${race.weather}.`,
              );
            }}
          >
            💬 Preguntar al coach
          </button>
          <button
            className="btns"
            onClick={() => {
              setView("tourism");
              loadTourism(race);
            }}
          >
            🗺️ Guía turística
          </button>
          <button
            className="btns"
            onClick={() => {
              setView("postrace");
              setSelRace(race);
            }}
          >
            📸 Analizar resultados
          </button>
        </div>
      </div>
    );
  };

  const renderProfile = () => (
    <div className="ppage">
      {user && (
        <div style={{ marginBottom: 16 }}>
          <span className="saved-badge">✓ Sesión activa · {user.email}</span>
        </div>
      )}
      <h1 className="ptitle">TU PERFIL</h1>
      <p className="psub">
        La IA usa estos datos para personalizar cada plan.{" "}
        {user
          ? "Se guarda automáticamente en Firebase."
          : "Creá una cuenta para guardar en la nube."}
      </p>
      {activeSubscription && (
        <div
          style={{
            margin: "20px 0",
            padding: 20,
            borderRadius: 12,
            background: "rgba(255,69,0,.06)",
            border: "1px solid rgba(255,69,0,.2)",
          }}
        >
          <div
            style={{
              fontSize: ".95rem",
              color: "var(--or)",
              textTransform: "uppercase",
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            Plan activo
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            <div>
              <strong>{activeSubscription.planName}</strong>
            </div>
            <div style={{ textAlign: "right", color: "var(--mu)" }}>
              {activeSubscription.currency}{" "}
              {activeSubscription.amount.toLocaleString()}
            </div>
          </div>
          <div
            style={{ marginTop: 10, color: "var(--tx)", fontSize: ".92rem" }}
          >
            Aprobado en:{" "}
            {new Date(activeSubscription.approvedAt).toLocaleString()}
          </div>
          <div style={{ marginTop: 6, color: "var(--mu)", fontSize: ".85rem" }}>
            Método: {activeSubscription.paymentType || "Desconocido"}
          </div>
        </div>
      )}
      {!activeSubscription && user && (
        <div
          style={{
            margin: "20px 0",
            padding: 20,
            borderRadius: 12,
            background: "rgba(255,255,255,.02)",
            border: "1px solid var(--bd)",
          }}
        >
          <div
            style={{
              fontSize: ".95rem",
              color: "var(--mu)",
              textTransform: "uppercase",
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            Plan actual
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <strong>BÁSICO</strong>
              <div style={{ color: "var(--mu)", fontSize: ".9rem" }}>
                Gratis · hasta 3 carreras guardadas
              </div>
            </div>
            <div style={{ textAlign: "right", color: "var(--mu)" }}>ARS 0</div>
          </div>
          <div style={{ marginTop: 8, color: "var(--mu)", fontSize: ".92rem" }}>
            Usaste {freePlansUsed} de {freePlansLimit} planes gratis.{" "}
            {freePlansRemaining > 0
              ? `Quedan ${freePlansRemaining}.`
              : "Cupos agotados."}
          </div>
          <div style={{ marginTop: 8, color: "var(--mu)", fontSize: ".85rem" }}>
            Si querés más planes, activá ILIMITADO desde Planes.
          </div>
        </div>
      )}
      {subscriptions.length > 0 && (
        <div style={{ margin: "20px 0" }}>
          <h2
            className="ptitle"
            style={{ fontSize: "1.4rem", marginBottom: 12 }}
          >
            Historial de suscripciones
          </h2>
          <div style={{ display: "grid", gap: 12 }}>
            {subscriptions.map((sub) => (
              <div
                key={sub.collectionId || sub.id || sub.preferenceId}
                style={{
                  background: "var(--bg2)",
                  border: "1px solid var(--bd)",
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <strong>{sub.planName}</strong> ·{" "}
                    {sub.status === "active" ? "Activo" : sub.status}
                  </div>
                  <div style={{ color: "var(--mu)", fontSize: ".85rem" }}>
                    {sub.currency} {Number(sub.amount).toLocaleString()}
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 8,
                    color: "var(--mu)",
                    fontSize: ".85rem",
                  }}
                >
                  Pago: {sub.paymentType || "Desconocido"}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    color: "var(--mu)",
                    fontSize: ".85rem",
                  }}
                >
                  Fecha:{" "}
                  {new Date(
                    sub.approvedAt || sub.createdAt || Date.now(),
                  ).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {user && (
        <div style={{ marginTop: 12 }}>
          <button className="btns" onClick={() => setView("myraces")}>
            Mis Carreras ({plans.length || 0} guardadas)
          </button>
        </div>
      )}
      {user && (
        <div
          style={{
            margin: "20px 0",
            padding: 18,
            borderRadius: 12,
            background: "rgba(255,255,255,.02)",
            border: "1px solid var(--bd)",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              color: "var(--tx)",
            }}
          >
            <input
              type="checkbox"
              checked={autoUpdatePlan}
              onChange={(e) => setAutoUpdatePlan(e.target.checked)}
            />
            <span style={{ fontSize: ".92rem" }}>
              Actualizar automáticamente el plan cuando cambies tu perfil o el
              motor de IA.
            </span>
          </label>
          <div style={{ marginTop: 8, color: "var(--mu)", fontSize: ".82rem" }}>
            Si está activo, el plan se regenerará con tu perfil actualizado o al
            cambiar el modelo de IA en la carrera.
          </div>
        </div>
      )}
      <div className="fg">
        <label className="fl">Nombre</label>
        <input
          className="fi2"
          placeholder="¿Cómo te llamás?"
          value={pForm.name}
          onChange={(e) => setPForm((p) => ({ ...p, name: e.target.value }))}
        />
      </div>
      <div className="frow">
        <div className="fg">
          <label className="fl">Edad</label>
          <input
            className="fi2"
            type="number"
            placeholder="35"
            value={pForm.age}
            onChange={(e) => setPForm((p) => ({ ...p, age: e.target.value }))}
          />
        </div>
        <div className="fg">
          <label className="fl">Peso (kg)</label>
          <input
            className="fi2"
            type="number"
            placeholder="72"
            value={pForm.weight}
            onChange={(e) =>
              setPForm((p) => ({ ...p, weight: e.target.value }))
            }
          />
        </div>
      </div>
      <div className="frow">
        <div className="fg">
          <label className="fl">Altura (cm)</label>
          <input
            className="fi2"
            type="number"
            placeholder="175"
            value={pForm.height}
            onChange={(e) =>
              setPForm((p) => ({ ...p, height: e.target.value }))
            }
          />
        </div>
        <div className="fg">
          <label className="fl">Días/semana</label>
          <select
            className="fi2 fsel"
            value={pForm.days}
            onChange={(e) => setPForm((p) => ({ ...p, days: e.target.value }))}
          >
            {["2", "3", "4", "5", "6"].map((d) => (
              <option key={d} value={d}>
                {d} días
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="fg">
        <label className="fl">Nivel</label>
        <div className="lgrid">
          {[
            ["principiante", "🌱", "Principiante"],
            ["moderado", "🔥", "Moderado"],
            ["avanzado", "⚡", "Avanzado"],
          ].map(([id, ic, lb]) => (
            <div
              key={id}
              className={`lopt ${pForm.level === id ? "sel" : ""}`}
              onClick={() => setPForm((p) => ({ ...p, level: id }))}
            >
              <span className="lic">{ic}</span>
              <span className="ln">{lb}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="fg">
        <label className="fl">Objetivo principal</label>
        <input
          className="fi2"
          placeholder="Ej: Terminar mi primera maratón"
          value={pForm.goal}
          onChange={(e) => setPForm((p) => ({ ...p, goal: e.target.value }))}
        />
      </div>

      {/* ─── Performance data ─── */}
      <div
        style={{
          margin: "24px 0 16px",
          paddingTop: 20,
          borderTop: "1px solid var(--bd)",
        }}
      >
        <div
          style={{
            fontSize: ".72rem",
            color: "var(--or)",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: 14,
          }}
        >
          Datos de rendimiento (para cálculo de ritmos)
        </div>
        <div className="fg">
          <label className="fl">
            ⏱ Tiempo en 1.6 km{" "}
            <span
              style={{
                color: "var(--mu)",
                textTransform: "none",
                letterSpacing: 0,
                fontWeight: 400,
              }}
            >
              (opcional)
            </span>
          </label>
          <input
            className="fi2"
            placeholder="Ej: 8:30 (min:seg)"
            value={pForm.time1600 || ""}
            onChange={(e) =>
              setPForm((p) => ({ ...p, time1600: e.target.value }))
            }
          />
          {pForm.time1600 && calcPaceZones(pForm.time1600) && (
            <div
              style={{
                marginTop: 8,
                padding: "10px 12px",
                background: "rgba(255,69,0,.06)",
                borderRadius: 6,
                fontSize: ".78rem",
                color: "var(--mu)",
              }}
            >
              <span style={{ color: "var(--or)", fontWeight: 700 }}>
                Zonas:{" "}
              </span>
              Fácil {calcPaceZones(pForm.time1600).easy} · Tempo{" "}
              {calcPaceZones(pForm.time1600).tempo} · Int 1K{" "}
              {calcPaceZones(pForm.time1600).interval_1k}
            </div>
          )}
        </div>
        <div className="fg">
          <label className="fl">¿Cómo es tu ritmo de vida?</label>
          <div className="lgrid">
            {[
              ["acelerado", "🔥", "Muy activo"],
              ["moderado", "🚶", "Normal"],
              ["tranquilo", "😌", "Tranquilo"],
            ].map(([id, ic, lb]) => (
              <div
                key={id}
                className={`lopt ${(pForm.lifeRhythm || "moderado") === id ? "sel" : ""}`}
                onClick={() => setPForm((p) => ({ ...p, lifeRhythm: id }))}
              >
                <span className="lic">{ic}</span>
                <span className="ln">{lb}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="fg">
          <label className="fl">Alimentación</label>
          <select
            className="fi2 fsel"
            value={pForm.alimentacion || "sin_restricciones"}
            onChange={(e) =>
              setPForm((p) => ({ ...p, alimentacion: e.target.value }))
            }
          >
            <option value="sin_restricciones">Sin restricciones</option>
            <option value="carnivoro">Alta en proteínas</option>
            <option value="vegetariano">Vegetariana</option>
            <option value="vegano">Vegana</option>
            <option value="keto">Keto / Baja en carbos</option>
          </select>
        </div>
      </div>

      <button
        className="btnp"
        style={{ width: "100%", padding: 14 }}
        onClick={saveProfile}
      >
        {user ? "Guardar en Firebase →" : "Guardar perfil →"}
      </button>
      {!user && (
        <button
          className="btns"
          style={{ width: "100%", padding: 12, marginTop: 10 }}
          onClick={() => setShowAuth(true)}
        >
          Crear cuenta para sincronizar ☁️
        </button>
      )}
    </div>
  );

  const renderPlans = () => (
    <div className="pw">
      <button className="back" onClick={() => setView("home")}>
        ← Inicio
      </button>
      <div className="sh" style={{ marginBottom: 10 }}>
        <h1 className="st">
          ELEGÍ TU <span>PLAN</span>
        </h1>
      </div>
      <p style={{ color: "var(--mu)", marginBottom: 18, fontSize: ".92rem" }}>
        Tres niveles de coaching. Desde tu primera carrera hasta las métricas de
        élite.
      </p>
      {user ? (
        <div
          style={{
            marginBottom: 18,
            padding: 16,
            borderRadius: 12,
            background: "rgba(255,69,0,.08)",
            border: "1px solid rgba(255,69,0,.2)",
            color: "var(--tx)",
          }}
        >
          {activeSubscription ? (
            <>
              <strong>Plan activo:</strong> {activeSubscription.planName} ·{" "}
              {activeSubscription.currency}{" "}
              {activeSubscription.amount.toLocaleString()}.
              <div style={{ color: "var(--mu)", marginTop: 6 }}>
                Se renovará automáticamente según tu medio de pago. Lo podés ver
                también en Perfil.
              </div>
            </>
          ) : (
            <>
              <strong>Plan actual:</strong> BÁSICO gratis · hasta 3 carreras
              guardadas.
              <div style={{ color: "var(--mu)", marginTop: 6 }}>
                Generá planes sin costo hasta 3 carreras. Activá ILIMITADO para
                más acceso.
              </div>
            </>
          )}
        </div>
      ) : (
        <div
          style={{
            marginBottom: 18,
            padding: 16,
            borderRadius: 12,
            background: "rgba(17,17,17,.95)",
            border: "1px solid var(--bd)",
            color: "var(--mu)",
          }}
        >
          Iniciá sesión para ver y gestionar tus planes y suscripciones.
        </div>
      )}
      <div className="pgrid">
        {PLANS.map((p) => (
          <PlanCard
            key={p.id}
            plan={p}
            onSelect={handlePlanSelect}
            activePlanId={currentPlanId}
          />
        ))}
      </div>
      {paymentError && (
        <div className="ferr" style={{ marginTop: 18 }}>
          {paymentError}
        </div>
      )}
      {paymentSuccess && (
        <div className="saved-badge" style={{ marginTop: 18 }}>
          {paymentSuccess}
        </div>
      )}
      {paymentLoading && (
        <div style={{ marginTop: 18, color: "var(--tx)" }}>
          Redirigiendo a Mercado Pago...
        </div>
      )}
    </div>
  );

  const deletePlan = async (planId) => {
    if (!user) return;
    try {
      await fbDelete(`plans_${user.uid}`, planId, user.token).catch(() => null);
      setPlans((prev) => prev.filter((p) => p.id !== planId));
    } catch (err) {
      console.error("[deletePlan]", err);
    }
  };

  const renderMyRaces = () => (
    <div className="pw">
      <button className="back" onClick={() => setView("profile")}>
        ← Perfil
      </button>
      <div className="sh" style={{ marginBottom: 10 }}>
        <h1 className="st">
          MIS <span>CARRERAS</span>
        </h1>
      </div>
      <p style={{ color: "var(--mu)", marginBottom: 12 }}>
        Planes generados por la IA y guardados en tu cuenta.
      </p>
      {plans.length === 0 && (
        <div style={{ color: "var(--mu)" }}>No tenés planes guardados aún.</div>
      )}
      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        {plans.map((p) => (
          <div
            key={p.id}
            style={{
              background: "var(--bg2)",
              border: "1px solid var(--bd)",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontWeight: 800 }}>
                  {p.race?.name || "Carrera"}
                </div>
                <div style={{ color: "var(--mu)", fontSize: ".9rem" }}>
                  {p.race?.distance || ""} ·{" "}
                  {new Date(p.createdAt || Date.now()).toLocaleString()}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  className="btns"
                  onClick={() => {
                    setTrainPlan({ ...(p.plan || {}), race: p.race });
                    setView("training");
                  }}
                >
                  Abrir plan
                </button>
                <button
                  className="btns"
                  style={{
                    background: "transparent",
                    color: "var(--or)",
                    border: "1px solid var(--or)",
                  }}
                  onClick={() => deletePlan(p.id)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderCoach = () => (
    <div className="chat">
      <div className="chatheader">
        <div className="chatava">🏃</div>
        <div>
          <div className="chatname">
            PACE<span style={{ color: "var(--or)" }}>AI</span>
          </div>
          <div className="chatsub">
            {profile
              ? `Entrenando a ${profile.name} · ${profile.level}`
              : "Coach de running · Buenos Aires"}
          </div>
        </div>
      </div>
      <div className="msgs">
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role === "user" ? "u" : "a"}`}>
            <div className="mava">
              {m.role === "assistant" ? "🏃" : profile?.name?.[0] || "U"}
            </div>
            <div className="mbub">{m.content}</div>
          </div>
        ))}
        {chatLoading && (
          <div className="msg a">
            <div className="mava">🏃</div>
            <div className="mbub">
              <div className="typing">
                <div className="dot" />
                <div className="dot" />
                <div className="dot" />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEnd} />
      </div>
      <div>
        <div className="qps">
          {[
            "¿Qué como antes de la carrera?",
            "¿Cómo evito el pájaro?",
            "¿Qué zapatillas me recomendás?",
            "Armame un plan básico",
            "¿Cómo manejo el fondo en invierno?",
          ].map((q) => (
            <button key={q} className="qp" onClick={() => sendMsg(q)}>
              {q}
            </button>
          ))}
        </div>
        <div className="cinput">
          <textarea
            className="cinp"
            rows={2}
            placeholder="Preguntale a PaceAI..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMsg();
              }
            }}
          />
          <button
            className="csend"
            onClick={() => sendMsg()}
            disabled={chatLoading || !chatInput.trim()}
          >
            →
          </button>
        </div>
      </div>
    </div>
  );

  const renderTraining = () => {
    if (genPlan)
      return (
        <div className="lcenter">
          <div className="spin" />
          <div className="ltxt">Generando tu plan...</div>
        </div>
      );
    if (!trainPlan)
      return (
        <div className="tpage">
          <p style={{ color: "var(--mu)" }}>
            Seleccioná una carrera para generar tu plan.
          </p>
          <button
            className="btnp"
            style={{ marginTop: 14 }}
            onClick={() => setView("calendar")}
          >
            Ver calendario
          </button>
        </div>
      );
    if (trainPlan.error)
      return (
        <div className="tpage">
          <p style={{ color: "var(--or)" }}>Error al generar el plan.</p>
          <button
            className="btnp"
            style={{ marginTop: 14 }}
            onClick={() => genTrainPlan(trainPlan.race)}
          >
            Reintentar
          </button>
        </div>
      );
    const {
      semanas = [],
      consejos_generales = [],
      nutricion,
      calzado,
      race,
    } = trainPlan;
    const sem = semanas[activeWeek] || {};
    const stColor = (t) =>
      ({
        Recuperación: "#4CAF50",
        Rodaje: "#00BCD4",
        Calidad: "#F44336",
        Intervalo: "#F44336",
        "Fondo Largo": "#9C27B0",
        "Long run": "#9C27B0",
        Tempo: "#FF9800",
        Fuerza: "#2196F3",
        Descanso: "#404040",
        Cuestas: "#FF6B35",
        Tapering: "#4CAF50",
      })[t] || "#FF9800";
    const {
      macrociclo = [],
      paceZones: pz,
      validacion,
      weeksAvailable: wk,
    } = trainPlan;
    return (
      <div className="tpage">
        <button className="back" onClick={() => setView("race")}>
          ← Carrera
        </button>
        <h1 className="ttitle">PLAN DE ENTRENAMIENTO</h1>
        <div className="trace">
          {race?.name} · {race?.distance}
          {wk ? ` · ${wk} semanas` : ""}
        </div>

        {/* Rango de fechas del plan */}
        {(() => {
          const today = planStartDate || new Date();
          const endDate = race?.date ? new Date(race.date) : null;
          const totalSem = semanas.length || wk || 0;
          const planEnd = endDate || new Date(today.getTime() + totalSem * 7 * 24 * 60 * 60 * 1000);
          const fmt = (d) => d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
          const daysLeft = endDate ? Math.max(0, Math.ceil((endDate - new Date()) / 86400000)) : null;
          return (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 10,
              padding: "10px 14px",
              background: "rgba(255,69,0,.06)",
              border: "1px solid rgba(255,69,0,.15)",
              borderRadius: 8,
              flexWrap: "wrap",
            }}>
              <span style={{ fontSize: ".8rem", color: "var(--mu)" }}>
                📅 <strong style={{ color: "var(--tx)" }}>{fmt(today)}</strong>
                <span style={{ margin: "0 6px", color: "var(--bd)" }}>→</span>
                <strong style={{ color: "var(--or)" }}>{fmt(planEnd)}</strong>
              </span>
              {daysLeft !== null && (
                <span style={{
                  marginLeft: "auto",
                  fontSize: ".78rem",
                  fontWeight: 700,
                  color: daysLeft <= 14 ? "#ef4444" : daysLeft <= 30 ? "#f59e0b" : "var(--or)",
                  background: daysLeft <= 14 ? "rgba(239,68,68,.1)" : "rgba(255,69,0,.08)",
                  padding: "3px 10px",
                  borderRadius: 20,
                }}>
                  {daysLeft === 0 ? "¡Es hoy!" : `${daysLeft} días para la carrera`}
                </span>
              )}
            </div>
          );
        })()}

        {user && (
          <div style={{ marginTop: 8 }}>
            <span className="saved-badge">✓ Guardado en Firebase</span>
          </div>
        )}

        {/* Macrociclo overview */}
        {macrociclo.length > 0 && (
          <div
            style={{
              margin: "16px 0",
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            {macrociclo.map((f, i) => (
              <div
                key={i}
                style={{
                  flex: "1 1 auto",
                  minWidth: 100,
                  padding: "8px 12px",
                  background: "rgba(255,69,0,.06)",
                  border: "1px solid rgba(255,69,0,.15)",
                  borderRadius: 8,
                }}
              >
                <div
                  style={{
                    fontSize: ".68rem",
                    color: "var(--or)",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 2,
                  }}
                >
                  {f.fase}
                </div>
                <div style={{ fontSize: ".75rem", color: "var(--mu)" }}>
                  Sem {f.semanas_inicio}-{f.semanas_fin}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pace zones (si se calcularon) */}
        {pz && (
          <div
            style={{
              margin: "12px 0 16px",
              padding: "12px 16px",
              background: "var(--bg2)",
              border: "1px solid var(--bd)",
              borderRadius: 10,
            }}
          >
            <div
              style={{
                fontSize: ".72rem",
                color: "var(--or)",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 8,
              }}
            >
              Tus Zonas de Ritmo
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[
                ["Fácil", pz.easy],
                ["Fondo", pz.long_run],
                ["Tempo", pz.tempo],
                ["Int. 1K", pz.interval_1k],
              ].map(([l, v]) => (
                <div key={l} style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: ".68rem",
                      color: "var(--mu)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {l}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--fd)",
                      fontSize: ".95rem",
                      color: "var(--or)",
                    }}
                  >
                    {v}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Coach validation */}
        {validacion && (
          <div
            style={{
              margin: "0 0 16px",
              padding: "12px 16px",
              background: "rgba(255,215,0,.06)",
              border: "1px solid rgba(255,215,0,.2)",
              borderRadius: 10,
              fontSize: ".82rem",
              color: "#ccc",
            }}
          >
            <span style={{ color: "var(--gold)", fontWeight: 700 }}>
              Coach:{" "}
            </span>
            {validacion}
          </div>
        )}
        {/* ── Timeline visual con hitos de carrera ── */}
        <CalendarTimeline
          weeks={semanas}
          activeWeek={activeWeek}
          onWeekChange={setActiveWeek}
          races={trainPlan.races || (trainPlan.race ? [trainPlan.race] : [])}
          startDate={planStartDate}
        />

        {/* Indicador de carrera control en semana actual */}
        {sem.carrera_control && (
          <div
            style={{
              margin: "0 0 14px",
              padding: "12px 16px",
              background: "rgba(255,69,0,.1)",
              border: "1px solid rgba(255,69,0,.35)",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: ".72rem",
                  color: "var(--or)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 3,
                }}
              >
                🏁 Carrera control esta semana
              </div>
              <div style={{ fontSize: ".88rem", fontWeight: 600 }}>
                {sem.carrera_control}
              </div>
              <div style={{ fontSize: ".78rem", color: "var(--mu)", marginTop: 3 }}>
                Reducción de volumen aplicada · No hay tapering completo
              </div>
            </div>
            {trainPlan.isMultiRace && (
              <button
                className="btns"
                style={{ fontSize: ".78rem", padding: "7px 14px" }}
                onClick={() => {
                  const ctrl = (trainPlan.races || []).find(
                    (r) =>
                      r.name.toLowerCase().includes(
                        (sem.carrera_control || "").toLowerCase().slice(0, 10)
                      )
                  );
                  if (ctrl) {
                    setSelRace(ctrl);
                    setView("postrace");
                  } else {
                    setView("postrace");
                  }
                }}
              >
                📸 Registrar resultado →
              </button>
            )}
          </div>
        )}

        {/* Diagnóstico de recalibración si existe */}
        {recalibrationData && (
          <div
            style={{
              margin: "0 0 14px",
              padding: "14px 18px",
              background: "rgba(255,215,0,.05)",
              border: "1px solid rgba(255,215,0,.25)",
              borderRadius: 10,
            }}
          >
            <div
              style={{
                fontSize: ".72rem",
                color: "var(--gold)",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 8,
              }}
            >
              🔄 Plan recalibrado post-carrera
            </div>
            <div style={{ fontSize: ".85rem", color: "var(--mu)", marginBottom: 6 }}>
              <strong style={{ color: "var(--tx)" }}>Diagnóstico:</strong>{" "}
              {recalibrationData.diagnostico}
            </div>
            <div style={{ fontSize: ".85rem", color: "var(--mu)", marginBottom: recalibrationData.alerta ? 6 : 0 }}>
              <strong style={{ color: "var(--tx)" }}>Ajuste:</strong>{" "}
              {recalibrationData.ajuste}
            </div>
            {recalibrationData.alerta && (
              <div
                style={{
                  marginTop: 8,
                  padding: "8px 12px",
                  background: "rgba(239,68,68,.1)",
                  border: "1px solid rgba(239,68,68,.25)",
                  borderRadius: 6,
                  fontSize: ".82rem",
                  color: "#ef4444",
                }}
              >
                ⚠️ {recalibrationData.alerta}
              </div>
            )}
            <button
              style={{
                marginTop: 10,
                background: "none",
                border: "none",
                color: "var(--mu)",
                fontSize: ".75rem",
                cursor: "pointer",
                padding: 0,
              }}
              onClick={() => setRecalibrationData(null)}
            >
              Ocultar diagnóstico ✕
            </button>
          </div>
        )}

        {sem.sesiones && (
          <>
            {/* ── Check-in diario del coach ── */}
            {(() => {
              // Detectar qué día de la semana es hoy dentro del plan
              const planStart = planStartDate || new Date();
              const daysElapsed = Math.floor((new Date() - planStart) / 86400000);
              const todayWeekIdx = Math.floor(daysElapsed / 7);
              const todayDayIdx = daysElapsed % 7; // 0=Lun ... 6=Dom
              const isPlanActive = daysElapsed >= 0 && daysElapsed < (semanas.length * 7);
              // Solo mostrar si estamos viendo la semana actual
              const isCurrentWeek = isPlanActive && activeWeek === todayWeekIdx;
              const todaySession = isCurrentWeek ? sem.sesiones[todayDayIdx] : null;
              return (
                <DailyCoach
                  todaySession={todaySession}
                  profile={profile || pForm}
                  weekNumber={activeWeek + 1}
                  onAdjust={(sessionAjustada) => setAdjustedSession(sessionAjustada)}
                />
              );
            })()}
          </>
        )}

        {sem.sesiones && (
          <div className="wcont">
            <div className="wobj">
              <strong>Objetivo:</strong> {sem.objetivo}
            </div>
            {sem.sesiones.map((s, i) => {
              const planStart = planStartDate || new Date();
              const daysElapsed = Math.floor((new Date() - planStart) / 86400000);
              const todayWeekIdx = Math.floor(daysElapsed / 7);
              const todayDayIdx = daysElapsed % 7;
              const isPlanActive = daysElapsed >= 0 && daysElapsed < (semanas.length * 7);
              const isToday = isPlanActive && activeWeek === todayWeekIdx && i === todayDayIdx;
              const session = isToday && adjustedSession ? { ...s, ...adjustedSession } : s;
              return (
                <div key={i} className="srow" style={{
                  background: isToday ? "rgba(34,197,94,.04)" : "transparent",
                  borderLeft: isToday ? "3px solid #22c55e" : "3px solid transparent",
                }}>
                  <span className="sday" style={{ color: isToday ? "#22c55e" : "inherit", fontWeight: isToday ? 900 : 700 }}>
                    {isToday ? "HOY" : session.dia}
                  </span>
                  <span className="styp" style={{ background: stColor(session.tipo) + "22", color: stColor(session.tipo) }}>
                    {session.tipo}{isToday && adjustedSession && <span style={{ marginLeft: 3, fontSize: ".65rem", color: "#f59e0b" }}>✎</span>}
                  </span>
                  <span className="sdist">{session.distancia}</span>
                  <span className="sdesc">
                    {session.descripcion}{" "}
                    <span style={{ color: "var(--or)", fontWeight: 600 }}>{session.ritmo}</span>
                  </span>
                </div>
              );
            })}
            {sem.consejo && <div className="wtip">💡 {sem.consejo}</div>}
          </div>
        )}
        <div className="extras">
          {consejos_generales.length > 0 && (
            <div className="exc">
              <div className="ext">✅ Consejos</div>
              <ul
                style={{
                  paddingLeft: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                }}
              >
                {consejos_generales.map((c, i) => (
                  <li key={i} className="exd">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {nutricion && (
            <div className="exc">
              <div className="ext">🍽️ Nutrición</div>
              <div className="exd">{nutricion}</div>
            </div>
          )}
          {calzado && (
            <div className="exc">
              <div className="ext">👟 Calzado</div>
              <div className="exd">{calzado}</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPostRace = () => (
    <div className="prpage">
      <button className="back" onClick={() => setView("home")}>
        ← Inicio
      </button>
      <h1 className="ptitle">
        ANÁLISIS <span style={{ color: "var(--or)" }}>POST-CARRERA</span>
      </h1>
      <p className="psub">
        Contános cómo te fue. La IA aprende de tus resultados para mejorar tus
        próximos planes.
      </p>

      {/* ─── Structured feedback form ─── */}
      <div
        style={{
          background: "var(--bg2)",
          border: "1px solid var(--bd)",
          borderRadius: 12,
          padding: "18px 20px",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            fontSize: ".72rem",
            color: "var(--or)",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: 14,
          }}
        >
          Tu resultado
        </div>
        <div className="frow">
          <div className="fg">
            <label className="fl">⏱ Tiempo final</label>
            <input
              className="fi2"
              placeholder="Ej: 2:15:30"
              value={postRaceExtra.tiempo}
              onChange={(e) =>
                setPostRaceExtra((p) => ({ ...p, tiempo: e.target.value }))
              }
            />
          </div>
          <div className="fg">
            <label className="fl">💪 Sensación (1–5)</label>
            <select
              className="fi2 fsel"
              value={postRaceExtra.sensacion}
              onChange={(e) =>
                setPostRaceExtra((p) => ({ ...p, sensacion: e.target.value }))
              }
            >
              <option value="1">1 — Muy mal</option>
              <option value="2">2 — Mal</option>
              <option value="3">3 — Regular</option>
              <option value="4">4 — Bien</option>
              <option value="5">5 — Excelente</option>
            </select>
          </div>
        </div>
        <div className="fg">
          <label className="fl">Comentarios libres</label>
          <textarea
            className="fi2"
            rows={3}
            placeholder="¿Cómo te sentiste? ¿Alguna dificultad? ¿Logros?..."
            style={{ resize: "vertical" }}
            value={postRaceExtra.comentarios}
            onChange={(e) =>
              setPostRaceExtra((p) => ({ ...p, comentarios: e.target.value }))
            }
          />
        </div>
      </div>

      <p style={{ color: "var(--mu)", fontSize: ".82rem", marginBottom: 16 }}>
        Opcional: subí una foto de tu resultado o de la llegada para análisis
        adicional.
      </p>
      {!user && (
        <div
          style={{
            background: "rgba(255,69,0,.08)",
            border: "1px solid rgba(255,69,0,.2)",
            borderRadius: "8px",
            padding: "12px 16px",
            marginBottom: 18,
            fontSize: ".82rem",
            color: "var(--mu)",
          }}
        >
          💡{" "}
          <button
            style={{
              background: "none",
              border: "none",
              color: "var(--or)",
              cursor: "pointer",
              fontWeight: 700,
              padding: 0,
            }}
            onClick={() => setShowAuth(true)}
          >
            Iniciá sesión
          </button>{" "}
          para guardar tus análisis en Firebase.
        </div>
      )}
      <input
        type="file"
        ref={fileRef}
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => handlePhotoSelect(e.target.files[0])}
      />
      <div
        className={`dropzone ${prPhoto ? "has" : ""}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handlePhotoSelect(e.dataTransfer.files[0]);
        }}
      >
        {prPreview ? (
          <>
            <img src={prPreview} alt="Preview" className="dropimg" />
            <div
              style={{
                marginTop: 10,
                fontSize: ".8rem",
                color: "var(--or)",
                fontWeight: 600,
              }}
            >
              📷 Hacé click para cambiar
            </div>
          </>
        ) : (
          <>
            <span className="dropico">📸</span>
            <div className="droptxt">
              Arrastrá tu foto aquí o hacé click para seleccionar
            </div>
            <div
              style={{ fontSize: ".75rem", color: "var(--mu)", marginTop: 6 }}
            >
              JPG, PNG, WEBP
            </div>
          </>
        )}
      </div>
      {prPhoto && !prAnalysis && (
        <button
          className="btnp"
          style={{ width: "100%", padding: 14 }}
          onClick={analyzeRace}
          disabled={prLoading}
        >
          {prLoading ? "Analizando con IA..." : "🤖 Analizar con PaceAI"}
        </button>
      )}
      {prLoading && (
        <div className="lcenter" style={{ padding: "40px 0" }}>
          <div className="spin" />
          <div className="ltxt" style={{ fontSize: "1rem" }}>
            Analizando...
          </div>
        </div>
      )}
      {prAnalysis && (
        <div className="analysis">
          <h3>📊 Análisis de PaceAI</h3>
          {savingPR && (
            <div
              style={{
                fontSize: ".78rem",
                color: "var(--or)",
                marginBottom: 10,
              }}
            >
              ☁️ Guardando en Firebase...
            </div>
          )}
          <p>{prAnalysis}</p>
          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 16,
              flexWrap: "wrap",
            }}
          >
            <button
              className="btnp"
              onClick={() => {
                setPrPhoto(null);
                setPrPreview(null);
                setPrAnalysis(null);
              }}
            >
              Analizar otra foto
            </button>
            <button
              className="btns"
              onClick={() =>
                sendMsg(
                  `Acabo de analizar mi carrera: "${prAnalysis.slice(0, 200)}..." ¿Qué me recomendás para mejorar?`,
                )
              }
            >
              Hablar con el coach →
            </button>
            {/* Botón de recalibración — solo si hay un plan multi-carrera activo */}
            {trainPlan?.isMultiRace && selRace && (
              <button
                className="btns"
                disabled={recalibrating}
                style={{
                  borderColor: recalibrating ? "var(--bd)" : "var(--gold)",
                  color: recalibrating ? "var(--mu)" : "var(--gold)",
                }}
                onClick={() => {
                  recalibratePlan(selRace, {
                    tiempo: postRaceExtra.tiempo,
                    sensacion: postRaceExtra.sensacion,
                    comentarios: postRaceExtra.comentarios,
                  });
                  setView("training");
                }}
              >
                {recalibrating ? "Recalibrando plan..." : "🔄 Recalibrar plan siguiente →"}
              </button>
            )}
          </div>
        </div>
      )}
      {prHistory.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h3
            style={{
              fontFamily: "var(--fd)",
              fontSize: "1.3rem",
              marginBottom: 12,
            }}
          >
            HISTORIAL <span style={{ color: "var(--or)" }}>EN FIREBASE</span>
          </h3>
          {prHistory.map((h, i) => (
            <div key={i} className="hist-item">
              <div>
                <div
                  style={{
                    fontSize: ".8rem",
                    color: "var(--or)",
                    fontWeight: 600,
                    marginBottom: 3,
                  }}
                >
                  {h.race || "Sin carrera"}
                </div>
                <div className="hist-preview">
                  {h.analysis?.slice(0, 120)}...
                </div>
              </div>
              <div className="hist-date">
                {h.createdAt
                  ? new Date(h.createdAt).toLocaleDateString("es-AR")
                  : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderTourism = () => (
    <div className="tourpage">
      <button className="back" onClick={() => setView("home")}>
        ← Inicio
      </button>
      <h1
        style={{ fontFamily: "var(--fd)", fontSize: "2rem", marginBottom: 6 }}
      >
        GUÍA <span style={{ color: "var(--or)" }}>TURÍSTICA</span>
      </h1>
      <p style={{ color: "var(--mu)", fontSize: ".88rem", marginBottom: 24 }}>
        Hoteles, restaurantes y logística cerca de cada carrera.
      </p>
      <div className="tour-select">
        <div className="tour-label">Seleccioná la carrera</div>
        <div className="race-pills">
          {RACES.map((r) => (
            <button
              key={r.id}
              className={`rpill ${tourRace?.id === r.id ? "sel" : ""}`}
              onClick={() => loadTourism(r)}
            >
              {r.image} {r.name}
            </button>
          ))}
        </div>
      </div>
      {tourRace && (
        <>
          <div className="tour-cards">
            {[
              ["📍", "Zona de largada", tourRace.tourism.zone],
              ["🏨", "Hoteles", tourRace.tourism.hotel_zone],
              ["🚗", "Estacionamiento", tourRace.tourism.parking],
              ["🚇", "Transporte", tourRace.tourism.metro],
              ["🎭", "Para ver cerca", tourRace.tourism.cultural],
            ].map(([ic, n, d]) => (
              <div key={n} className="tc">
                <div className="tci">{ic}</div>
                <div className="tcn">{n}</div>
                <div className="tcd">{d}</div>
              </div>
            ))}
          </div>
          {tourLoading && (
            <div className="lcenter" style={{ padding: "40px 0" }}>
              <div className="spin" />
              <div className="ltxt" style={{ fontSize: "1rem" }}>
                Generando guía completa...
              </div>
            </div>
          )}
          {tourAI && (
            <div className="ai-tour">
              <h3>🤖 Guía completa de PaceAI</h3>
              <p>{tourAI}</p>
              <button
                className="btns"
                style={{ marginTop: 16 }}
                onClick={() => {
                  setView("coach");
                  sendMsg(
                    `Necesito más info logística para la ${tourRace.name}.`,
                  );
                }}
              >
                Hacer más preguntas →
              </button>
            </div>
          )}
        </>
      )}
      {!tourRace && (
        <div
          style={{
            textAlign: "center",
            padding: "48px 20px",
            color: "var(--mu)",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: 10 }}>🗺️</div>
          <div>Seleccioná una carrera arriba</div>
        </div>
      )}
    </div>
  );

  // ─── Onboarding Wizard (3 pasos sin login previo) ─────────────────────────
  const renderOnboarding = () => {
    const race = selRace;
    const weeksAvail = race
      ? Math.max(
          1,
          Math.ceil(
            (new Date(race.date) - new Date()) / (7 * 24 * 60 * 60 * 1000),
          ),
        )
      : 0;
    const zones = pForm.time1600 ? calcPaceZones(pForm.time1600) : null;
    const paceWarn = pForm.goalTime ? validateGoalPace(pForm, race) : null;

    return (
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "32px 24px" }}>
        {/* Progress bar */}
        <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: onboardingStep >= step ? "var(--or)" : "var(--bd)",
                transition: "background 0.3s",
              }}
            />
          ))}
        </div>

        {/* ── STEP 1: Basic data (no login required) ── */}
        {onboardingStep === 1 && (
          <>
            <div
              style={{
                fontSize: ".72rem",
                color: "var(--or)",
                fontWeight: 700,
                letterSpacing: "2px",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Paso 1 de 3
            </div>
            <h1
              style={{
                fontFamily: "var(--fd)",
                fontSize: "2rem",
                marginBottom: 12,
              }}
            >
              TUS DATOS
            </h1>
            {race && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  background: "rgba(255,69,0,.08)",
                  border: "1px solid rgba(255,69,0,.2)",
                  borderRadius: 8,
                  marginBottom: 16,
                }}
              >
                <span style={{ fontSize: "1.4rem" }}>{race.image}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: ".88rem" }}>
                    {race.name}
                  </div>
                  <div style={{ color: "var(--mu)", fontSize: ".78rem" }}>
                    {race.distance} · {weeksAvail} semanas disponibles
                  </div>
                </div>
              </div>
            )}
            <p
              style={{
                color: "var(--mu)",
                fontSize: ".88rem",
                marginBottom: 20,
              }}
            >
              Con estos datos armamos tu plan a medida. Sin necesidad de cuenta
              todavía.
            </p>
            <div className="frow">
              <div className="fg">
                <label className="fl">Peso (kg)</label>
                <input
                  className="fi2"
                  type="number"
                  placeholder="72"
                  value={pForm.weight}
                  onChange={(e) =>
                    setPForm((p) => ({ ...p, weight: e.target.value }))
                  }
                />
              </div>
              <div className="fg">
                <label className="fl">Altura (cm)</label>
                <input
                  className="fi2"
                  type="number"
                  placeholder="175"
                  value={pForm.height}
                  onChange={(e) =>
                    setPForm((p) => ({ ...p, height: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="fg">
              <label className="fl">Nivel de corredor</label>
              <div className="lgrid">
                {[
                  ["principiante", "🌱", "Principiante"],
                  ["moderado", "🔥", "Moderado"],
                  ["avanzado", "⚡", "Avanzado"],
                ].map(([id, ic, lb]) => (
                  <div
                    key={id}
                    className={`lopt ${pForm.level === id ? "sel" : ""}`}
                    onClick={() => setPForm((p) => ({ ...p, level: id }))}
                  >
                    <span className="lic">{ic}</span>
                    <span className="ln">{lb}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="fg">
              <label className="fl">Días disponibles para entrenar</label>
              <select
                className="fi2 fsel"
                value={pForm.days}
                onChange={(e) =>
                  setPForm((p) => ({ ...p, days: e.target.value }))
                }
              >
                {["3", "4", "5", "6"].map((d) => (
                  <option key={d} value={d}>
                    {d} días/semana
                  </option>
                ))}
              </select>
            </div>
            <div className="fg">
              <label className="fl">
                ⏱ Tiempo en 1.6 km{" "}
                <span
                  style={{
                    color: "var(--mu)",
                    textTransform: "none",
                    letterSpacing: 0,
                    fontWeight: 400,
                  }}
                >
                  (opcional — mejora el cálculo de ritmos)
                </span>
              </label>
              <input
                className="fi2"
                placeholder="Ej: 8:30 (minutos:segundos)"
                value={pForm.time1600}
                onChange={(e) =>
                  setPForm((p) => ({ ...p, time1600: e.target.value }))
                }
              />
              {zones && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "10px 12px",
                    background: "rgba(255,69,0,.06)",
                    borderRadius: 6,
                    fontSize: ".78rem",
                    color: "var(--mu)",
                  }}
                >
                  <span style={{ color: "var(--or)", fontWeight: 700 }}>
                    Zonas calculadas:{" "}
                  </span>
                  Fácil: {zones.easy} · Tempo: {zones.tempo} · Intervalos 1K:{" "}
                  {zones.interval_1k}
                </div>
              )}
            </div>
            <button
              className="btnp"
              style={{ width: "100%", padding: 14, marginTop: 8 }}
              onClick={() => {
                if (!pForm.weight || !pForm.height) {
                  alert("Completá peso y altura para continuar.");
                  return;
                }
                setOnboardingStep(2);
              }}
            >
              Continuar →
            </button>
          </>
        )}

        {/* ── STEP 2: Auth ── */}
        {onboardingStep === 2 && (
          <>
            <div
              style={{
                fontSize: ".72rem",
                color: "var(--or)",
                fontWeight: 700,
                letterSpacing: "2px",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Paso 2 de 3
            </div>
            <h1
              style={{
                fontFamily: "var(--fd)",
                fontSize: "2rem",
                marginBottom: 12,
              }}
            >
              CREÁ TU CUENTA
            </h1>
            <p
              style={{
                color: "var(--mu)",
                fontSize: ".88rem",
                marginBottom: 20,
              }}
            >
              Para guardar tu plan y acceder desde cualquier dispositivo.
              Gratis.
            </p>
            {user ? (
              <div
                style={{
                  padding: 20,
                  borderRadius: 12,
                  background: "rgba(34,197,94,.08)",
                  border: "1px solid rgba(34,197,94,.3)",
                  color: "#22c55e",
                  marginBottom: 20,
                }}
              >
                ✓ Sesión activa como {user.email}
              </div>
            ) : (
              <>
                <div className="mtabs" style={{ marginBottom: 20 }}>
                  <button
                    className={`mtab ${authTab === "register" ? "act" : ""}`}
                    onClick={() => setAuthTab("register")}
                  >
                    Crear cuenta
                  </button>
                  <button
                    className={`mtab ${authTab === "login" ? "act" : ""}`}
                    onClick={() => setAuthTab("login")}
                  >
                    Ya tengo cuenta
                  </button>
                </div>
                <div className="fg">
                  <label className="fl">Email</label>
                  <input
                    className="fi2"
                    type="email"
                    placeholder="tu@email.com"
                    value={authForm.email}
                    onChange={(e) =>
                      setAuthForm((p) => ({ ...p, email: e.target.value }))
                    }
                    autoComplete="email"
                  />
                </div>
                <div className="fg">
                  <label className="fl">Contraseña</label>
                  <input
                    className="fi2"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={authForm.password}
                    onChange={(e) =>
                      setAuthForm((p) => ({ ...p, password: e.target.value }))
                    }
                  />
                </div>
                {authErr && <div className="ferr">{authErr}</div>}
                <button
                  className="btnp"
                  style={{ width: "100%", padding: 14, marginTop: 8 }}
                  disabled={authLoading}
                  onClick={async () => {
                    setAuthErr("");
                    setAuthLoading(true);
                    try {
                      const u =
                        authTab === "login"
                          ? await fbLogin(authForm.email, authForm.password)
                          : await fbRegister(authForm.email, authForm.password);
                      setUser(u);
                      window.localStorage.setItem(
                        "paceai_user",
                        JSON.stringify(u),
                      );
                      await refreshUserData(u);
                      setAuthForm({ email: "", password: "" });
                      setOnboardingStep(3);
                    } catch (e) {
                      setAuthErr(
                        e.message
                          .replace(
                            "EMAIL_EXISTS",
                            "Email ya registrado. Usá 'Ya tengo cuenta'.",
                          )
                          .replace(
                            "INVALID_LOGIN_CREDENTIALS",
                            "Email o contraseña incorrectos.",
                          )
                          .replace(/_/g, " "),
                      );
                    }
                    setAuthLoading(false);
                  }}
                >
                  {authLoading
                    ? "Cargando..."
                    : authTab === "login"
                      ? "Ingresar"
                      : "Crear cuenta gratuita"}
                </button>
              </>
            )}
            {user && (
              <button
                className="btnp"
                style={{ width: "100%", padding: 14 }}
                onClick={() => setOnboardingStep(3)}
              >
                Continuar →
              </button>
            )}
            <button
              className="btns"
              style={{ width: "100%", padding: 12, marginTop: 10 }}
              onClick={() => setOnboardingStep(1)}
            >
              ← Volver
            </button>
          </>
        )}

        {/* ── STEP 3: Lifestyle data ── */}
        {onboardingStep === 3 && (
          <>
            <div
              style={{
                fontSize: ".72rem",
                color: "var(--or)",
                fontWeight: 700,
                letterSpacing: "2px",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Paso 3 de 3 — ¡Casi listo! 🏃
            </div>
            <h1
              style={{
                fontFamily: "var(--fd)",
                fontSize: "2rem",
                marginBottom: 12,
              }}
            >
              TU ESTILO DE VIDA
            </h1>
            <p
              style={{
                color: "var(--mu)",
                fontSize: ".88rem",
                marginBottom: 20,
              }}
            >
              La IA ajusta la carga del plan según tu día a día.
            </p>
            <div className="fg">
              <label className="fl">¿Cómo es tu ritmo de vida?</label>
              <div className="lgrid">
                {[
                  ["acelerado", "🔥", "Muy activo"],
                  ["moderado", "🚶", "Normal"],
                  ["tranquilo", "😌", "Tranquilo"],
                ].map(([id, ic, lb]) => (
                  <div
                    key={id}
                    className={`lopt ${pForm.lifeRhythm === id ? "sel" : ""}`}
                    onClick={() => setPForm((p) => ({ ...p, lifeRhythm: id }))}
                  >
                    <span className="lic">{ic}</span>
                    <span className="ln">{lb}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="fg">
              <label className="fl">Alimentación</label>
              <select
                className="fi2 fsel"
                value={pForm.alimentacion}
                onChange={(e) =>
                  setPForm((p) => ({ ...p, alimentacion: e.target.value }))
                }
              >
                <option value="sin_restricciones">Sin restricciones</option>
                <option value="carnivoro">Alta en proteínas</option>
                <option value="vegetariano">Vegetariana</option>
                <option value="vegano">Vegana</option>
                <option value="keto">Keto / Baja en carbos</option>
              </select>
            </div>
            <div className="fg">
              <label className="fl">Tu nombre</label>
              <input
                className="fi2"
                placeholder="¿Cómo te llamás?"
                value={pForm.name}
                onChange={(e) =>
                  setPForm((p) => ({ ...p, name: e.target.value }))
                }
              />
            </div>
            <div className="fg">
              <label className="fl">
                Tiempo objetivo para esta carrera{" "}
                <span
                  style={{
                    color: "var(--mu)",
                    textTransform: "none",
                    letterSpacing: 0,
                    fontWeight: 400,
                  }}
                >
                  (opcional)
                </span>
              </label>
              <input
                className="fi2"
                placeholder={
                  race?.distance?.includes("42")
                    ? "Ej: 4:00:00"
                    : race?.distance?.includes("21")
                      ? "Ej: 2:00:00"
                      : "Ej: 55:00"
                }
                value={pForm.goalTime || ""}
                onChange={(e) =>
                  setPForm((p) => ({ ...p, goalTime: e.target.value }))
                }
              />
              {paceWarn && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "10px 12px",
                    background: "rgba(255,165,0,.08)",
                    borderRadius: 6,
                    fontSize: ".78rem",
                    color: "#ff9800",
                  }}
                >
                  {paceWarn}
                </div>
              )}
            </div>
            <button
              className="btnp"
              style={{
                width: "100%",
                padding: 16,
                marginTop: 8,
                fontSize: "1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
              onClick={async () => {
                if (user) {
                  await fbSet("users", user.uid, pForm, user.token).catch(
                    () => null,
                  );
                  window.localStorage.setItem(
                    "paceai_profile",
                    JSON.stringify(pForm),
                  );
                }
                setProfile(pForm);
                setOnboardingStep(0);
                // Freemium check
                if (!activeSubscription && plans.length >= 3) {
                  setPaymentError(
                    "Has alcanzado 3 planes gratis. Activá ILIMITADO para generar más.",
                  );
                  setView("plans");
                  return;
                }
                genTrainPlan(selRace, user);
              }}
            >
              🤖 Generar mi plan personalizado
            </button>
            <button
              className="btns"
              style={{ width: "100%", padding: 12, marginTop: 10 }}
              onClick={() => setOnboardingStep(2)}
            >
              ← Volver
            </button>
          </>
        )}
      </div>
    );
  };

  const VIEWS = {
    home: renderHome,
    calendar: renderCalendar,
    race: renderRace,
    profile: renderProfile,
    plans: renderPlans,
    coach: renderCoach,
    training: renderTraining,
    postrace: renderPostRace,
    tourism: renderTourism,
    myraces: renderMyRaces,
    onboarding: renderOnboarding,
    admin: () => <AdminPanel user={user} projectId={FB.projectId} />,
  };

  return (
    <div className="app">
      <style>{CSS}</style>
      {showAuth && (
        <AuthModal
          authTab={authTab}
          setAuthTab={(tab) => {
            setAuthTab(tab);
            setAuthErr("");
          }}
          authForm={authForm}
          setAuthForm={setAuthForm}
          authLoading={authLoading}
          authErr={authErr}
          doAuth={doAuth}
          onClose={() => setShowAuth(false)}
        />
      )}
      <nav className="nav">
        <div className="logo" onClick={() => setView("home")}>
          PACE<span>AI</span>
        </div>
        <div className="nav-links">
          {[
            ["home", "Inicio"],
            ["calendar", "Carreras"],
            ["tourism", "Turismo"],
            ["postrace", "Post-carrera"],
            ["plans", "Planes"],
            ["coach", "PaceAI 🤖"],
          ].map(([id, lb]) => (
            <button
              key={id}
              className={`nl ${view === id ? "act" : ""}`}
              onClick={() => setView(id)}
            >
              {lb}
            </button>
          ))}
          {user && (
            <button
              className={`nl ${view === "myraces" ? "act" : ""}`}
              onClick={() => setView("myraces")}
            >
              Mis Carreras
            </button>
          )}
          {user?.email === "marcelorodriguezestrada@gmail.com" && (
            <button
              className={`nl ${view === "admin" ? "act" : ""}`}
              onClick={() => setView("admin")}
              style={{ color: view === "admin" ? "#FFD700" : "#555" }}
            >
              📊 Admin
            </button>
          )}
        </div>
        <div className="nav-r">
          {user ? (
            <>
              <div
                style={{
                  textAlign: "right",
                  marginRight: 10,
                  color: "var(--mu)",
                  fontSize: ".78rem",
                }}
              >
                {activeSubscription
                  ? `${activeSubscription.planName} activo`
                  : "BÁSICO gratis"}
              </div>
              <button
                className="ava"
                onClick={() => setView("profile")}
                title={user.email}
              >
                {user.email[0].toUpperCase()}
              </button>
              <button className="nl" onClick={logout} style={{ marginLeft: 8 }}>
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <button
                className="nav-btn"
                style={{
                  background: "transparent",
                  color: "var(--or)",
                  border: "1px solid var(--or)",
                }}
                onClick={() => setShowAuth(true)}
              >
                Ingresar
              </button>
              <button className="nav-btn" onClick={() => setView("profile")}>
                Mi perfil
              </button>
            </>
          )}
        </div>
      </nav>
      <main>{(VIEWS[view] || VIEWS.home)()}</main>
    </div>
  );
}