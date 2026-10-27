import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth';
import AnaliticaEquipoKpis from './analitica/AnaliticaEquipoKpis';
import AnaliticaEvolucionPanel from './analitica/AnaliticaEvolucionPanel';
import AnaliticaPorPorteroPanel from './analitica/AnaliticaPorPorteroPanel';
import AnaliticaPorterosKpis from './analitica/AnaliticaPorterosKpis';
import AnaliticaPosicionPanel from './analitica/AnaliticaPosicionPanel';
import AnaliticaRankingPanel from './analitica/AnaliticaRankingPanel';
import AnaliticaRivalPanel from './analitica/AnaliticaRivalPanel';
import AnaliticaToolbar from './analitica/AnaliticaToolbar';
import AnaliticaZonasPanel from './analitica/AnaliticaZonasPanel';
import { buildCsv, buildPdfReport, downloadCsv, periodoExportLabel } from './analitica/exports';
import { useAnaliticaData } from './analitica/useAnaliticaData';
import { printHtml } from './analitica/utils';

export default function Analitica() {
  const { equipo, can } = useAuth();
  const puedeExportar = can('analitica');
  const [searchParams, setSearchParams] = useSearchParams();
  const seccionParam = searchParams.get('seccion');
  const seccion = seccionParam === 'porteros' ? 'porteros' : 'equipo';

  const {
    dash,
    temporadas,
    idTemporada,
    setIdTemporada,
    filtro,
    setFiltro,
    zoneTab,
    setZoneTab,
    rivalSel,
    setRivalSel,
    error,
    setError,
    jugados,
    metrics,
    rankingJugadoras,
    efiPorPosicion,
    porPortero,
    evolucion,
    maxGoles,
    rivalesOpts,
    vsRival,
    temporada,
    temporadaEstadoLabel,
    zoneEntries,
  } = useAnaliticaData({ equipo });

  const setSeccion = (key) => {
    if (key === 'porteros') setSearchParams({ seccion: 'porteros' });
    else setSearchParams({});
  };

  const exportarCsv = () => {
    const team = equipo?.datos?.nombre || 'Equipo';
    const filtroLabel = periodoExportLabel({ temporada, filtro, temporadaEstadoLabel });
    const csv = buildCsv({ team, filtroLabel, seccion, metrics, porPortero, rankingJugadoras });
    downloadCsv(csv, seccion);
  };

  const exportar = () => {
    const team = equipo?.datos?.nombre || 'Equipo';
    const filtroLabel = periodoExportLabel({ temporada, filtro, temporadaEstadoLabel });
    const { title, body } = buildPdfReport({
      seccion,
      team,
      filtroLabel,
      metrics,
      porPortero,
      zoneEntries,
      efiPorPosicion,
      evolucion,
      jugados,
    });
    try {
      printHtml(title, body);
    } catch (e) {
      setError(e.message || 'No se pudo exportar el PDF');
    }
  };

  if (error) return <p className="error">{error}</p>;
  if (!dash) return <p className="muted">Cargando analítica…</p>;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">RENDIMIENTO · {equipo?.datos?.nombre || 'EQUIPO'}</p>
          <h1>Analítica</h1>
        </div>
      </header>

      <AnaliticaToolbar
        seccion={seccion}
        setSeccion={setSeccion}
        puedeExportar={puedeExportar}
        exportarCsv={exportarCsv}
        exportar={exportar}
        idTemporada={idTemporada}
        setIdTemporada={setIdTemporada}
        setFiltro={setFiltro}
        setRivalSel={setRivalSel}
        temporadas={temporadas}
        filtro={filtro}
        temporada={temporada}
        temporadaEstadoLabel={temporadaEstadoLabel}
      />

      {seccion === 'equipo' && (
        <>
          <AnaliticaEquipoKpis metrics={metrics} />
          <AnaliticaRankingPanel rankingJugadoras={rankingJugadoras} />
          <AnaliticaPosicionPanel efiPorPosicion={efiPorPosicion} />
          <AnaliticaEvolucionPanel evolucion={evolucion} maxGoles={maxGoles} />
          <AnaliticaRivalPanel
            rivalesOpts={rivalesOpts}
            rivalSel={rivalSel}
            setRivalSel={setRivalSel}
            vsRival={vsRival}
          />
        </>
      )}

      {seccion === 'porteros' && (
        <>
          <AnaliticaPorterosKpis metrics={metrics} />
          <AnaliticaZonasPanel zoneTab={zoneTab} setZoneTab={setZoneTab} zoneEntries={zoneEntries} />
          <AnaliticaPorPorteroPanel porPortero={porPortero} />
        </>
      )}
    </>
  );
}
