export default function JugadaMeta({ state, setState, isEntrenamiento, canWrite, changeFase }) {
  return (
    <div className="jugada-editor-meta panel club-card">
      <div className="field">
        <label>Nombre</label>
        <input
          value={state.nombre}
          onChange={(e) => setState((s) => ({ ...s, nombre: e.target.value }))}
          placeholder={
            isEntrenamiento ? 'Ej. Posesión 4×4 o cruce en media pista' : 'Ej. Cruce por 1.ª'
          }
          maxLength={120}
        />
      </div>
      <div className="field">
        <label>{isEntrenamiento ? 'Campo' : 'Fase'}</label>
        <select
          value={state.fase}
          onChange={(e) => changeFase(e.target.value)}
          disabled={!canWrite}
        >
          {isEntrenamiento ? (
            <>
              <option value="ataque">Media pista</option>
              <option value="completo">Campo completo</option>
            </>
          ) : (
            <>
              <option value="ataque">Ataque</option>
              <option value="defensa">Defensa</option>
            </>
          )}
        </select>
      </div>
      <div className="field jugada-desc-field">
        <label>Notas</label>
        <input
          value={state.descripcion}
          onChange={(e) => setState((s) => ({ ...s, descripcion: e.target.value }))}
          placeholder="Opcional"
          maxLength={4000}
        />
      </div>
    </div>
  );
}
