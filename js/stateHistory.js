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
        const j = JSON.stringify(this.canvas.toJSON(['selectable','evented']));
        this.previous = this.current = j;
        this.updateButtons();
    }
    saveState() {
        if (this.isBusy) return;
        const j = JSON.stringify(this.canvas.toJSON(['selectable','evented']));
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
        if (!this.undoStack.length || this.isBusy) return;
        this.isBusy = true;
        const prev = this.undoStack.pop();
        this.redoStack.push(this.current);
        this.current = prev;
        this.load(prev);
        this.isBusy = false;
        this.updateButtons();
    }
    redo() {
        if (!this.redoStack.length || this.isBusy) return;
        this.isBusy = true;
        const next = this.redoStack.pop();
        this.undoStack.push(this.current);
        this.current = next;
        this.load(next);
        this.isBusy = false;
        this.updateButtons();
    }
    load(state) {
        this.canvas.discardActiveObject();
        this.canvas.clear();
        const obj = JSON.parse(state);
        this.canvas.loadFromJSON(obj, () => this.canvas.requestRenderAll());
    }
    updateButtons() {
        document.getElementById('undoBtn').disabled = !this.undoStack.length;
        document.getElementById('redoBtn').disabled = !this.redoStack.length;
    }
  }
  