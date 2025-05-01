import { renderAnimationPanel } from './animationPanel.js';
import { animate } from './animations.js';

export class StateHistory {
    constructor(canvas) {
        this.canvas = canvas;
        this.undoStack = [];
        this.redoStack = [];
        this.maxLength = 30;
        this.isBusy = false;
        this.previous = null;
        this.current = null;
    }

    initState() {
        const j = JSON.stringify(this.captureState());
        this.previous = this.current = j;
        this.updateButtons();
    }
0
    saveState() {
        console.log("Saving state");
        if (this.isBusy) return;
        const j = JSON.stringify(this.captureState());
        if (j === this.current) return;
        if (this.previous) {
            if (this.undoStack.length >= this.maxLength) this.undoStack.shift();
            this.undoStack.push(this.previous);
        }
        this.previous = this.current;
        this.current = j;
        this.redoStack = [];
        this.updateButtons();
    }

    undo() {
        console.log("Undoing state");
        if (!this.undoStack.length || this.isBusy) return;
        this.isBusy = true;
        this.redoStack.push(this.current);
        this.current = this.previous;
        this.previous = this.undoStack.pop() || null;
        this.load(this.current);
        this.isBusy = false;
        this.updateButtons();
    }

    redo() {
        console.log("Redoing state");
        if (!this.redoStack.length || this.isBusy) return;
        this.isBusy = true;
        const next = this.redoStack.pop();
        this.undoStack.push(this.previous);
        this.previous = this.current;
        this.current = next;
        this.load(next);
        this.isBusy = false;
        this.updateButtons();
    }

    captureState() {
        return {
            canvasJSON: this.canvas.toJSON(['selectable', 'evented']),
            animations: this.canvas.activeAnimations || []
        };
    }

    load(state) {
        console.log("Loading state");
        const parsed = JSON.parse(state);
        const canvasState = parsed.canvasJSON;
        const animations = parsed.animations || [];

        this.canvas.discardActiveObject();
        this.canvas.clear();
        this.canvas.activeAnimations = []; // Clear old animations
        
        this.canvas.loadFromJSON(canvasState)
            .then(() => {
                this.canvas.requestRenderAll();
                this.replayAnimations(animations);
                renderAnimationPanel(this.canvas);
            })
    }

    replayAnimations(animations) {
        console.log("Replaying animations:", animations);
      
        animations.forEach(anim => {
          const objs = anim.data.map(entry =>
            this.canvas.getObjects().find(o => o.id === entry.id)
          ).filter(Boolean);
      
          if (!objs.length) return;
      
          animate(anim.prompt || anim.type, this.canvas, objs, { data: anim.data }, { save: false });
        });
      }
        

    updateButtons() {
        document.getElementById('undoBtn').disabled = !this.undoStack.length;
        document.getElementById('redoBtn').disabled = !this.redoStack.length;
    }
}
