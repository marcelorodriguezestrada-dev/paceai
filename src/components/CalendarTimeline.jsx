import { useRef, useEffect } from "react";

/**
 * CalendarTimeline — Barra de progreso semanal con indicador HOY y hitos de carrera
 *
 * Props:
 *   weeks        : array de semanas del plan
 *   activeWeek   : índice activo (0-based)
 *   onWeekChange : función(índice)
 *   races        : array de { name, date, distance, image }
 *   startDate    : Date — fecha de inicio del plan
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
  const todayRef = useRef(null);

  const totalWeeks = weeks.length;
  if (totalWeeks === 0) return null;

  const planStart = startDate ? new Date(startDate) : new Date();
  planStart.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalPlanDays = totalWeeks * 7;
  const daysElapsed = Math.floor((today - planStart) / (24 * 60 * 60 * 1000));
  const todayPct = Math.min(100, Math.max(0, (daysElapsed / totalPlanDays) * 100));

  // Semana actual según fecha real
  const todayWeekIdx = Math.min(
    totalWeeks - 1,
    Math.max(0, Math.floor(daysElapsed / 7))
  );
  const isPlanActive = daysElapsed >= 0 && daysElapsed < totalPlanDays;
  const isPlanFuture = daysElapsed < 0;
  const isPlanFinished = daysElapsed >= totalPlanDays;

  // Día de la semana actual dentro de la semana (0=lun, 6=dom)
  const todayDayOfWeek = daysElapsed >= 0 ? daysElapsed % 7 : null;
  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  // Hitos de carrera
  const raceMilestones = races.map((race) => {
    const raceDate = new Date(race.date);
    raceDate.setHours(0, 0, 0, 0);
    const diffMs = raceDate - planStart;
    const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
    const weekIdx = Math.min(Math.max(0, diffWeeks - 1), totalWeeks - 1);
    const racePct = Math.min(100, Math.max(0, (diffWeeks / totalWeeks) * 100));
    return { ...race, weekIdx, racePct };
  });

  const milestoneByWeek = {};
  raceMilestones.forEach((m) => {
    if (!milestoneByWeek[m.weekIdx]) milestoneByWeek[m.weekIdx] = [];
    milestoneByWeek[m.weekIdx].push(m);
  });

  // Scroll al activo
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [activeWeek]);

  // Al montar, si el plan está activo, auto-seleccionar la semana de hoy
  useEffect(() => {
    if (isPlanActive && onWeekChange && todayWeekIdx !== activeWeek) {
      onWeekChange(todayWeekIdx);
    }
  }, []);

  const phaseColors = {
    "Base / Fuerza": "#3b82f6",
    Específica: "#f59e0b",
    Sharpening: "#ef4444",
    Tapering: "#22c55e",
    Activación: "#3b82f6",
    "Específica compacta": "#f59e0b",
  };

  const getPhaseColor = (sem) => phaseColors[sem?.fase || ""] || "#FF4500";

  return (
    <div style={{
      background: "var(--bg2)",
      border: "1px solid var(--bd)",
      borderRadius: 12,
      padding: "16px 0 14px",
      marginBottom: 20,
      overflow: "hidden",
    }}>

      {/* ── Header ── */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 18px",
        marginBottom: 14,
        flexWrap: "wrap",
        gap: 6,
      }}>
        <div style={{
          fontSize: ".72rem",
          color: "var(--or)",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}>
          Cronograma del plan
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {isPlanActive && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 10px",
              background: "rgba(34,197,94,.12)",
              border: "1px solid rgba(34,197,94,.3)",
              borderRadius: 20,
              fontSize: ".72rem",
              color: "#22c55e",
              fontWeight: 700,
            }}>
              <div style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#22c55e",
                animation: "pulse 2s infinite",
              }} />
              EN CURSO
            </div>
          )}
          {isPlanFuture && (
            <div style={{
              padding: "3px 10px",
              background: "rgba(59,130,246,.1)",
              border: "1px solid rgba(59,130,246,.25)",
              borderRadius: 20,
              fontSize: ".72rem",
              color: "#3b82f6",
              fontWeight: 700,
            }}>
              PRÓXIMO
            </div>
          )}
          {isPlanFinished && (
            <div style={{
              padding: "3px 10px",
              background: "rgba(255,69,0,.1)",
              border: "1px solid rgba(255,69,0,.25)",
              borderRadius: 20,
              fontSize: ".72rem",
              color: "var(--or)",
              fontWeight: 700,
            }}>
              COMPLETADO
            </div>
          )}
          <div style={{ fontSize: ".78rem", color: "var(--mu)" }}>
            Semana <span style={{ color: "var(--or)", fontWeight: 700 }}>{activeWeek + 1}</span> de {totalWeeks}
          </div>
        </div>
      </div>

      {/* ── Barra de progreso con indicador HOY ── */}
      <div style={{ padding: "0 18px", marginBottom: 6 }}>
        <div style={{
          height: 6,
          background: "var(--bd)",
          borderRadius: 3,
          position: "relative",
          overflow: "visible",
        }}>
          {/* Progreso completado */}
          <div style={{
            height: "100%",
            width: `${todayPct}%`,
            background: "linear-gradient(90deg, #3b82f6, #FF4500)",
            borderRadius: 3,
            transition: "width .3s ease",
          }} />

          {/* Marcadores de carrera */}
          {raceMilestones.map((m, i) => (
            <div
              key={i}
              title={`${m.name} — Semana ${m.weekIdx + 1}`}
              onClick={() => onWeekChange && onWeekChange(m.weekIdx)}
              style={{
                position: "absolute",
                top: "50%",
                left: `${m.racePct}%`,
                transform: "translate(-50%, -50%)",
                width: 18,
                height: 18,
                background: "#FF4500",
                border: "2px solid var(--bg2)",
                borderRadius: "50%",
                cursor: "pointer",
                zIndex: 3,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "9px",
                boxShadow: "0 0 0 2px rgba(255,69,0,.3)",
              }}
            >
              🏁
            </div>
          ))}

          {/* Indicador HOY */}
          {isPlanActive && (
            <div
              ref={todayRef}
              style={{
                position: "absolute",
                top: "50%",
                left: `${todayPct}%`,
                transform: "translate(-50%, -50%)",
                zIndex: 4,
              }}
            >
              {/* Flecha hacia abajo + punto */}
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0,
              }}>
                <div style={{
                  fontSize: "10px",
                  color: "#fff",
                  fontWeight: 900,
                  lineHeight: 1,
                  textShadow: "0 1px 3px rgba(0,0,0,.8)",
                  marginBottom: -1,
                }}>
                  ▼
                </div>
                <div style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: "#fff",
                  border: "2px solid #22c55e",
                  boxShadow: "0 0 0 3px rgba(34,197,94,.35), 0 2px 6px rgba(0,0,0,.4)",
                }} />
              </div>
            </div>
          )}
        </div>

        {/* Etiqueta HOY + hitos bajo la barra */}
        <div style={{ position: "relative", height: 32, marginTop: 4 }}>
          {/* HOY label */}
          {isPlanActive && (
            <div style={{
              position: "absolute",
              left: `${todayPct}%`,
              transform: "translateX(-50%)",
              top: 2,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
              zIndex: 2,
            }}>
              <div style={{
                fontSize: ".65rem",
                fontWeight: 900,
                color: "#22c55e",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}>
                HOY
              </div>
              {todayDayOfWeek !== null && (
                <div style={{
                  fontSize: ".6rem",
                  color: "var(--mu)",
                  whiteSpace: "nowrap",
                }}>
                  {dayNames[todayDayOfWeek]}
                </div>
              )}
            </div>
          )}

          {/* Hitos de carrera */}
          {raceMilestones.map((m, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${m.racePct}%`,
                transform: "translateX(-50%)",
                top: 2,
                fontSize: ".62rem",
                color: "var(--or)",
                fontWeight: 700,
                whiteSpace: "nowrap",
                textAlign: "center",
                lineHeight: 1.3,
              }}
            >
              <div>S{m.weekIdx + 1}</div>
              <div style={{ color: "var(--mu)", fontWeight: 400 }}>{m.distance}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Chips de semana con scroll horizontal ── */}
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
          const isToday = isPlanActive && i === todayWeekIdx;
          const isPast = isPlanActive && i < todayWeekIdx;
          const hasMilestone = !!milestoneByWeek[i];
          const phaseColor = getPhaseColor(sem);

          return (
            <button
              key={i}
              ref={isActive ? activeRef : null}
              onClick={() => onWeekChange && onWeekChange(i)}
              style={{
                flexShrink: 0,
                width: 56,
                height: 58,
                borderRadius: 8,
                border: isActive
                  ? `2px solid ${phaseColor}`
                  : isToday
                    ? "2px solid #22c55e"
                    : "1px solid var(--bd)",
                background: isActive
                  ? `${phaseColor}22`
                  : isToday
                    ? "rgba(34,197,94,.08)"
                    : isPast
                      ? "rgba(255,255,255,.02)"
                      : "var(--bg3)",
                color: isActive ? phaseColor : isToday ? "#22c55e" : isPast ? "#444" : "var(--mu)",
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
                opacity: isPast && !isActive ? 0.6 : 1,
              }}
            >
              {/* Badge hito de carrera */}
              {hasMilestone && (
                <div style={{
                  position: "absolute",
                  top: -5,
                  right: -5,
                  width: 14,
                  height: 14,
                  background: "var(--or)",
                  borderRadius: "50%",
                  border: "2px solid var(--bg2)",
                  fontSize: "7px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 2,
                }}>
                  🏁
                </div>
              )}

              {/* Badge HOY */}
              {isToday && !isActive && (
                <div style={{
                  position: "absolute",
                  top: -5,
                  left: -5,
                  width: 14,
                  height: 14,
                  background: "#22c55e",
                  borderRadius: "50%",
                  border: "2px solid var(--bg2)",
                  zIndex: 2,
                }} />
              )}

              {/* Checkmark para semanas pasadas */}
              {isPast && (
                <div style={{
                  position: "absolute",
                  top: 3,
                  right: 4,
                  fontSize: "8px",
                  color: "#22c55e",
                  fontWeight: 900,
                  lineHeight: 1,
                }}>
                  ✓
                </div>
              )}

              <span style={{
                fontSize: ".65rem",
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}>
                {isToday ? "HOY" : `S${i + 1}`}
              </span>
              <span style={{
                fontSize: ".58rem",
                color: isActive ? phaseColor : isToday ? "#22c55e" : "#555",
              }}>
                {sem.volumen_km || "—"}km
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Leyenda de fase + info de semana actual ── */}
      {weeks[activeWeek]?.fase && (
        <div style={{
          padding: "10px 18px 0",
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: getPhaseColor(weeks[activeWeek]),
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: ".78rem",
              color: "var(--mu)",
              fontStyle: "italic",
            }}>
              {weeks[activeWeek].fase}
              {milestoneByWeek[activeWeek]
                ? ` — 🏁 ${milestoneByWeek[activeWeek].map((m) => m.name).join(" / ")}`
                : ""}
            </span>
          </div>

          {/* Info día actual dentro de la semana */}
          {isPlanActive && activeWeek === todayWeekIdx && todayDayOfWeek !== null && (
            <div style={{
              fontSize: ".72rem",
              color: "#22c55e",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}>
              <span style={{
                width: 6, height: 6,
                borderRadius: "50%",
                background: "#22c55e",
                display: "inline-block",
              }} />
              Hoy es {dayNames[todayDayOfWeek]}
              {weeks[activeWeek]?.sesiones?.[todayDayOfWeek] && (
                <span style={{ color: "var(--mu)", fontWeight: 400 }}>
                  {" "}— {weeks[activeWeek].sesiones[todayDayOfWeek].tipo}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .4; }
        }
      `}</style>
    </div>
  );
}