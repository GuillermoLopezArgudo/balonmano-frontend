import { useEffect, useState } from 'react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api').replace(/\/$/, '');

/** Foto del club: solo se pide con la sesión. Sin token, el enlace no abre. */
export default function AuthImage({ path, alt = '', className }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    if (!path) {
      setSrc('');
      return undefined;
    }
    if (path.startsWith('data:') || path.startsWith('blob:')) {
      setSrc(path);
      return undefined;
    }
    const token = localStorage.getItem('data_token');
    const ctrl = new AbortController();
    let objectUrl = '';
    let alive = true;
    fetch(`${API_URL}/uploads/file?path=${encodeURIComponent(path)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: ctrl.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error('imagen');
        return res.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (alive) setSrc(objectUrl);
      })
      .catch(() => {
        if (alive) setSrc('');
      });
    return () => {
      alive = false;
      ctrl.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (!src) return null;
  return <img src={src} alt={alt} className={className} />;
}
