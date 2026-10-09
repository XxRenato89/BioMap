import { Viewer } from '@photo-sphere-viewer/core';
import '@photo-sphere-viewer/core/index.css';
import { useEffect, useRef } from 'react';

/**
 * Visor de fotos 360° (equirectangulares): se gira arrastrando con un dedo y
 * se acerca pellizcando. Funciona sin internet: la librería va en el bundle y
 * la foto viene de /media.
 *
 * @param {{ url: string, label: string }} props
 */
export default function PanoramaViewer({ url, label }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const viewer = new Viewer({
      container: containerRef.current,
      panorama: url,
      navbar: false,
      defaultZoomLvl: 20,
      mousewheel: true,
      touchmoveTwoFingers: false,
      loadingTxt: '',
    });
    return () => viewer.destroy();
  }, [url]);

  return <div ref={containerRef} className="panorama" role="img" aria-label={label} />;
}
