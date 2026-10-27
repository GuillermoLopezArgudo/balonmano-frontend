export default function JugadaCourtMarks({ esCompleto, esMediaPista }) {
  return (
    <>
    {esCompleto ? (
      <>
        <div className="hb-full-mark hb-full-border" aria-hidden="true" />
        <div className="hb-full-mark hb-full-center-line" aria-hidden="true" />
        <div className="hb-full-mark hb-full-center-circle" aria-hidden="true" />
        <div className="hb-full-mark hb-full-goal hb-full-goal-l" aria-hidden="true" />
        <div className="hb-full-mark hb-full-goal hb-full-goal-r" aria-hidden="true" />
        <div className="hb-full-mark hb-full-arc hb-full-arc-l" aria-hidden="true" />
        <div className="hb-full-mark hb-full-arc hb-full-arc-r" aria-hidden="true" />
        <div className="hb-full-mark hb-full-6m hb-full-6m-l" aria-hidden="true" />
        <div className="hb-full-mark hb-full-6m hb-full-6m-r" aria-hidden="true" />
      </>
    ) : esMediaPista ? (
      <>
        <div className="hb-full-mark hb-full-border" aria-hidden="true" />
        <div className="hb-full-mark hb-half-center-line" aria-hidden="true" />
        <div className="hb-full-mark hb-half-center-circle" aria-hidden="true" />
        <div className="hb-full-mark hb-full-goal hb-full-goal-r" aria-hidden="true" />
        <div className="hb-full-mark hb-full-arc hb-full-arc-r" aria-hidden="true" />
        <div className="hb-full-mark hb-full-6m hb-full-6m-r" aria-hidden="true" />
      </>
    ) : (
      <svg
        className="hb-court-marks-svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {/* Portería abajo, tablero ancho: 9 m (discontinua) y 6 m */}
        <path
          className="hb-court-line hb-court-line-9m"
          d="M 8 98 Q 8 42 50 42 Q 92 42 92 98"
          fill="none"
        />
        <path
          className="hb-court-line hb-court-line-6m"
          d="M 22 98 Q 22 58 50 58 Q 78 58 78 98"
          fill="none"
        />
        <rect className="hb-court-line-goal" x="38" y="96.2" width="24" height="2.6" rx="0.4" />
      </svg>
    )}
    </>
  );
}
