import { useState, useRef, useEffect } from "react";

/**
 * CalendarTimeline — Barra de progreso semanal con hitos de carrera
 *
 * Props:
 *   weeks        : array de semanas del plan (del JSON generado por IA)
 *   activeWeek   : índice activo (0-based)
 *   onWeekChange : función(índice)
 *   races        : array de { name, date, distance, image } — carreras en el plan
 *   startDate    : Date — fecha de inicio del plan (hoy)
 */
export default function CalendarTimeline({
  weeks = [],
  activeWeek = 0,
  onWeekChange,
  races = [],
  startDate,
}) {
  const scrollRef = useRef(null);
  const activeRef = useRef(null);

  const totalWeeks = weeks.length;
  if (totalWeeks === 0) return null;

  const planStart = startDate || new Date();

  // Para cada carrera, calcular en qué semana cae
  const raceMilestones = races.map((race) => {
    const raceDate = new Date(race.date);
    const diffMs = raceDate - planStart;
    const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
    const weekIdx = Math.min(Math.max(0, diffWeeks - 1), totalWeeks - 1);
    return { ...race, weekIdx };
  });

  // Agrupar hitos por semana
  const milestoneByWeek = {};
  raceMilestones.forEach((m) => {
    if (!milestoneByWeek[m.weekIdx]) milestoneByWeek[m.weekIdx] = [];
    milestoneByWeek[m.weekIdx].push(m);
  });

  // Scroll al elemento activo cuando cambia
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [activeWeek]);

  // Fase del macrociclo para colorear la barra
  const phaseColors = {
    "Base / Fuerza": "#3b82f6",
    Específica: "#f59e0b",
    Sharpening: "#ef4444",
    Tapering: "#22c55e",
    Activación: "#3b82f6",
    "Específica compacta": "#f59e0b",
  };

  const getPhaseColor = (sem) => {
    const fase = sem?.fase || "";
    return phaseColors[fase] || "#FF4500";
  };

  return (
    <div
      style={{
        background: "var(--bg2)",
        border: "1px solid var(--bd)",
        borderRadius: 12,
        padding: "16px 0 12px",
        marginBottom: 20,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 18px",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: ".72rem",
            color: "var(--or)",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          Cronograma del plan
        </div>
        <div style={{ fontSize: ".78rem", color: "var(--mu)" }}>
          Semana{" "}
          <span style={{ color: "var(--or)", fontWeight: 700 }}>
            {activeWeek + 1}
          </span>{" "}
          de {totalWeeks}
        </div>
      </div>

      {/* Progress bar general */}
      <div style={{ padding: "0 18px", marginBottom: 14 }}>
        <div
          style={{
            height: 4,
            background: "var(--bd)",
            borderRadius: 2,
            position: "relative",
            overflow: "visible",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${((activeWeek + 1) / totalWeeks) * 100}%`,
              background: "var(--or)",
              borderRadius: 2,
              transition: "width .3s ease",
            }}
          />
          {/* Marcadores de carrera sobre la barra */}
          {raceMilestones.map((m, i) => {
            const pct = ((m.weekIdx + 1) / totalWeeks) * 100;
            return (
              <div
                key={i}
                title={`${m.name} — Semana ${m.weekIdx + 1}`}
                style={{
                  position: "absolute",
                  top: -6,
                  left: `${pct}%`,
                  transform: "translateX(-50%)",
                  width: 16,
                  height: 16,
                  background: "#FF4500",
                  border: "2px solid var(--bg2)",
                  borderRadius: "50%",
                  cursor: "pointer",
                  zIndex: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "8px",
                }}
                onClick={() => onWeekChange && onWeekChange(m.weekIdx)}
              >
                🏁
              </div>
            );
          })}
        </div>

        {/* Etiquetas de hitos bajo la barra */}
        {raceMilestones.length > 0 && (
          <div style={{ position: "relative", height: 28, marginTop: 8 }}>
            {raceMilestones.map((m, i) => {
              const pct = ((m.weekIdx + 1) / totalWeeks) * 100;
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${pct}%`,
                    transform: "translateX(-50%)",
                    fontSize: ".66rem",
                    color: "var(--or)",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    textAlign: "center",
                  }}
                >
                  Sem {m.weekIdx + 1}
                  <br />
                  <span style={{ color: "var(--mu)", fontWeight: 400 }}>
                    {m.distance}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Scroll horizontal de semanas */}
      <div
        ref={scrollRef}
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          padding: "4px 18px 4px",
          scrollbarWidth: "thin",
          scrollbarColor: "var(--bd) transparent",
        }}
      >
        {weeks.map((sem, i) => {
          const isActive = i === activeWeek;
          const hasMilestone = !!milestoneByWeek[i];
          const phaseColor = getPhaseColor(sem);

          return (
            <button
              key={i}
              ref={isActive ? activeRef : null}
              onClick={() => onWeekChange && onWeekChange(i)}
              style={{
                flexShrink: 0,
                width: 52,
                height: 52,
                borderRadius: 8,
                border: isActive
                  ? `2px solid ${phaseColor}`
                  : "1px solid var(--bd)",
                background: isActive
                  ? `${phaseColor}22`
                  : hasMilestone
                    ? "rgba(255,69,0,.06)"
                    : "var(--bg3)",
                color: isActive ? phaseColor : "var(--mu)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                transition: ".15s",
                position: "relative",
                padding: 0,
                fontFamily: "var(--fb)",
              }}
            >
              {hasMilestone && (
                <div
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    width: 12,
                    height: 12,
                    background: "var(--or)",
                    borderRadius: "50%",
                    border: "2px solid var(--bg2)",
                    fontSize: "7px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  🏁
                </div>
              )}
              <span
                style={{
                  fontSize: ".65rem",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                S{i + 1}
              </span>
              <span style={{ fontSize: ".6rem", color: isActive ? phaseColor : "#555" }}>
                {sem.volumen_km || "—"}km
              </span>
            </button>
          );
        })}
      </div>

      {/* Leyenda de fase actual */}
      {weeks[activeWeek]?.fase && (
        <div
          style={{
            padding: "10px 18px 0",
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: getPhaseColor(weeks[activeWeek]),
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: ".78rem",
              color: "var(--mu)",
              fontStyle: "italic",
            }}
          >
            {weeks[activeWeek].fase}
            {milestoneByWeek[activeWeek]
              ? ` — 🏁 ${milestoneByWeek[activeWeek].map((m) => m.name).join(" / ")}`
              : ""}
          </span>
        </div>
      )}
    </div>
  );
}