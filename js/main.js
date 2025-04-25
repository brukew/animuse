import { setupCanvas } from './canvasSetup.js';
import { bindToolbar } from './toolbar.js';
import { enableGestures } from './gestures.js';

window.addEventListener('load', () => {
  const canvas = setupCanvas('canvas');
  bindToolbar(canvas);
  enableGestures(canvas);
});