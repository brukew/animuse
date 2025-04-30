import { StateHistory } from './stateHistory.js';

export function setupCanvas(id) {
  const canvas = new fabric.Canvas(id, { preserveObjectStacking: true });
  gsap.ticker.add(canvas.requestRenderAll.bind(canvas));

  const history = new StateHistory(canvas);
  canvas.history = history;

  canvas.on('path:created', () => setTimeout(() => history.saveState(), 20));

  canvas.on('selection:created', () => {
    canvas.getActiveObjects().forEach(o => {
      if (o?.tween && o?.isAnimated) {
        o.tween.pause();
      }
    });
  });

  canvas.on('selection:cleared', () => {
    canvas.getObjects().forEach(o => {
      if (o?.isAnimated && o.animationType === 'apple') {
        o.originalLeft = o.left; 
      }

      if (o?.tween && o?.isAnimated) {
        o.tween.resume();
      }
    });

    setTimeout(() => history.saveState(), 20);
  });

  setTimeout(() => history.initState(), 100);
  return canvas;
}
