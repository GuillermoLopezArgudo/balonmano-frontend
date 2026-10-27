import { CourtShotMap, GoalShotMap } from '../../components/ShotMaps';

export default function LiveShotMapsSection({ live }) {
  const {
    zona,
    setZona,
    zonaPorteria,
    setZonaPorteria,
    needsGoalMap,
    esPorteraAccion,
    esParada,
    esGolRival,
    esLanzamiento,
    esPoste,
  } = live;

  return (
    <div className="shot-maps">
      <CourtShotMap
        value={zona}
        onChange={setZona}
        title={esPorteraAccion ? 'Origen · tiro rival' : 'Origen · pista'}
        emptyLabel={esPorteraAccion ? 'Desde dónde lanzó el rival' : 'Toca una zona'}
      />
      {needsGoalMap && (
        <GoalShotMap
          value={zonaPorteria}
          onChange={setZonaPorteria}
          showFuera={esLanzamiento}
          mode={esPoste ? 'posts' : 'goal'}
          title={
            esParada
              ? 'Destino · parada'
              : esGolRival
                ? 'Destino · gol recibido'
                : esPoste
                  ? 'Destino · poste'
                  : 'Destino · portería'
          }
          emptyLabel={
            esPorteraAccion
              ? 'Casilla de portería'
              : esPoste
                ? 'Elige un palo'
                : 'Puerta o fuera'
          }
          hint={
            esParada
              ? 'Pista = tiro rival · Portería = zona de la parada'
              : esGolRival
                ? 'Pista = tiro rival · Portería = dónde entró el gol'
                : esPoste
                  ? 'Solo los palos: izquierdo, larguero o derecho'
                  : 'Dentro = gol · Fuera = fallado'
          }
        />
      )}
    </div>
  );
}
