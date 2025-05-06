import { setupCanvas } from './canvasSetup.js';
import { Toolbar } from './toolbar.js';
import { enableGestures } from './gestures.js';
import { renderInteractionPanel } from './interactionPanel.js';

fabric.Object.prototype.toObject = (function(toObject) {
    return function(propertiesToInclude) {
      const original = toObject.call(this, propertiesToInclude);
      original.id = this.id;
      original.groupId = this.groupId || null;
      return original;
    };
  })(fabric.Object.prototype.toObject);
  
fabric.Object.__uidCounter = 1;


window.addEventListener('load', () => {
  const canvas = setupCanvas('canvas');
  const toolbar = new Toolbar(canvas);
  // Expose the toolbar for group button updates
  window.toolbar = toolbar;
  enableGestures(canvas);
  
  // Initialize the interaction panel
  renderInteractionPanel(canvas);
});