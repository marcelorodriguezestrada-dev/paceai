/**
 * PaceAI — Datos estáticos de carreras (fallback mientras no hay Firebase)
 * Cuando el scraper corre, estos se reemplazan por datos de Firestore
 */

export const RACES_STATIC = [
  { id: 1, name: "10K Palermo Classic",           date: "2025-07-13", distance: "10K", location: "Parque Tres de Febrero, CABA",  terrain: "asfalto plano",       weather: "invierno",        difficulty: "fácil",    image: "🏃",  registered: 3200,  prize: "Medalla + remera técnica",        tourism: { zone: "Palermo", hotel_zone: "Palermo Soho / Las Cañitas", parking: "Av. del Libertador y Av. Sarmiento", metro: "D - Palermo", cultural: "MALBA, Planetario, Jardín Japonés" }},
  { id: 2, name: "Media Maratón de Buenos Aires",  date: "2025-08-17", distance: "21K", location: "Av. Figueroa Alcorta, CABA",    terrain: "asfalto mixto",       weather: "invierno tardío", difficulty: "moderado", image: "🌆",  registered: 8500,  prize: "Medalla finisher + cronometraje", tourism: { zone: "Recoleta / Palermo", hotel_zone: "Recoleta, Retiro o Palermo", parking: "Costa Salguero o Figueroa Alcorta", metro: "D - Facultad de Medicina", cultural: "Cementerio Recoleta, Floralis Genérica" }},
  { id: 3, name: "5K Nocturna del Rosedal",        date: "2025-09-06", distance: "5K",  location: "Jardín Japonés, CABA",         terrain: "caminos de tierra",   weather: "primavera",       difficulty: "fácil",    image: "🌙",  registered: 1800,  prize: "Medalla iluminada",               tourism: { zone: "Palermo", hotel_zone: "Palermo Hollywood / Soho", parking: "Av. Casares o Av. del Libertador", metro: "D - Palermo", cultural: "Planetario nocturno, Bosques de Palermo" }},
  { id: 4, name: "Maratón de Buenos Aires",        date: "2025-10-19", distance: "42K", location: "Obelisco — Av. Corrientes",    terrain: "asfalto con adoquines",weather: "primavera cálida",difficulty: "avanzado", image: "🏆",  registered: 12000, prize: "Medalla + camiseta oficial",     tourism: { zone: "Centro / San Telmo / Puerto Madero", hotel_zone: "Microcentro, San Telmo o Puerto Madero", parking: "Subterráneo Catalinas, Retiro", metro: "B - Callao, C - Diagonal Norte", cultural: "Caminito, Feria San Telmo, Teatro Colón" }},
  { id: 5, name: "21K Villa del Parque",           date: "2025-11-02", distance: "21K", location: "Parque del Centenario, CABA",  terrain: "circuito urbano",     weather: "primavera",       difficulty: "moderado", image: "🌳",  registered: 4200,  prize: "Finisher kit completo",          tourism: { zone: "Villa del Parque / Caballito", hotel_zone: "Caballito o Villa del Parque", parking: "Av. Ángel Gallardo al 700", metro: "B - Ángel Gallardo", cultural: "Parque del Centenario, feria de coleccionistas" }},
  { id: 6, name: "Trail Sierra Ventana",           date: "2025-11-30", distance: "30K", location: "Sierra de la Ventana, Bs. As.",terrain: "montaña y senderos",  weather: "verano inicial",  difficulty: "avanzado", image: "⛰️",  registered: 900,   prize: "Trofeo artesanal",               tourism: { zone: "Sierra de la Ventana", hotel_zone: "Villa Ventana o Tornquist", parking: "Club Atlético Sierra de la Ventana", metro: "Tren desde Constitución o auto", cultural: "Cerro Tres Picos, Cueva Pinturas Rupestres" }},
]

export const PLANS = [
  { id: "basico",    name: "BÁSICO",    price: "Gratis",      color: "#555",    accent: "#999",    popular: false,
    features: ["Hasta 3 carreras registradas", "1 mes de plan de entrenamiento", "Resumen semanal de actividades", "Calendario de carreras BA", "Acceso comunidad básica"],
    cta: "Comenzar gratis" },
  { id: "ilimitado", name: "ILIMITADO", price: "$4.990/mes",  color: "#FF4500", accent: "#FF6B35", popular: true,
    features: ["Carreras ilimitadas", "Coaching en nutrición y alimentación", "Gestión del esfuerzo por etapas", "Análisis post-carrera con fotos", "Guía turística por sede de carrera", "Chat con IA sin límites"],
    cta: "Activar plan" },
  { id: "experto",   name: "EXPERTO",   price: "$9.990/mes",  color: "#FFD700", accent: "#FFF176", popular: false,
    features: ["Todo lo anterior", "Métricas avanzadas: VO2Max, lactato", "Planes por ritmo (pace) personalizado", "Análisis biomecánico por video", "Sesiones 1:1 con coach humano", "Acceso a biblioteca de corredores élite"],
    cta: "Quiero optimizar" },
]

export const daysUntil = (d) => Math.ceil((new Date(d) - new Date()) / 86400000)
export const diffColor = { "fácil": "#4CAF50", "moderado": "#FF9800", "avanzado": "#FF4500" }
