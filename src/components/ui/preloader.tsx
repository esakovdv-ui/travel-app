'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './preloader.module.css';

export function Preloader({ show }: { show?: boolean } = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hidden, setHidden] = useState(false);
  const [mounted, setMounted] = useState(true);

  // Управляемый режим: скрываем когда show становится false
  useEffect(() => {
    if (show === false) {
      setHidden(true);
      const t = setTimeout(() => setMounted(false), 600);
      return () => clearTimeout(t);
    }
    if (show === true) {
      setMounted(true);
      // небольшая задержка чтобы mounted=true успел применится до сброса hidden
      requestAnimationFrame(() => setHidden(false));
    }
  }, [show]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 200, H = 160;
    const cx = W / 2, cy = H / 2;
    const R = 30, rx = R + 7, ry = 9;

    const figures = [
      { offset: 0,                type: 'bar', color: '#1B4FBF', w: 28, h: 8 },
      { offset: Math.PI * 2 / 3, type: 'bar', color: '#D42B2B', w: 20, h: 8 },
      { offset: Math.PI * 4 / 3, type: 'tri', color: '#F5C000', size: 10 },
    ] as const;

    let t = 0;
    let raf: number;

    function drawFig(fig: typeof figures[number], angle: number) {
      const x = cx + rx * Math.cos(angle);
      const y = cy + ry * Math.sin(angle);
      const depth = (Math.sin(angle) + 1) / 2;
      const alpha = 0.35 + 0.65 * depth;
      const scale = 0.72 + 0.28 * depth;

      ctx!.save();
      ctx!.translate(x, y);
      ctx!.scale(scale, scale);
      ctx!.globalAlpha = alpha;
      ctx!.shadowColor = 'rgba(0,0,0,0.55)';
      ctx!.shadowBlur = 6;
      ctx!.shadowOffsetX = 1;
      ctx!.shadowOffsetY = 2;

      if (fig.type === 'bar') {
        ctx!.rotate(Math.cos(angle) * 0.2);
        ctx!.fillStyle = fig.color;
        ctx!.beginPath();
        ctx!.roundRect(-fig.w / 2, -fig.h / 2, fig.w, fig.h, 2);
        ctx!.fill();
      } else {
        const s = fig.size;
        ctx!.fillStyle = fig.color;
        ctx!.beginPath();
        ctx!.moveTo(0, -s);
        ctx!.lineTo(s * 0.866, s * 0.5);
        ctx!.lineTo(-s * 0.866, s * 0.5);
        ctx!.closePath();
        ctx!.fill();
      }
      ctx!.restore();
    }

    function drawPlanet() {
      ctx!.save();
      ctx!.shadowColor = 'rgba(0,0,0,0.3)';
      ctx!.shadowBlur = 12;
      ctx!.beginPath();
      ctx!.arc(cx, cy, R, 0, Math.PI * 2);
      ctx!.fillStyle = '#F5C000';
      ctx!.fill();
      ctx!.restore();
    }

    function frame() {
      ctx!.clearRect(0, 0, W, H);

      ctx!.save();
      ctx!.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx!.stroke();
      ctx!.restore();

      const items = figures.map(f => ({ fig: f, angle: t + f.offset }));
      items.sort((a, b) => Math.sin(a.angle) - Math.sin(b.angle));

      items.forEach(({ fig, angle }) => { if (Math.sin(angle) < 0) drawFig(fig, angle); });
      drawPlanet();
      items.forEach(({ fig, angle }) => { if (Math.sin(angle) >= 0) drawFig(fig, angle); });

      t += 0.028;
      raf = requestAnimationFrame(frame);
    }

    frame();

    // Авто-скрытие только в неуправляемом режиме (show не передан)
    const hideTimer   = show === undefined ? setTimeout(() => setHidden(true),   1600) : undefined;
    const unmountTimer = show === undefined ? setTimeout(() => setMounted(false), 2200) : undefined;

    return () => {
      cancelAnimationFrame(raf);
      if (hideTimer)    clearTimeout(hideTimer);
      if (unmountTimer) clearTimeout(unmountTimer);
    };
  }, [mounted, show]);

  if (!mounted) return null;

  return (
    <div className={`${styles.overlay} ${hidden ? styles.overlayHidden : ''}`}>
      <canvas ref={canvasRef} width={200} height={160} />
    </div>
  );
}
