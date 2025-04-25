import { StateHistory } from './stateHistory.js';

export function setupCanvas(id) {
  const canvas = new fabric.Canvas(id, { preserveObjectStacking: true });
  gsap.ticker.add(canvas.requestRenderAll.bind(canvas));
  const history = new StateHistory(canvas);
  canvas.history = history;  // expose
  canvas.on('path:created', () => setTimeout(() => history.saveState(), 20));
  canvas.on('object:modified', () => setTimeout(() => history.saveState(), 20));
  setTimeout(() => history.initState(), 100);
  return canvas;
}