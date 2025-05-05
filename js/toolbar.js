// toolbar.js
import { animate } from './animations.js';

export class Toolbar {
  constructor(canvas) {
    this.canvas = canvas;
    this.animationsPaused = false;
    this.pencil = new fabric.PencilBrush(canvas);
    this.setup();
  }

  setup() {
    const {
      canvas, pencil,
      get = id => document.getElementById(id)
    } = this;

    this.colorPicker = get('colorPicker');
    this.sizePicker = get('sizePicker');
    this.drawBtn = get('drawBtn');
    this.selectBtn = get('selectBtn');
    this.groupBtn = get('groupBtn');
    this.deleteBtn = get('deleteBtn');
    this.undoBtn = get('undoBtn');
    this.redoBtn = get('redoBtn');
    this.pauseBtn = get('pauseBtn');

    this.clearActive = () => [this.drawBtn, this.selectBtn].forEach(b => b.classList.remove('active'));

    this.drawBtn.addEventListener('click', () => this.setDrawMode());
    this.selectBtn.addEventListener('click', () => this.setSelectMode());
    this.deleteBtn.addEventListener('click', () => this.deleteSelected());
    this.undoBtn.addEventListener('click', () => canvas.history.undo());
    this.redoBtn.addEventListener('click', () => canvas.history.redo());
    this.pauseBtn.addEventListener('click', () => this.toggleAnimations());
    
    // Initialize group button state
    this.updateGroupButton();
    
    // Group button event listener
    this.groupBtn.addEventListener('click', () => {
      const sel = canvas.getActiveObjects();
      if (!sel || sel.length < 2) return;
      
      // Generate a unique group ID
      const groupId = `group_${Date.now()}`;
      
      // Assign the group ID to all selected objects
      sel.forEach(obj => {
        obj.groupId = groupId;
      });
      
      // Save state after grouping
      setTimeout(() => canvas.history.saveState(), 20);
      
      // Clear selection to ensure proper visual state
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    });

    get('animateBtn').addEventListener('click', () => {
      const sel = canvas.getActiveObjects();
      if (!sel.length) return alert('Select items');
    
      const ids = sel.map(o => o.id);

      const existingAnim = canvas.activeAnimations?.find(a =>
        a.data.some(d => ids.includes(d.id))
      );
        
      if (existingAnim) {
        const confirmMsg = `These objects are already animated with: "${existingAnim.prompt}"\n\nDo you want to reanimate them with the new prompt?`;
        const confirmed = confirm(confirmMsg);
        if (!confirmed) return;
        const rawPrompt = prompt('Animate: birds or apples?') || '';
        animate(rawPrompt, canvas, sel, {
          update: true,
          id: existingAnim.id,
          data: existingAnim.data
        }, { save: true });
      }

      else{
        const rawPrompt = prompt('Animate: birds or apples?') || '';
        animate(rawPrompt, canvas, sel);
      }
    });

    this.colorPicker.addEventListener('change', e => pencil.color = e.target.value);
    this.sizePicker.addEventListener('input', e => pencil.width = +e.target.value);

    this.setDrawMode();
  }

  setDrawMode() {
    const { canvas, pencil } = this;
    canvas.isDrawingMode = true;
    canvas.selection = false;
    canvas.forEachObject(o => { o.selectable = o.evented = false; });
    pencil.color = this.colorPicker.value;
    pencil.width = +this.sizePicker.value;
    pencil.globalCompositeOperation = 'source-over';
    canvas.freeDrawingBrush = pencil;
    canvas.defaultCursor = 'crosshair';
    this.clearActive();
    this.drawBtn.classList.add('active');
  }

  setSelectMode() {
    const { canvas } = this;
    canvas.isDrawingMode = false;
    canvas.selection = true;
    canvas.forEachObject(o => { o.selectable = o.evented = true; });
    this.clearActive();
    this.selectBtn.classList.add('active');
  }

  deleteSelected() {
    const { canvas } = this;
    const objs = canvas.getActiveObjects();
    if (objs.length < 1) return alert('Select something');

    canvas.remove(...objs);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    setTimeout(() => canvas.history.saveState(), 20);
  }

  toggleAnimations() {
    const { canvas } = this;
    this.animationsPaused = !this.animationsPaused;
    this.pauseBtn.textContent = this.animationsPaused ? 'Resume' : 'Pause';
    canvas.getObjects().forEach(o => {
      if (o.isAnimated && o.tween) {
        this.animationsPaused ? o.tween.pause() : o.tween.resume();
      }
    });
  }
  
  // Update the group button state based on the current selection
  updateGroupButton() {
    const { canvas } = this;
    const sel = canvas.getActiveObjects?.() || [];
    this.groupBtn.disabled = sel.length < 2;
  }
}

export function deleteSel(canvas) {
  const objs = canvas.getActiveObjects();
  if (!objs.length) return alert('Select something');

  canvas.remove(...objs);
  canvas.discardActiveObject();
  canvas.requestRenderAll();
  setTimeout(() => canvas.history.saveState(), 0);
}
