import { StateHistory } from './stateHistory.js';
import { renderAnimationPanel } from './animationPanel.js';

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

  canvas.on('object:removed', () => {
    let changed = false;
  
    canvas.activeAnimations = (canvas.activeAnimations || []).filter(anim => {
      const remainingData = anim.data.filter(d =>
        canvas.getObjects().some(o => o.id === d.id)
      );
  
      if (remainingData.length !== anim.data.length) {
        anim.data = remainingData;
        changed = true;
      }
  
      // If none left, remove the animation entirely
      return remainingData.length > 0;
    });
  
    if (changed) {
      renderAnimationPanel(canvas);
    }
  });

  canvas.on('selection:created', () => {
    // Pause animations for selected objects
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
  
  // Handle clicking on grouped objects
  canvas.on('mouse:down', (e) => {
    const clicked = e.target;
    if (clicked?.groupId) {
      const groupId = clicked.groupId;
      
      // Find all objects with the same group ID
      const grouped = canvas.getObjects().filter(o => o.groupId === groupId);
      
      // Only create a selection if there are multiple objects in the group
      if (grouped.length > 1) {
        const sel = new fabric.ActiveSelection(grouped, { canvas });
        canvas.setActiveObject(sel);
        canvas.requestRenderAll();
      }
    }
  });

  setTimeout(() => history.initState(), 100);
  return canvas;
}
