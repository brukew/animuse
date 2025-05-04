import { setupCanvas } from './canvasSetup.js';
import { Toolbar } from './toolbar.js';
import { enableGestures } from './gestures.js';

fabric.Object.prototype.toObject = (function(toObject) {
  return function(propertiesToInclude = []) {
    propertiesToInclude = Array.isArray(propertiesToInclude)
      ? propertiesToInclude
      : [];

    const original = toObject.call(this, propertiesToInclude);
    original.id = this.id;
    return original;
  };
})(fabric.Object.prototype.toObject);
  
fabric.Object.__uidCounter = 1;


window.addEventListener('load', () => {
  const canvas = setupCanvas('canvas');
  const toolbar = new Toolbar(canvas);
  enableGestures(canvas);
});