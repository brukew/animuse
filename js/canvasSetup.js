import { StateHistory } from './stateHistory.js';

export function setupCanvas(id) {
  const canvas = new fabric.Canvas(id, { preserveObjectStacking: true });
  gsap.ticker.add(canvas.requestRenderAll.bind(canvas));

  const history = new StateHistory(canvas);
  canvas.history = history;

  canvas.on('path:created', () => setTimeout(() => history.saveState(), 20));

  canvas.on('object:modified', (e) => {
    const objects = e.target.type === 'activeSelection' ? e.target.getObjects() : [e.target];
  
    objects.forEach(o => {
      if (o.isAnimated && o.animationType === 'apple') {
        o.originalLeft = o.left;
      }
  
      if (o.tween) {
        o.tween.resume();
      }
    });
  
    setTimeout(() => canvas.history.saveState(), 20);
  });

  canvas.on('selection:created', () => {
    canvas.getActiveObjects().forEach(o => {
      if (o?.tween && o?.isAnimated) {
        o.tween.pause();
      }
    });
  });

  canvas.on('selection:cleared', () => {
    // Only resume if objects are paused
    const paused = canvas.getObjects().some(o => o.tween?.pause && !gsap.isTweening(o));
    if (!paused) return;
  
    canvas.getObjects().forEach(o => {
      if (o.tween?.resume) o.tween.resume();
    });
  });

  setTimeout(() => history.initState(), 100);
  return canvas;
}
