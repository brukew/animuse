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

    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Only trigger if not typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      // Check for Ctrl/Cmd key (metaKey is Cmd on Mac, ctrlKey is Ctrl on Windows/Linux)
      const isCtrlOrCmd = e.metaKey || e.ctrlKey;
      
      if (isCtrlOrCmd) {
        switch (e.key.toLowerCase()) {
          case 'b':
            e.preventDefault();
            this.setDrawMode();
            break;
          case 'e':
            e.preventDefault();
            this.setSelectMode();
            break;
          case 'm':
            e.preventDefault();
            // Trigger animate button click
            get('animateBtn').click();
            break;
          case 'g':
            e.preventDefault();
            // Trigger group button click
            this.groupBtn.click();
            break;
          case 'k':
            e.preventDefault();
            this.toggleAnimations();
            break;
          case 'v':
            e.preventDefault();
            // Toggle voice input
            const voiceBtn = document.getElementById('speechToggleBtn');
            if (voiceBtn) {
              voiceBtn.click();
            }
            break;
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              // Ctrl/Cmd + Shift + Z for redo
              if (!this.redoBtn.disabled) {
                this.canvas.history.redo();
              }
            } else {
              // Ctrl/Cmd + Z for undo
              if (!this.undoBtn.disabled) {
                this.canvas.history.undo();
              }
            }
            break;
          case 'y':
            e.preventDefault();
            // Remove Cmd/Ctrl + Y as redo shortcut
            break;
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        this.deleteSelected();
      }
    });

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

    get('animateBtn').addEventListener('click', async () => {
      const sel = canvas.getActiveObjects();
      if (!sel.length) return alert('Select items');
    
      const ids = sel.map(o => o.id);

      const existingAnim = canvas.activeAnimations?.find(a =>
        a.data.some(d => ids.includes(d.id))
      );
        
      // Get the prompt from user
      const rawPrompt = prompt('Describe the animation you want to create:') || '';
      if (!rawPrompt) return; // User cancelled
      
      // Create a status message
      const statusDiv = document.createElement('div');
      statusDiv.className = 'llm-status';
      statusDiv.textContent = 'Processing your animation request...';
      document.body.appendChild(statusDiv);
      
      try {
        // Process the prompt through the LLM controller
        if (window.llmController) {
          const parsedCommand = await window.llmController.processPrompt(rawPrompt);
          
          if (parsedCommand.error) {
            statusDiv.textContent = parsedCommand.error;
            setTimeout(() => document.body.removeChild(statusDiv), 3000);
            return;
          }
          
          // If it's a create animation command, use the parsed animation type
          if (parsedCommand.action === 'create' && parsedCommand.animationType) {
            statusDiv.textContent = `Creating ${parsedCommand.animationType} animation...`;
            const title = parsedCommand.title
            // Handle reanimation case
            if (existingAnim) {
              const confirmMsg = `These objects are already animated with: "${existingAnim.prompt}"\n\nDo you want to reanimate them with ${parsedCommand.animationType}?`;
              const confirmed = confirm(confirmMsg);
              if (!confirmed) {
                document.body.removeChild(statusDiv);
                return;
              }
              
              animate(parsedCommand.animationType, canvas, sel, {
                update: true,
                id: existingAnim.id,
                data: existingAnim.data,
                title: title
              }, { save: true });
            } else {
              // Create new animation
              animate(parsedCommand.animationType, canvas, sel, {
                title: title
              });
            }
            
            statusDiv.textContent = `Created ${parsedCommand.animationType} animation`;
            setTimeout(() => document.body.removeChild(statusDiv), 2000);
          } else {
            // Fallback to using the raw prompt if we couldn't parse it
            statusDiv.textContent = `Using original prompt: ${rawPrompt}`;
            
            if (existingAnim) {
              animate(rawPrompt, canvas, sel, {
                update: true,
                id: existingAnim.id,
                data: existingAnim.data
              }, { save: true });
            } else {
              animate(rawPrompt, canvas, sel);
            }
            
            setTimeout(() => document.body.removeChild(statusDiv), 2000);
          }
        } else {
          // Fallback if LLM controller isn't available
          statusDiv.textContent = 'LLM not available, using direct animation';
          
          if (existingAnim) {
            animate(rawPrompt, canvas, sel, {
              update: true,
              id: existingAnim.id,
              data: existingAnim.data
            }, { save: true });
          } else {
            animate(rawPrompt, canvas, sel);
          }
          
          setTimeout(() => document.body.removeChild(statusDiv), 2000);
        }
      } catch (error) {
        console.error('Error processing animation prompt:', error);
        statusDiv.textContent = 'Error processing animation: ' + error.message;
        setTimeout(() => document.body.removeChild(statusDiv), 3000);
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
    // Toggle the global animation pause state
    this.animationsPaused = !this.animationsPaused;
    this.pauseBtn.textContent = this.animationsPaused ? 'Resume' : 'Pause';
    
    console.log('Global animation state toggled - paused:', this.animationsPaused);
    
    // First check if any object was manually moved while paused
    const hasMoved = canvas.getObjects().some(o => 
      o.isAnimated && o._pausedState && o._manuallyMoved
    );
    
    // Debug log
    console.log('Toggle animations - has moved objects:', hasMoved);
    
    canvas.getObjects().forEach(o => {
      if (o.isAnimated && o.tween) {
        if (this.animationsPaused) {
          // PAUSING all animations
          console.log('Pausing animation for:', o.id, o.animationType);
          
          // Use custom pause if available
          if (o.tween.customPause) {
            o.tween.customPause();
          } else {
            o.tween.pause();
          }
        } else {
          // RESUMING all animations
          console.log('Resuming animation for:', o.id, o.animationType, 
                     'Manually moved:', o._manuallyMoved ? 'yes' : 'no');
          
          // Use custom resume if available
          if (o.tween.customResume) {
            o.tween.customResume();
          } else {
            o.tween.resume();
          }
          
          // Special handling for apple animations to eliminate jumps
          if (o.animationType === 'apple' && o._manuallyMoved) {
            // Ensure the animation stays at the correct position
            // This will be handled by the customResume function
            console.log('Special handling for manually moved apple:', o.id);
          }
        }
      }
    });
    
    // Save state after toggling animations if objects have moved
    if (!this.animationsPaused && hasMoved) {
      console.log('Saving state after resuming with moved objects');
      setTimeout(() => canvas.history.saveState(), 50);
    }
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
