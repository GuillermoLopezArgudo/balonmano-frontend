import CampoAlineacion from '../../components/CampoAlineacion';
import { DISP_LABEL } from './utils';

export default function ConvocatoriaSeleccionPanel({
  tab,
  fase,
  esCampo,
  canWriteConvocatoria,
  dirty,
  estadoConv,
  saving,
  persist,
  zonasActivas,
  byId,
  selected,
  listForTab,
  dragId,
  dropZone,
  setDropZone,
  nombrePlantilla,
  setNombrePlantilla,
  guardarPlantilla,
  clearZone,
  setRol,
  onDragStart,
  onDragEnd,
  onPointerDragStart,
  onDropSeleccion,
  onDropSelectedRow,
  onDropZone,
}) {
  return (
    <section className="panel club-card">
      <div className="conv-panel-head">
        <h2>
          {fase === 'ataque'
            ? 'Alineación ataque'
            : fase === 'defensa'
              ? 'Alineación defensa'
              : tab === 'banquillo'
                ? 'Banquillo'
                : 'Selección actual'}
        </h2>
        {tab === 'convocatoria' && canWriteConvocatoria && (dirty || estadoConv !== 'guardada') && (
          <button
            type="button"
            className="conv-save-btn"
            disabled={saving || (!dirty && estadoConv === 'guardada')}
            onClick={persist}
          >
            {saving ? 'Guardando…' : 'Guardar convocatoria'}
          </button>
        )}
        {tab === 'convocatoria' && !canWriteConvocatoria && (
          <button type="button" className="conv-save-btn" disabled>
            Solo lectura
          </button>
        )}
      </div>

      {esCampo ? (
        <>
          <CampoAlineacion
            fase={fase}
            zonas={zonasActivas}
            byId={byId}
            dragId={dragId}
            dropZone={dropZone}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragOverZone={(zonaId) => setDropZone(`zona:${zonaId}`)}
            onDropZone={onDropZone}
            onClearZone={clearZone}
            onPointerDragStart={onPointerDragStart}
          />
          <div className="alin-save-row">
            <input
              value={nombrePlantilla}
              onChange={(e) => setNombrePlantilla(e.target.value)}
              placeholder={`Nombre alineación ${fase}…`}
              maxLength={120}
            />
            <button type="button" disabled={saving || !canWriteConvocatoria} onClick={guardarPlantilla}>
              Guardar {fase}
            </button>
          </div>
        </>
      ) : (
        <div
          className={`conv-selected${dropZone === 'seleccion' ? ' drop-ready' : ''}`}
          data-drop-target="seleccion"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setDropZone('seleccion');
          }}
          onDragLeave={() => setDropZone((z) => (z === 'seleccion' ? null : z))}
          onDrop={onDropSeleccion}
        >
          {listForTab().map((jid) => {
            const j = byId[jid];
            if (!j) return null;
            return (
              <div
                className={`conv-selected-row${dragId === jid ? ' dragging' : ''}${
                  dropZone === jid || dropZone === `row:${jid}` ? ' drag-over' : ''
                }`}
                key={jid}
                data-drag-id={jid}
                data-drop-target={`row:${jid}`}
                draggable
                onDragStart={(e) => onDragStart(e, jid)}
                onDragEnd={onDragEnd}
                onPointerDown={(e) => onPointerDragStart(e, jid)}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = 'move';
                  setDropZone(`row:${jid}`);
                }}
                onDrop={(e) => onDropSelectedRow(e, jid)}
              >
                <div>
                  <strong>
                    #{j.dorsal ?? '—'} {j.nombre} {j.apellido}
                  </strong>
                  <small>
                    {j.posiciones?.[0] || '—'}
                    {' · '}
                    {DISP_LABEL[j.disponibilidad || 'disponible']}
                  </small>
                </div>
                <div className="conv-selected-actions">
                  <select
                    value={selected[jid]}
                    onChange={(e) => setRol(jid, e.target.value)}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <option value="convocado">Convocado</option>
                    <option value="titular">Titular</option>
                    <option value="banquillo">Banquillo</option>
                  </select>
                  <span className="conv-grip" aria-hidden="true">
                    ⋮⋮
                  </span>
                </div>
              </div>
            );
          })}
          {!listForTab().length && (
            <p className="muted conv-drop-placeholder">
              {tab === 'banquillo'
                ? 'Arrastra aquí para el banquillo'
                : 'Arrastra jugadoras de la plantilla'}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
