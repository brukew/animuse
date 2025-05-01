import { animate } from './animations.js';;

export function bindToolbar(canvas) {
  const colorPicker = document.getElementById('colorPicker');
  const sizePicker = document.getElementById('sizePicker');
  const drawBtn = document.getElementById('drawBtn');
  const selectBtn = document.getElementById('selectBtn');
  const deleteBtn = document.getElementById('deleteBtn');
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  const pauseBtn = document.getElementById('pauseBtn');

  let animationsPaused = false;
  let pencil = new fabric.PencilBrush(canvas);

  function clearActive() { [drawBtn, selectBtn].forEach(b => b.classList.remove('active')); }
  
  function setDraw() {
    canvas.isDrawingMode = true; canvas.selection = false;
    canvas.forEachObject(o => { o.selectable = o.evented = false; });
    pencil.color = colorPicker.value; pencil.width = +sizePicker.value; pencil.globalCompositeOperation = 'source-over';
    canvas.freeDrawingBrush = pencil; canvas.defaultCursor = 'crosshair';
    clearActive(); drawBtn.classList.add('active');
  }

  function setSelect() {
    canvas.isDrawingMode = false; canvas.selection = true;
    canvas.forEachObject(o => { o.selectable = o.evented = true; });
    clearActive(); selectBtn.classList.add('active');
  }

  function deleteSel() {
    const objs = canvas.getActiveObjects()

    if (objs.length < 1) return alert('Select something');

    canvas.remove(...objs);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    setTimeout(() => canvas.history.saveState(), 20); // <-- save deletion into history
  }

  drawBtn.addEventListener('click', setDraw);
  selectBtn.addEventListener('click', setSelect);
  deleteBtn.addEventListener('click', deleteSel);
  colorPicker.addEventListener('change', e => pencil.color = e.target.value);
  sizePicker.addEventListener('input', e => pencil.width = +e.target.value);
  undoBtn.addEventListener('click', () => canvas.history.undo());
  redoBtn.addEventListener('click', () => canvas.history.redo());

  pauseBtn.addEventListener('click', () => {
    animationsPaused = !animationsPaused;
    pauseBtn.textContent = animationsPaused ? "Resume" : "Pause";
  
    canvas.getObjects().forEach(o => {
      if (o.isAnimated && o.tween) {
        animationsPaused ? o.tween.pause() : o.tween.resume();
      }
    });
  });

  document.getElementById('animateBtn').addEventListener('click', () => {
    const sel = canvas.getActiveObjects();
    if (!sel.length) return alert('Select items');
  
    const rawPrompt = prompt('Animate: birds or apples?') || '';
    animate(rawPrompt, canvas, sel)
    
  });
  
  canvas.discardActiveObject();
  setDraw();
}