/**
 * useRaces — carga carreras desde Firebase (sync automático) 
 * con fallback al array hardcodeado si Firebase no tiene datos
 * 
 * Formato Firebase: un documento por carrera en colección "races_sync"
 * (generado por /api/sync-races)
 */
import { useState, useEffect } from "react";

const RACES_FALLBACK = [
  {
    id: 1, name: "10K Palermo Classic", date: "2026-07-12", distance: "10K",
    location: "Parque Tres de Febrero, CABA", terrain: "asfalto plano",
    weather: "invierno", difficulty: "fácil", image: "🏃", registered: 3200,
    prize: "Medalla + remera técnica",
    tourism: { zone: "Palermo", hotel_zone: "Palermo Soho / Las Cañitas", parking: "Av. del Libertador y Av. Sarmiento", metro: "D - Palermo", cultural: "MALBA, Planetario, Jardín Japonés" },
  },
  {
    id: 2, name: "Media Maratón de Buenos Aires", date: "2026-08-16", distance: "21K",
    location: "Av. Figueroa Alcorta, CABA", terrain: "asfalto mixto",
    weather: "invierno tardío", difficulty: "moderado", image: "🌆", registered: 8500,
    prize: "Medalla finisher + cronometraje",
    tourism: { zone: "Recoleta / Palermo", hotel_zone: "Recoleta, Retiro o Palermo", parking: "Playa Figueroa Alcorta", metro: "D - Facultad de Medicina", cultural: "Cementerio de la Recoleta, Floralis Genérica" },
  },
  {
    id: 3, name: "5K Nocturna del Rosedal", date: "2026-09-06", distance: "5K",
    location: "Jardín Japonés, CABA", terrain: "caminos de tierra",
    weather: "primavera", difficulty: "fácil", image: "🌙", registered: 1800,
    prize: "Medalla iluminada",
    tourism: { zone: "Palermo", hotel_zone: "Palermo Hollywood / Soho", parking: "Av. Casares", metro: "D - Palermo", cultural: "Planetario, Rosedal" },
  },
  {
    id: 4, name: "Maratón de Buenos Aires", date: "2026-10-18", distance: "42K",
    location: "Obelisco — Av. Corrientes", terrain: "asfalto con adoquines",
    weather: "primavera cálida", difficulty: "avanzado", image: "🏆", registered: 12000,
    prize: "Medalla + camiseta oficial",
    tourism: { zone: "Centro / San Telmo / Puerto Madero", hotel_zone: "Microcentro, San Telmo", parking: "Subterráneo Catalinas", metro: "B - Callao, C - Diagonal Norte", cultural: "Caminito, Teatro Colón, Puerto Madero" },
  },
  {
    id: 5, name: "21K Villa del Parque", date: "2026-11-01", distance: "21K",
    location: "Parque del Centenario, CABA", terrain: "circuito urbano",
    weather: "primavera", difficulty: "moderado", image: "🌳", registered: 4200,
    prize: "Finisher kit completo",
    tourism: { zone: "Villa del Parque / Caballito", hotel_zone: "Caballito", parking: "Av. Ángel Gallardo al 700", metro: "B - Ángel Gallardo", cultural: "Parque del Centenario, Planetario" },
  },
  {
    id: 6, name: "Trail Sierra Ventana", date: "2026-11-29", distance: "30K",
    location: "Sierra de la Ventana, Bs. As.", terrain: "montaña y senderos",
    weather: "verano inicial", difficulty: "avanzado", image: "⛰️", registered: 900,
    prize: "Trofeo artesanal + experiencia única",
    tourism: { zone: "Sierra de la Ventana (600km de CABA)", hotel_zone: "Villa Ventana, Tornquist", parking: "Club Atlético Sierra de la Ventana", metro: "No aplica — tren desde Constitución", cultural: "Cerro Tres Picos, Cueva Pinturas Rupestres" },
  },
];

function raceImage(distance = "") {
  const d = distance.toLowerCase();
  if (d.includes("42")) return "🏆";
  if (d.includes("21")) return "🌆";
  if (d.includes("trail") || d.includes("mtn")) return "⛰️";
  if (d.includes("10")) return "🏃";
  if (d.includes("5"))  return "🌙";
  return "🏅";
}

// Parsear un documento Firestore al objeto JS plano
function fromFS(doc) {
  if (!doc?.fields) return null;
  return Object.fromEntries(
    Object.entries(doc.fields).map(([k, v]) => {
      const val = v.stringValue ?? v.integerValue ?? v.doubleValue ?? v.booleanValue ?? null;
      try { return [k, JSON.parse(val)]; } catch { return [k, val]; }
    })
  );
}

export function useRaces(fbApiKey, fbProjectId) {
  const [races, setRaces]     = useState(RACES_FALLBACK);
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [source, setSource]   = useState("local");

  useEffect(() => {
    if (!fbApiKey || !fbProjectId) return;
    loadFromFirebase();
  }, [fbApiKey, fbProjectId]);

  const loadFromFirebase = async () => {
    setLoading(true);
    try {
      // Lee TODOS los docs de races_sync (un doc por carrera + _meta)
      const url = `https://firestore.googleapis.com/v1/projects/${fbProjectId}/databases/(default)/documents/races_sync?key=${fbApiKey}&pageSize=50`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Firebase error ${r.status}`);
      const d = await r.json();

      if (!d.documents || d.documents.length === 0) {
        throw new Error("Colección vacía");
      }

      const now = new Date().toISOString().split("T")[0];
      const normalized = [];
      let syncedAt = null;

      for (const doc of d.documents) {
        const id = doc.name.split("/").pop();

        // Saltar el doc de metadata
        if (id === "_meta") {
          const meta = fromFS(doc);
          syncedAt = meta?.updated_at || null;
          continue;
        }

        const c = fromFS(doc);
        if (!c || !c.date) continue;

        // Solo carreras futuras
        if (c.date < now) continue;

        normalized.push({
          id:         c.id       || id,
          name:       c.name     || c.nombre    || "Sin nombre",
          date:       c.date     || c.fecha     || "",
          distance:   c.distance || c.distancia || "10K",
          location:   c.location || c.ubicacion || "Buenos Aires",
          terrain:    c.terrain  || c.terreno   || "asfalto",
          weather:    c.weather  || "variable",
          difficulty: c.difficulty || c.dificultad || "moderado",
          image:      c.image    || raceImage(c.distance || c.distancia || ""),
          registered: Number(c.registered) || 0,
          prize:      c.prize    || c.premio    || "Medalla finisher",
          source:     c.source   || "dondecorrer",
          syncedAt:   c.syncedAt || syncedAt    || null,
          tourism:    c.tourism  || {
            zone:       c.location || "Buenos Aires",
            hotel_zone: "Buenos Aires",
            parking:    "Consultar organización",
            metro:      "Consultar mapa",
            cultural:   "Buenos Aires",
          },
        });
      }

      // Ordenar por fecha ascendente
      normalized.sort((a, b) => a.date.localeCompare(b.date));

      if (normalized.length > 0) {
        setRaces(normalized);
        setSource("firebase");
        setLastSync(syncedAt);
        console.log(`[useRaces] ${normalized.length} carreras cargadas desde Firebase (sync: ${syncedAt})`);
      } else {
        console.log("[useRaces] Sin carreras futuras en Firebase, usando fallback");
        setSource("local");
      }
    } catch (err) {
      console.log("[useRaces] Firebase falló, usando fallback:", err.message);
      setSource("local");
    }
    setLoading(false);
  };

  return { races, loading, lastSync, source, reload: loadFromFirebase };
}