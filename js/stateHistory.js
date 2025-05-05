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
          // When replaying animations:
          // 1. For group animations, we should find the animation object directly or reconstruct it
          // 2. For regular animations, find the individual objects
          
          let objsToAnimate = [];
          
          // First, try to find animation objects directly by ID
          const directMatches = this.canvas.getObjects().filter(o => 
            anim.data.some(d => d.id === o.id)
          );
          
          if (directMatches.length > 0) {
            // We found the exact animated objects, use them directly
            console.log(`Found ${directMatches.length} direct matches for animation ${anim.id}`);
            objsToAnimate = directMatches;
          } else {
            console.log(`No direct matches for animation ${anim.id}, looking for group members...`);
            
            // Check for group members or recreate groups if needed
            const groupData = anim.data.filter(d => d.isGroup && Array.isArray(d.memberIds));
            const regularData = anim.data.filter(d => !d.isGroup || !Array.isArray(d.memberIds));
            
            // Add non-group objects
            const regularObjects = regularData
              .map(entry => this.canvas.getObjects().find(o => o.id === entry.id))
              .filter(Boolean);
              
            objsToAnimate.push(...regularObjects);
            
            // Handle groups
            for (const groupEntry of groupData) {
              // Try to find the object that represents this group
              const groupObj = this.canvas.getObjects().find(o => 
                o.id === groupEntry.id || 
                (o.groupId === groupEntry.groupId && o.isGroupRepresentative)
              );
              
              if (groupObj) {
                // The group object already exists
                objsToAnimate.push(groupObj);
              } else if (groupEntry.memberIds && groupEntry.memberIds.length > 0) {
                // Try to find the member objects to recreate the group
                const memberObjs = groupEntry.memberIds
                  .map(id => this.canvas.getObjects().find(o => o.id === id))
                  .filter(Boolean);
                  
                if (memberObjs.length > 0) {
                  // Group these objects together first, then animate them
                  memberObjs.forEach(obj => {
                    obj.groupId = groupEntry.groupId || `group_${Date.now()}`;
                  });
                  
                  objsToAnimate.push(...memberObjs);
                }
              }
            }
          }
          
          console.log(`Found total ${objsToAnimate.length} objects to animate for ${anim.id}`);
          
          if (!objsToAnimate.length) {
            console.warn(`No objects found to replay animation ${anim.id}`);
            return;
          }
          
          // Replay the animation with the found objects, preserving the title
          animate(anim.prompt || anim.type, this.canvas, objsToAnimate, { 
            data: anim.data,
            id: anim.id,
            title: anim.title,
            _titleCustomized: anim._titleCustomized
          }, { save: false });
        });
      }
        

    updateButtons() {
        document.getElementById('undoBtn').disabled = !this.undoStack.length;
        document.getElementById('redoBtn').disabled = !this.redoStack.length;
    }
}
