export function enableGestures(canvas) {
    const el = canvas.upperCanvasEl;
    el.style.touchAction = 'none';
    el.addEventListener('gesturestart', e=>e.preventDefault(),{passive:false});
  }