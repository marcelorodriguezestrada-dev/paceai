import { useState, useEffect } from "react";

// ─── Data extraída del PDF (Prof. Diego Hortiguera) ───────────────────────────
const PLAN_DATA = {
  nombre: "Marcelo Rodriguez",
  objetivo: "Maratón de Bs As",
  periodo: "09/08/16 al 11/09/16",
  sesiones: [
    { mes: "AGO", fecha: 9,  dia: "Mar", sesion: "10' suaves + 2 x 3000m en 13'30\" (4'30\") P:1'30\" + 10'/15' suaves" },
    { mes: "AGO", fecha: 10, dia: "Mie", sesion: null },
    { mes: "AGO", fecha: 11, dia: "Jue", sesion: "10' suaves + 3000m en 13'30\" (4'30\") + 2000m en 8'50\" (4'25\") + 1000m (4'20\") P:1'40\" + 10' suaves" },
    { mes: "AGO", fecha: 12, dia: "Vie", sesion: null },
    { mes: "AGO", fecha: 13, dia: "Sab", sesion: "Fondo suave de 26km", tipo: "fondo" },
    { mes: "AGO", fecha: 14, dia: "Dom", sesion: null },
    { mes: "AGO", fecha: 15, dia: "Lun", sesion: null },
    { mes: "AGO", fecha: 16, dia: "Mar", sesion: "10' suaves + 2 x 4000m en 18'40\" (4'40\") P:1'20\" + 10'/15' suaves" },
    { mes: "AGO", fecha: 17, dia: "Mie", sesion: null },
    { mes: "AGO", fecha: 18, dia: "Jue", sesion: "10' suaves + 4 x 2000m 9'00\" (4'30\") P:1'40\" + 10'/15' suaves" },
    { mes: "AGO", fecha: 19, dia: "Vie", sesion: null },
    { mes: "AGO", fecha: 20, dia: "Sab", sesion: "Fondo suave de 30km", tipo: "fondo" },
    { mes: "AGO", fecha: 21, dia: "Dom", sesion: null },
    { mes: "AGO", fecha: 22, dia: "Lun", sesion: null },
    { mes: "AGO", fecha: 23, dia: "Mar", sesion: "15' suaves + 7 x 1000m (4'20\") P:1'40\" + 15' suaves" },
    { mes: "AGO", fecha: 24, dia: "Mie", sesion: null },
    { mes: "AGO", fecha: 25, dia: "Jue", sesion: "10' suaves + 2 x 4000m en 18'40\" (4'40\") P:1'20\" + 10'/15' suaves" },
    { mes: "AGO", fecha: 26, dia: "Vie", sesion: null },
    { mes: "AGO", fecha: 27, dia: "Sab", sesion: "Fondo suave de 25km", tipo: "fondo" },
    { mes: "AGO", fecha: 28, dia: "Dom", sesion: null },
    { mes: "AGO", fecha: 29, dia: "Lun", sesion: null },
    { mes: "AGO", fecha: 30, dia: "Mar", sesion: "15' suaves + 12 x 500m en 2'07\" (4'15\") P:1'45\" + 15' suaves" },
    { mes: "AGO", fecha: 31, dia: "Mie", sesion: null },
    { mes: "SEP", fecha: 1,  dia: "Jue", sesion: "40' trote suave + Elongación", tipo: "recuperacion" },
    { mes: "SEP", fecha: 2,  dia: "Vie", sesion: null },
    { mes: "SEP", fecha: 3,  dia: "Sab", sesion: "DESCANSO", tipo: "descanso" },
    { mes: "SEP", fecha: 4,  dia: "Dom", sesion: "MEDIA MARATÓN CIUDAD DE BS AS", tipo: "carrera" },
    { mes: "SEP", fecha: 5,  dia: "Lun", sesion: null },
    { mes: "SEP", fecha: 6,  dia: "Mar", sesion: "40' trote suave + Elongación", tipo: "recuperacion" },
    { mes: "SEP", fecha: 7,  dia: "Mie", sesion: null },
    { mes: "SEP", fecha: 8,  dia: "Jue", sesion: "60' trote suave + elongación", tipo: "recuperacion" },
    { mes: "SEP", fecha: 9,  dia: "Vie", sesion: null },
    { mes: "SEP", fecha: 10, dia: "Sab", sesion: "Fondo suave de 28km", tipo: "fondo" },
    { mes: "SEP", fecha: 11, dia: "Dom", sesion: null },
  ],
};

function getTipo(sesion) {
  if (!sesion) return "descanso";
  if (sesion.tipo) return sesion.tipo;
  if (sesion.sesion?.includes("x") || sesion.sesion?.includes("500m") || sesion.sesion?.includes("1000m")) return "series";
  return "trote";
}

const TIPO_CONFIG = {
  series:      { label: "Series",      color: "#22c55e", bg: "rgba(34,197,94,0.08)",  border: "rgba(34,197,94,0.3)" },
  fondo:       { label: "Fondo",       color: "#3b82f6", bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.3)" },
  trote:       { label: "Trote",       color: "#a3a3a3", bg: "rgba(163,163,163,0.06)", border: "rgba(163,163,163,0.2)" },
  recuperacion:{ label: "Recuperación",color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.3)" },
  carrera:     { label: "🏁 CARRERA",  color: "#ef4444", bg: "rgba(239,68,68,0.15)",  border: "rgba(239,68,68,0.6)" },
  descanso:    { label: "Descanso",    color: "#525252", bg: "transparent",           border: "transparent" },
};

const SEMANAS = (() => {
  const semanas = [];
  let sem = [];
  PLAN_DATA.sesiones.forEach((s, i) => {
    sem.push(s);
    if (sem.length === 7 || i === PLAN_DATA.sesiones.length - 1) {
      semanas.push(sem);
      sem = [];
    }
  });
  return semanas;
})();

export default function TrainingPlan() {
  const [vista, setVista] = useState("tabla"); // "tabla" | "semanas"
  const [saved] = useState(true);
  const [filtro, setFiltro] = useState("todos");

  const sesionesActivas = PLAN_DATA.sesiones.filter(s => s.sesion);
  const totalKm = PLAN_DATA.sesiones
    .filter(s => s.sesion)
    .reduce((acc, s) => {
      const match = s.sesion.match(/(\d+)km/i);
      return acc + (match ? parseInt(match[1]) : 0);
    }, 0);

  const sesionesFiltradas = filtro === "todos"
    ? PLAN_DATA.sesiones
    : PLAN_DATA.sesiones.filter(s => getTipo(s) === filtro);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      color: "#fff",
      fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
      padding: "0 0 80px",
    }}>
      {/* ── Breadcrumb ── */}
      <div style={{ padding: "24px 32px 0", fontSize: 13, color: "#525252", cursor: "pointer" }}>
        ← Carrera
      </div>

      {/* ── Header ── */}
      <div style={{ padding: "20px 32px 32px" }}>
        <h1 style={{
          fontFamily: "'Impact', 'Arial Black', sans-serif",
          fontSize: "clamp(2rem, 6vw, 3.5rem)",
          fontWeight: 900,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "#fff",
          WebkitTextStroke: "1px rgba(255,255,255,0.3)",
          margin: "0 0 8px",
          lineHeight: 1,
        }}>
          Plan de Entrenamiento
        </h1>
        <p style={{ margin: "0 0 16px", color: "#737373", fontSize: 15 }}>
          {PLAN_DATA.objetivo} · 21K · {PLAN_DATA.periodo}
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {saved && (
            <span style={{
              background: "rgba(34,197,94,0.15)",
              border: "1px solid rgba(34,197,94,0.4)",
              color: "#22c55e",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 13,
              fontWeight: 600,
            }}>
              ✓ Guardado en Firebase
            </span>
          )}
          <span style={{ color: "#525252", fontSize: 13 }}>
            Prof. Diego Hortiguera
          </span>
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        gap: 1,
        margin: "0 32px 32px",
        background: "#1a1a1a",
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid #262626",
      }}>
        {[
          { label: "Semanas", value: SEMANAS.length },
          { label: "Sesiones", value: sesionesActivas.length },
          { label: "Km fondos", value: `${totalKm}` },
          { label: "Objetivo", value: "21K" },
        ].map(stat => (
          <div key={stat.label} style={{ padding: "20px 24px", borderRight: "1px solid #262626" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#22c55e", lineHeight: 1 }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: "#525252", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ── Controles ── */}
      <div style={{ padding: "0 32px 20px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {/* Toggle vista */}
        <div style={{ display: "flex", gap: 4, background: "#1a1a1a", borderRadius: 8, padding: 4, border: "1px solid #262626" }}>
          {[["tabla", "Lista"], ["semanas", "Semanas"]].map(([v, label]) => (
            <button key={v} onClick={() => setVista(v)} style={{
              padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
              background: vista === v ? "#22c55e" : "transparent",
              color: vista === v ? "#000" : "#737373",
              transition: "all 0.15s",
            }}>{label}</button>
          ))}
        </div>

        {/* Filtro tipos */}
        {vista === "tabla" && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {["todos", "series", "fondo", "recuperacion", "carrera"].map(t => (
              <button key={t} onClick={() => setFiltro(t)} style={{
                padding: "6px 12px", borderRadius: 6, border: `1px solid ${filtro === t ? TIPO_CONFIG[t]?.color || "#22c55e" : "#262626"}`,
                background: filtro === t ? (TIPO_CONFIG[t]?.bg || "rgba(34,197,94,0.1)") : "transparent",
                color: filtro === t ? (TIPO_CONFIG[t]?.color || "#22c55e") : "#525252",
                cursor: "pointer", fontSize: 12, fontWeight: 600, textTransform: "capitalize",
                transition: "all 0.15s",
              }}>
                {t === "todos" ? "Todos" : TIPO_CONFIG[t]?.label || t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Vista Tabla ── */}
      {vista === "tabla" && (
        <div style={{ padding: "0 32px" }}>
          <div style={{ border: "1px solid #1f1f1f", borderRadius: 12, overflow: "hidden" }}>
            {/* Header tabla */}
            <div style={{
              display: "grid", gridTemplateColumns: "60px 60px 52px 1fr",
              background: "#111", padding: "10px 20px",
              borderBottom: "1px solid #1f1f1f",
            }}>
              {["MES", "FECHA", "DÍA", "SESIÓN DE ENTRENAMIENTO"].map(h => (
                <div key={h} style={{ fontSize: 10, color: "#404040", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>{h}</div>
              ))}
            </div>

            {/* Filas */}
            {sesionesFiltradas.map((s, i) => {
              const tipo = getTipo(s);
              const cfg = TIPO_CONFIG[tipo];
              const isCarrera = tipo === "carrera";
              return (
                <div key={i} style={{
                  display: "grid",
                  gridTemplateColumns: "60px 60px 52px 1fr",
                  padding: "12px 20px",
                  borderBottom: "1px solid #111",
                  background: isCarrera ? "rgba(239,68,68,0.07)" : s.sesion ? cfg.bg : "transparent",
                  borderLeft: s.sesion ? `3px solid ${cfg.color}` : "3px solid transparent",
                  transition: "background 0.1s",
                  alignItems: "center",
                }}>
                  <div style={{ fontSize: 12, color: "#404040", fontWeight: 700 }}>{s.mes}</div>
                  <div style={{ fontSize: 13, color: s.sesion ? "#fff" : "#2a2a2a", fontWeight: s.sesion ? 600 : 400 }}>{s.fecha}</div>
                  <div style={{ fontSize: 12, color: "#404040" }}>{s.dia}</div>
                  <div style={{
                    fontSize: isCarrera ? 14 : 13,
                    color: isCarrera ? "#ef4444" : s.sesion ? cfg.color === "#a3a3a3" ? "#d4d4d4" : cfg.color : "#2a2a2a",
                    fontWeight: isCarrera ? 800 : s.sesion ? 500 : 400,
                    letterSpacing: isCarrera ? "0.03em" : 0,
                  }}>
                    {s.sesion || "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Vista Semanas ── */}
      {vista === "semanas" && (
        <div style={{ padding: "0 32px", display: "flex", flexDirection: "column", gap: 24 }}>
          {SEMANAS.map((semana, si) => (
            <div key={si}>
              <div style={{
                fontSize: 11, color: "#404040", fontWeight: 700, letterSpacing: "0.12em",
                textTransform: "uppercase", marginBottom: 10,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{ color: "#22c55e" }}>Semana {si + 1}</span>
                <span style={{ flex: 1, height: 1, background: "#1f1f1f" }} />
                <span>{semana.filter(s => s.sesion).length} sesiones</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
                {semana.map((s, di) => {
                  const tipo = getTipo(s);
                  const cfg = TIPO_CONFIG[tipo];
                  return (
                    <div key={di} style={{
                      border: `1px solid ${s.sesion ? cfg.border : "#1a1a1a"}`,
                      borderRadius: 10,
                      padding: "12px 10px",
                      background: s.sesion ? cfg.bg : "#0d0d0d",
                      minHeight: 100,
                    }}>
                      <div style={{ fontSize: 10, color: "#404040", fontWeight: 700, marginBottom: 4 }}>
                        {s.dia?.toUpperCase()} {s.fecha}
                      </div>
                      {s.sesion ? (
                        <>
                          <div style={{
                            fontSize: 10, color: cfg.color, fontWeight: 700,
                            textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6,
                          }}>
                            {cfg.label}
                          </div>
                          <div style={{ fontSize: 11, color: "#a3a3a3", lineHeight: 1.5 }}>
                            {s.sesion}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: 11, color: "#2a2a2a", marginTop: 4 }}>Descanso</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Leyenda ── */}
      <div style={{ padding: "32px 32px 0", display: "flex", gap: 16, flexWrap: "wrap" }}>
        {Object.entries(TIPO_CONFIG).filter(([k]) => k !== "descanso" && k !== "trote").map(([k, v]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#525252" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: v.color, display: "inline-block" }} />
            {v.label}
          </div>
        ))}
      </div>
    </div>
  );
}