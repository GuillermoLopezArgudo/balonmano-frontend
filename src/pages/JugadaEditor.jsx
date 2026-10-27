import { useRef } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../auth';
import SinAcceso from '../components/SinAcceso';
import JugadaBoard from './jugadaEditor/JugadaBoard';
import JugadaHeader from './jugadaEditor/JugadaHeader';
import JugadaMessages from './jugadaEditor/JugadaMessages';
import JugadaMeta from './jugadaEditor/JugadaMeta';
import JugadaModeHints from './jugadaEditor/JugadaModeHints';
import JugadaToolbar from './jugadaEditor/JugadaToolbar';
import { exportarJugadaPng } from './jugadaEditor/exportPng';
import { useJugadaEditing } from './jugadaEditor/useJugadaEditing';
import { useJugadaEditorState } from './jugadaEditor/useJugadaEditorState';
import { useJugadaModes } from './jugadaEditor/useJugadaModes';
import { useJugadaPlayback } from './jugadaEditor/useJugadaPlayback';

export default function JugadaEditor({ variant = 'jugada' }) {
  const isEntrenamiento = variant === 'entrenamiento';
  const basePath = isEntrenamiento ? '/preparacion/entrenamiento' : '/jugadas';
  const { id } = useParams();
  const isNew = !id || id === 'nueva';
  const location = useLocation();
  const { canWriteJugadas, canWriteFisico, canRead } = useAuth();
  const mayWrite = isEntrenamiento ? canWriteFisico : canWriteJugadas;
  const editing = mayWrite && (isNew || location.pathname.endsWith('/editar'));
  const canWrite = editing;

  const boardRef = useRef(null);

  const editor = useJugadaEditorState({ id, isNew, isEntrenamiento, basePath, mayWrite });
  const {
    state,
    setState,
    pasoIdx,
    setPasoIdx,
    error,
    setError,
    status,
    setStatus,
    saving,
    loading,
    paso,
    nextPaso,
    esCompleto,
    esMediaPista,
    esCampoHorizontal,
    cupo,
    playTracks,
    posMap,
    guardar,
    copiar,
  } = editor;

  const modes = useJugadaModes();
  const {
    modo,
    setModo,
    flechaPieza,
    setFlechaPieza,
    paseFrom,
    setPaseFrom,
    selectedFlechaId,
    setSelectedFlechaId,
    cancelPending,
  } = modes;

  const {
    playing,
    playActionIdx,
    playPhase,
    frozenSnap,
    playSnap,
    displayPos,
    displayBall,
    stopPlay,
    clearFrozen,
    play,
  } = useJugadaPlayback({
    state,
    paso,
    nextPaso,
    posMap,
    playTracks,
    esCampoHorizontal,
    setPasoIdx,
    setError,
    setModo,
    setFlechaPieza,
    setPaseFrom,
    setSelectedFlechaId,
  });

  const {
    removeFlecha,
    removeLastFlecha,
    onPointerDownPieza,
    onBoardClick,
    onPointerDownBall,
    addPaso,
    removePaso,
    addPieza,
    removePieza,
    ponerTodasJugadoras,
    quitarTodasJugadoras,
    changeFase,
  } = useJugadaEditing({
    state,
    setState,
    pasoIdx,
    setPasoIdx,
    paso,
    posMap,
    canWrite,
    isEntrenamiento,
    isNew,
    boardRef,
    playing,
    stopPlay,
    clearFrozen,
    modes,
  });

  const exportarPng = () => {
    const result = exportarJugadaPng({
      board: boardRef.current,
      state,
      paso,
      displayPos,
      displayBall,
      isEntrenamiento,
    });
    if (result === 'sin-campo') setError('No hay campo para exportar');
    else if (result === 'ok') setStatus('Imagen descargada');
  };

  if (loading) {
    return (
      <p className="muted" style={{ padding: '2rem' }}>
        {isEntrenamiento ? 'Cargando entrenamiento…' : 'Cargando jugada…'}
      </p>
    );
  }

  if (!isEntrenamiento && !canRead('jugadas')) {
    return <SinAcceso que="las jugadas" />;
  }
  if (isNew && !mayWrite) {
    return <Navigate to={basePath} replace />;
  }

  return (
    <>
      <JugadaHeader
        isEntrenamiento={isEntrenamiento}
        isNew={isNew}
        editing={editing}
        canWrite={canWrite}
        mayWrite={mayWrite}
        state={state}
        basePath={basePath}
        id={id}
        saving={saving}
        exportarPng={exportarPng}
        copiar={copiar}
        guardar={guardar}
      />

      <JugadaMessages
        mayWrite={mayWrite}
        editing={editing}
        isNew={isNew}
        isEntrenamiento={isEntrenamiento}
        error={error}
        status={status}
      />

      <JugadaMeta
        state={state}
        setState={setState}
        isEntrenamiento={isEntrenamiento}
        canWrite={canWrite}
        changeFase={changeFase}
      />

      <JugadaToolbar
        state={state}
        pasoIdx={pasoIdx}
        setPasoIdx={setPasoIdx}
        paso={paso}
        canWrite={canWrite}
        isEntrenamiento={isEntrenamiento}
        esCompleto={esCompleto}
        esMediaPista={esMediaPista}
        cupo={cupo}
        playing={playing}
        play={play}
        stopPlay={stopPlay}
        clearFrozen={clearFrozen}
        addPaso={addPaso}
        removePaso={removePaso}
        addPieza={addPieza}
        removeLastFlecha={removeLastFlecha}
        ponerTodasJugadoras={ponerTodasJugadoras}
        quitarTodasJugadoras={quitarTodasJugadoras}
        modo={modo}
        setModo={setModo}
        flechaPieza={flechaPieza}
        setFlechaPieza={setFlechaPieza}
        paseFrom={paseFrom}
        setPaseFrom={setPaseFrom}
        setSelectedFlechaId={setSelectedFlechaId}
        cancelPending={cancelPending}
      />

      <JugadaModeHints
        canWrite={canWrite}
        modo={modo}
        flechaPieza={flechaPieza}
        paseFrom={paseFrom}
        selectedFlechaId={selectedFlechaId}
        playing={playing}
        playPhase={playPhase}
        playActionIdx={playActionIdx}
        playTracks={playTracks}
        paso={paso}
        isEntrenamiento={isEntrenamiento}
        removeFlecha={removeFlecha}
      />

      <JugadaBoard
        boardRef={boardRef}
        state={state}
        paso={paso}
        esCompleto={esCompleto}
        esMediaPista={esMediaPista}
        esCampoHorizontal={esCampoHorizontal}
        onBoardClick={onBoardClick}
        playTracks={playTracks}
        selectedFlechaId={selectedFlechaId}
        playing={playing}
        playPhase={playPhase}
        playActionIdx={playActionIdx}
        playSnap={playSnap}
        frozenSnap={frozenSnap}
        flechaPieza={flechaPieza}
        paseFrom={paseFrom}
        setFlechaPieza={setFlechaPieza}
        setPaseFrom={setPaseFrom}
        setSelectedFlechaId={setSelectedFlechaId}
        removeFlecha={removeFlecha}
        displayPos={displayPos}
        displayBall={displayBall}
        canWrite={canWrite}
        modo={modo}
        onPointerDownPieza={onPointerDownPieza}
        onPointerDownBall={onPointerDownBall}
        removePieza={removePieza}
      />
    </>
  );
}
