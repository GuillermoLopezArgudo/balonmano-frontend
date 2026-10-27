import { FILTROS, SECCIONES } from './utils';

export default function AnaliticaToolbar({
  seccion,
  setSeccion,
  puedeExportar,
  exportarCsv,
  exportar,
  idTemporada,
  setIdTemporada,
  setFiltro,
  setRivalSel,
  temporadas,
  filtro,
  temporada,
  temporadaEstadoLabel,
}) {
  return (
    <>
      <div className="analitica-toolbar">
        <div className="filters roster-filters" style={{ marginBottom: 0 }}>
          {SECCIONES.map((s) => (
            <button
              type="button"
              key={s.key}
              className={seccion === s.key ? 'active' : ''}
              onClick={() => setSeccion(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
        {puedeExportar && (
          <div className="analitica-export">
            <button type="button" className="ghost" onClick={exportarCsv}>
              Exportar CSV
            </button>
            <button type="button" onClick={exportar}>
              Exportar PDF
            </button>
          </div>
        )}
        <div className="analitica-toolbar-period">
          <div className="field analitica-temp-field" style={{ marginBottom: 0 }}>
            <label htmlFor="analitica-temp" className="sr-only">
              Temporada
            </label>
            <select
              id="analitica-temp"
              value={idTemporada}
              onChange={(e) => {
                setIdTemporada(e.target.value);
                setFiltro('temporada');
                setRivalSel('');
              }}
              disabled={!temporadas.length}
            >
              {!temporadas.length && <option value="">Sin temporadas</option>}
              {temporadas.map((t) => (
                <option key={t.id_temporada} value={t.id_temporada}>
                  {t.nombre}
                  {t.estado === 'activa'
                    ? ' · activa'
                    : t.estado === 'cerrada'
                      ? ' · cerrada'
                      : t.estado === 'archivada'
                        ? ' · archivada'
                        : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="filters roster-filters" style={{ marginBottom: 0 }}>
            {FILTROS.map((f) => (
              <button
                type="button"
                key={f.key}
                className={filtro === f.key ? 'active' : ''}
                onClick={() => setFiltro(f.key)}
              >
                {f.key === 'temporada' ? 'Toda la temporada' : f.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {temporadaEstadoLabel && temporadaEstadoLabel !== 'activa' && (
        <p className="hint" style={{ marginTop: '0.65rem' }}>
          Estás viendo la temporada {temporada} ({temporadaEstadoLabel}). El PDF/CSV usa este
          filtro.
        </p>
      )}
    </>
  );
}
