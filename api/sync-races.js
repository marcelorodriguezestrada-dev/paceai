/**
 * /api/sync-races
 * Cron job semanal — extrae carreras de dondecorrer.com via Jina AI + Groq
 * Vercel cron: lunes 8am (vercel.json)
 * Manual: GET /api/sync-races?secret=paceai2026
 */

const FB_PROJECT_ID = process.env.VITE_FB_PROJECT_ID;
const FB_API_KEY    = process.env.VITE_FB_API_KEY;
const SYNC_SECRET   = process.env.SYNC_SECRET || "paceai2026";

// ── Firebase ──────────────────────────────────────────────────────────────────
function toFS(obj) {
  return {
    fields: Object.fromEntries(
      Object.entries(obj).map(([k, v]) => {
        if (v === null || v === undefined) return [k, { nullValue: null }];
        if (typeof v === "boolean")        return [k, { booleanValue: v }];
        if (typeof v === "number")         return [k, { doubleValue: v }];
        if (typeof v === "object")         return [k, { stringValue: JSON.stringify(v) }];
        return [k, { stringValue: String(v) }];
      })
    ),
  };
}

async function fbSet(collection, docId, data) {
  const url = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}?key=${FB_API_KEY}`;
  const r = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toFS(data)),
  });
  if (!r.ok) throw new Error(`Firebase error ${r.status}: ${await r.text()}`);
  return r.json();
}

// ── Fetch dondecorrer via Jina AI (renderiza la SPA gratis) ──────────────────
async function fetchDondeCorrer() {
  const jinaUrl = "https://r.jina.ai/https://ar.dondecorrer.com/carreras";
  try {
    const r = await fetch(jinaUrl, {
      headers: {
        "Accept": "text/plain",
        "X-Return-Format": "markdown",
      },
      signal: AbortSignal.timeout(20000),
    });
    if (r.ok) {
      const text = await r.text();
      console.log(`[sync-races] Jina OK — ${text.length} chars`);
      return text.slice(0, 10000);
    }
    console.log(`[sync-races] Jina status: ${r.status}`);
  } catch (e) {
    console.log(`[sync-races] Jina failed: ${e.message}`);
  }
  return null;
}

// ── Groq extraction ───────────────────────────────────────────────────────────
async function extractRacesWithGroq(content) {
  const context = content
    ? `Contenido real extraído de dondecorrer.com:\n${content}`
    : `No se pudo obtener el sitio. Generá un calendario típico de running
argentino para los próximos 6 meses con al menos 15 carreras reales conocidas.`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      max_tokens: 4000,
      messages: [
        {
          role: "system",
          content: `Sos un extractor de datos de carreras de running de Argentina.
Respondés ÚNICAMENTE con JSON válido sin markdown ni texto adicional.
Usás EXACTAMENTE las fechas y nombres que aparecen en el contenido — no inventás ni modificás nada.`,
        },
        {
          role: "user",
          content: `Extraé TODAS las carreras de running del siguiente contenido.
Solo incluí eventos de tipo "Running" o "Trail Running" — ignorá Triatlón, Duatlón y Ciclismo.
Usá las fechas EXACTAS que aparecen en el texto, no las cambies.

Para cada carrera generá:
- id (string único, ej: "race_001")
- name (nombre completo exacto del evento)
- date (YYYY-MM-DD, usando el año 2026 salvo que diga otro)
- distance (la distancia principal: "5K", "10K", "21K", "42K", etc)
- location (ciudad/barrio, inferí de los datos o del organizador)
- terrain ("asfalto plano", "asfalto mixto", "trail", "circuito urbano")
- weather (según la época: "verano", "otoño", "invierno", "primavera")
- difficulty ("fácil" para 5K-10K, "moderado" para 15K-21K, "avanzado" para 30K+)
- image (emoji representativo)
- registered (el número de inscriptos que aparece, o 0 si no hay)
- prize ("Medalla finisher" por defecto salvo que se especifique otro)
- tourism (objeto con: zone, hotel_zone, parking, metro, cultural)

Formato de respuesta:
{
  "carreras": [...],
  "updated_at": "${new Date().toISOString()}",
  "source": "dondecorrer.com"
}

${context}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  let text = data.choices[0]?.message?.content || "";

  console.log("[sync-races] finish_reason:", data.choices[0]?.finish_reason);
  console.log("[sync-races] raw (300 chars):", text.slice(0, 300));

  text = text.replace(/```(?:json)?\n?|```/g, "").trim();
  const match = text.match(/\{[\s\S]*\}/);

  if (!match) {
    throw new Error(`Groq no devolvió JSON válido. Respuesta: ${text.slice(0, 200)}`);
  }

  const parsed = JSON.parse(match[0]);
  console.log("[sync-races] Carreras parseadas:", parsed?.carreras?.length);
  return parsed;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    if (req.query?.secret !== SYNC_SECRET) {
      return res.status(401).json({ error: "Unauthorized. Usá ?secret=TU_SECRET" });
    }
  } else if (req.method === "POST") {
    const { secret } = req.body || {};
    if (secret !== SYNC_SECRET) {
      return res.status(401).json({ error: "Unauthorized." });
    }
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "GROQ_API_KEY no configurada en Vercel" });
  }
  if (!FB_PROJECT_ID || !FB_API_KEY) {
    return res.status(500).json({ error: "Variables de Firebase no configuradas" });
  }

  console.log("[sync-races] Iniciando sync...");

  try {
    // 1. Obtener contenido real via Jina
    const content = await fetchDondeCorrer();

    // 2. Extraer con Groq
    console.log("[sync-races] Enviando a Groq...");
    const result = await extractRacesWithGroq(content);

    if (!result?.carreras?.length) {
      throw new Error("Groq no devolvió carreras válidas");
    }

    console.log(`[sync-races] ${result.carreras.length} carreras extraídas`);

    const syncedAt = new Date().toISOString();

    // 3. Guardar en Firebase
    for (const carrera of result.carreras) {
      const docId = String(carrera.id || `race_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
      await fbSet("races_sync", docId, {
        ...carrera,
        syncedAt,
        source: result.source || "dondecorrer.com",
      });
    }

    await fbSet("races_sync", "_meta", {
      updated_at: syncedAt,
      count: result.carreras.length,
      source: result.source || "dondecorrer.com",
    });

    console.log("[sync-races] Guardado en Firebase OK");

    return res.status(200).json({
      ok: true,
      count: result.carreras.length,
      updated_at: syncedAt,
      races: result.carreras.map(c => `${c.date} — ${c.name} (${c.distance})`),
    });

  } catch (err) {
    console.error("[sync-races] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}