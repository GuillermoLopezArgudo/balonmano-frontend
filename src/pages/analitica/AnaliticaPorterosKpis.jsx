import { fmt } from './utils';

export default function AnaliticaPorterosKpis({ metrics }) {
  return (
    <div className="acta-stat-rows gk-anal-kpis">
      <div className="acta-stat-row">
        <strong className="c-orange">{metrics.paradas}</strong>
        <div>
          <span>Paradas</span>
          <small>{fmt(metrics.porPartidoParadas)} por partido</small>
        </div>
      </div>
      <div className="acta-stat-row">
        <strong className="c-cyan">{metrics.recibidos}</strong>
        <div>
          <span>Tiros recibidos</span>
          <small>{fmt(metrics.porPartidoTiros)} por partido</small>
        </div>
      </div>
      <div className="acta-stat-row">
        <strong className="c-lime">{metrics.efiPortero}%</strong>
        <div>
          <span>Efectividad</span>
          <small>
            {metrics.paradas}/{metrics.recibidos} · {metrics.partidos} partidos
          </small>
        </div>
      </div>
      <div className="acta-stat-row">
        <strong className="c-purple">
          {metrics.partidos
            ? Math.round((metrics.limpias / metrics.partidos) * 100)
            : 0}
          %
        </strong>
        <div>
          <span>Limpias</span>
          <small>
            {metrics.limpias} de {metrics.partidos} partidos
          </small>
        </div>
      </div>
    </div>
  );
}
