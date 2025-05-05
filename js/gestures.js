export function enableGestures(canvas) {
    const el = canvas.upperCanvasEl;
    el.style.touchAction = 'none';
    el.addEventListener('gesturestart', e => e.preventDefault(), {passive: false});
    
    // Update toolbar state after selection changes
    canvas.on('selection:created', () => {
      if (window.toolbar) {
        window.toolbar.updateGroupButton();
      }
    });
    
    canvas.on('selection:updated', () => {
      if (window.toolbar) {
        window.toolbar.updateGroupButton();
      }
    });
    
    canvas.on('selection:cleared', () => {
      if (window.toolbar) {
        window.toolbar.updateGroupButton();
      }
    });
  }