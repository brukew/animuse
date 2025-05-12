import { StateHistory } from './stateHistory.js';
import { renderAnimationPanel, updateSelectionState } from './animationPanel.js';

export function setupCanvas(id) {
  const canvas = new fabric.Canvas(id, { 
    preserveObjectStacking: true // preserve manual object stacking
  });
  
  // Track object creation order using incrementing counter
  let objectCreationCounter = 0;
  
  // Override the original add method to assign creation order
  const originalAdd = canvas.add;
  canvas.add = function(...objects) {
    objects.forEach(obj => {
      // Assign a creation timestamp if not already present
      if (obj._creationOrder === undefined) {
        obj._creationOrder = objectCreationCounter++;
        
        // If z-index is not explicitly set, use creation order as z-index
        if (obj.zIndex === undefined) {
          obj.set('zIndex', obj._creationOrder);
        }
      }
    });
    
    return originalAdd.apply(this, objects);
  };
  
  // Add custom render method to ensure proper stacking order
  const originalRenderAll = canvas.renderAll;
  canvas.renderAll = function() {
    // Sort by explicit z-index first, then by creation order if z-index is equal
    this._objects.sort((a, b) => {
      // Get z-index values (default to creation order if not set)
      const aZIndex = a.zIndex !== undefined ? a.zIndex : (a._creationOrder || 0);
      const bZIndex = b.zIndex !== undefined ? b.zIndex : (b._creationOrder || 0);
      
      // Sort by z-index
      return aZIndex - bZIndex;
    });
    
    originalRenderAll.call(this);
  };
  
  gsap.ticker.add(canvas.requestRenderAll.bind(canvas));

  const history = new StateHistory(canvas);
  canvas.history = history;

  canvas.on('path:created', () => setTimeout(() => history.saveState(), 20));

  return canvas;
}
