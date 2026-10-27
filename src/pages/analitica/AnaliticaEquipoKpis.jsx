import { fmt } from './utils';

export default function AnaliticaEquipoKpis({ metrics }) {
  return (
    <div className="metrics analitica-kpis">
      <div className="metric">
        <span>Goles promedio</span>
        <strong className="c-lime">{fmt(metrics.golesPromedio)}</strong>
        <small>
          Totales: {metrics.golesFavor} en {metrics.partidos} partidos
        </small>
      </div>
      <div className="metric">
        <span>Eficacia tiro</span>
        <strong className="c-cyan">{metrics.efiTiro}%</strong>
        <small>
          GF {metrics.golesFavor} · GC {metrics.golesContra} · bal. {metrics.efiEquipo}%
        </small>
      </div>
      <div className="metric">
        <span>Recup. / Pérdidas</span>
        <strong className="c-lime">
          {metrics.recuperaciones}/{metrics.perdidas}
        </strong>
        <small>
          Faltas {metrics.faltasCom}/{metrics.faltasRec} · GC/p{' '}
          {fmt(metrics.partidos ? metrics.golesContra / metrics.partidos : 0)}
        </small>
      </div>
    </div>
  );
}
