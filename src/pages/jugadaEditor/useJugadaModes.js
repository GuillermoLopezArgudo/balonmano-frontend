import { useState } from 'react';

/** Modo de edición (mover / desmarque / pase / lanzar) y selección pendiente. */
export function useJugadaModes() {
  const [modo, setModo] = useState('mover'); // mover | flecha | pase | lanzar
  const [flechaPieza, setFlechaPieza] = useState(null);
  const [paseFrom, setPaseFrom] = useState(null);
  const [selectedFlechaId, setSelectedFlechaId] = useState(null);

  const cancelPending = () => {
    setFlechaPieza(null);
    setPaseFrom(null);
    setSelectedFlechaId(null);
  };

  return {
    modo,
    setModo,
    flechaPieza,
    setFlechaPieza,
    paseFrom,
    setPaseFrom,
    selectedFlechaId,
    setSelectedFlechaId,
    cancelPending,
  };
}
