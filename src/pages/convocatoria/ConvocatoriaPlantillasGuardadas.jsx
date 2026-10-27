import { IcoBasura } from '../../components/ActionIcons';

export default function ConvocatoriaPlantillasGuardadas({
  fase,
  plantillas,
  plantillasFiltradas,
  aplicarPlantilla,
  borrarPlantilla,
}) {
  return (
    <section className="panel club-card" style={{ marginTop: '1rem' }}>
      <h2>
        Alineaciones guardadas
        {fase ? ` · ${fase}` : ''}
      </h2>
      <p className="muted" style={{ marginTop: 0 }}>
        {fase
          ? `Plantillas de ${fase} reutilizables en este club.`
          : 'Abre Ataque o Defensa para filtrar, o aplica cualquiera desde aquí.'}
      </p>
      {(fase ? plantillasFiltradas : plantillas).length ? (
        <div className="alin-templates">
          {(fase ? plantillasFiltradas : plantillas).map((p) => (
            <div className="alin-template-row" key={p.id_alineacion}>
              <div>
                <strong>{p.nombre}</strong>
                <small>
                  <span className={`alin-tipo-badge alin-tipo-${p.tipo || 'ataque'}`}>
                    {p.tipo === 'defensa' ? 'Defensa' : 'Ataque'}
                  </span>
                  {' · '}
                  {(p.items || []).length}/7 posiciones ·{' '}
                  {p.actualizado_en
                    ? new Date(p.actualizado_en).toLocaleDateString('es-ES')
                    : ''}
                </small>
              </div>
              <div className="alin-template-actions">
                <button type="button" className="ghost" onClick={() => aplicarPlantilla(p)}>
                  Aplicar
                </button>
                <button
                  type="button"
                  className="btn-icon-del"
                  title="Eliminar alineación"
                  aria-label={`Eliminar ${p.nombre}`}
                  onClick={() => borrarPlantilla(p)}
                >
                  <IcoBasura />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">
          {fase
            ? `Aún no hay alineaciones de ${fase} guardadas.`
            : 'Aún no hay alineaciones guardadas.'}
        </p>
      )}
    </section>
  );
}
