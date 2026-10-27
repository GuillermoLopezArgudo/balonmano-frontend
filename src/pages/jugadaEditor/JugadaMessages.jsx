export default function JugadaMessages({
  mayWrite,
  editing,
  isNew,
  isEntrenamiento,
  error,
  status,
}) {
  return (
    <>
      {!mayWrite && (
        <p className="hint">
          Tu cargo solo permite consultar {isEntrenamiento ? 'este entrenamiento' : 'esta jugada'}.
          Usa Play para reproducir los pasos.
        </p>
      )}
      {mayWrite && !editing && !isNew && (
        <p className="hint">
          Modo reproducción. Usa Play para ver la secuencia o Editar para cambiarla.
        </p>
      )}
      {error && <p className="error">{error}</p>}
      {status && <p className="club-status saved">{status}</p>}
    </>
  );
}
