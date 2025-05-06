import { renderAnimationPanel } from './animationPanel.js';
import { renderInteractionPanel } from './interactionPanel.js';
import { animate, setObjectsToSameZIndex } from './animations.js';

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
        // Capture all important properties including color, z-index and creation order
        return {
            canvasJSON: this.canvas.toJSON([
                'selectable', 'evented', 'zIndex', 'stroke', 'fill', 
                'animationType', 'isAnimated', 'originalLeft', 'originalTop',
                'isGroupRepresentative', 'groupId', 'memberIds',
                '_creationOrder' // Include creation order for stacking
            ]),
            animations: JSON.parse(JSON.stringify(this.canvas.activeAnimations || [])),
            interactions: JSON.parse(JSON.stringify(this.canvas.animationInteractions || []))
        };
    }

    load(state) {
        console.log("Loading state");
        const parsed = JSON.parse(state);
        const canvasState = parsed.canvasJSON;
        const animations = parsed.animations || [];
        const interactions = parsed.interactions || [];
        
        console.log("Loaded animations data:", animations);
        console.log("Loaded interactions data:", interactions);
        
        // Check if any bird animations have color and z-index data
        const hasBirds = animations.some(anim => 
            anim.type === 'birds' && 
            anim.data.some(d => d.color !== undefined || d.zIndex !== undefined)
        );
        
        if (hasBirds) {
            console.log("Found bird animations with color/z-index data!");
            animations.forEach(anim => {
                if (anim.type === 'birds') {
                    console.log("Bird animation data:", anim.data);
                }
            });
        }

        this.canvas.discardActiveObject();
        this.canvas.clear();
        this.canvas.activeAnimations = []; // Clear old animations
        this.canvas.animationInteractions = []; // Clear old interactions
        
        this.canvas.loadFromJSON(canvasState)
            .then(() => {
                // First collect all z-index values that should be applied
                const zIndices = new Map(); // Map of object ID to z-index
                
                // Extract z-indices from animation data
                animations.forEach(anim => {
                    if (anim.data && Array.isArray(anim.data)) {
                        anim.data.forEach(item => {
                            if (item.id !== undefined && item.zIndex !== undefined) {
                                zIndices.set(item.id, item.zIndex);
                            }
                        });
                    }
                });
                
                console.log("Collected z-indices:", Array.from(zIndices.entries()));
                
                // Apply z-indices to all objects based on ID
                if (zIndices.size > 0) {
                    this.canvas.getObjects().forEach(obj => {
                        if (obj.id !== undefined && zIndices.has(obj.id)) {
                            obj.set('zIndex', zIndices.get(obj.id));
                        }
                    });
                    
                    // Force canvas to sort objects by z-index
                    this.canvas._objects.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
                }
                
                this.canvas.requestRenderAll();
                
                // Save original animation data for comparison
                const originalAnimations = JSON.parse(JSON.stringify(animations));
                this.replayAnimations(animations);
                
                // Restore interaction data with all parameters
                this.canvas.animationInteractions = JSON.parse(JSON.stringify(interactions));
                
                // Compare the loaded objects with the original animation data
                setTimeout(() => {
                    console.log("After replay, canvas objects:", this.canvas.getObjects());
                    const birdObjects = this.canvas.getObjects().filter(o => o.animationType === 'bird');
                    if (birdObjects.length > 0) {
                        console.log("Bird objects after replay:", birdObjects);
                        birdObjects.forEach(bird => {
                            const birdGroup = bird;
                            const body = birdGroup.getObjects().find(o => o.type === 'polygon');
                            const wings = birdGroup.getObjects().filter(o => o.type === 'triangle');
                            console.log("Bird parts - Body:", body ? body.fill : 'none', 
                                        "Wings:", wings.map(w => w.fill), 
                                        "Z-index:", birdGroup.get('zIndex'));
                        });
                    }
                    
                    // Sort objects by z-index, falling back to creation order
                    this.canvas._objects.sort((a, b) => {
                      // Get z-index values (default to creation order if not set)
                      const aZIndex = a.zIndex !== undefined ? a.zIndex : (a._creationOrder || 0);
                      const bZIndex = b.zIndex !== undefined ? b.zIndex : (b._creationOrder || 0);
                      
                      // Sort by z-index
                      return aZIndex - bZIndex;
                    });
                    
                    this.canvas.requestRenderAll();
                }, 100);
                
                renderAnimationPanel(this.canvas);
                renderInteractionPanel(this.canvas);
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
            
            // For each object, make sure it gets its correct z-index and color from the data
            directMatches.forEach(obj => {
              const dataItem = anim.data.find(d => d.id === obj.id);
              if (dataItem) {
                // Restore z-index if available
                if (dataItem.zIndex !== undefined) {
                  obj.set('zIndex', dataItem.zIndex);
                }
                
                // Restore color if available (for birds)
                if (dataItem.color && obj.animationType === 'bird') {
                  // For birds, which are fabric groups, we need to update the fill of their parts
                  const body = obj.getObjects().find(o => o.type === 'polygon');
                  const wings = obj.getObjects().filter(o => o.type === 'triangle');
                  
                  if (body) body.set('fill', dataItem.color);
                  wings.forEach(wing => wing.set('fill', dataItem.color));
                }
              }
            });
          } else {
            console.log(`No direct matches for animation ${anim.id}, looking for group members...`);
            
            // Check for group members or recreate groups if needed
            const groupData = anim.data.filter(d => d.isGroup && Array.isArray(d.memberIds));
            const regularData = anim.data.filter(d => !d.isGroup || !Array.isArray(d.memberIds));
            
            // Add non-group objects
            const regularObjects = regularData
              .map(entry => {
                const obj = this.canvas.getObjects().find(o => o.id === entry.id);
                if (obj) {
                  // Set the z-index if data has z-index
                  if (entry.zIndex !== undefined) {
                    obj.set('zIndex', entry.zIndex);
                  }
                  
                  // Restore color if available (for birds)
                  if (entry.color && obj.animationType === 'bird') {
                    // For birds, which are fabric groups, we need to update the fill of their parts
                    const body = obj.getObjects().find(o => o.type === 'polygon');
                    const wings = obj.getObjects().filter(o => o.type === 'triangle');
                    
                    if (body) body.set('fill', entry.color);
                    wings.forEach(wing => wing.set('fill', entry.color));
                  }
                }
                return obj;
              })
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
                if (groupEntry.zIndex !== undefined) {
                  groupObj.set('zIndex', groupEntry.zIndex);
                }
                
                // Restore color for group if available (for bird groups)
                if (groupEntry.color && groupObj.animationType === 'bird') {
                  // For birds, which are fabric groups, we need to update the fill of their parts
                  const body = groupObj.getObjects().find(o => o.type === 'polygon');
                  const wings = groupObj.getObjects().filter(o => o.type === 'triangle');
                  
                  if (body) body.set('fill', groupEntry.color);
                  wings.forEach(wing => wing.set('fill', groupEntry.color));
                }
                
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
                  
                  // Set all group members to the same z-index from the groupEntry
                  if (groupEntry.zIndex !== undefined) {
                    setObjectsToSameZIndex(memberObjs, groupEntry.zIndex);
                  }
                  
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
          
          // Create a copy of the animation data for the replay
          // to ensure color and z-index are preserved
          const animationData = JSON.parse(JSON.stringify(anim.data));
          
          // Debug log for bird animation data
          if (anim.type === 'birds') {
            console.log("Animation data before replay:", animationData);
            
            // Check if we have color and z-index in our data
            const colorsPresent = animationData.filter(d => d.color !== undefined).length;
            const zIndicesPresent = animationData.filter(d => d.zIndex !== undefined).length;
            console.log(`Colors present: ${colorsPresent}/${animationData.length}, Z-indices present: ${zIndicesPresent}/${animationData.length}`);
            
            // Debug the objects we're about to animate
            console.log("Objects to animate:", objsToAnimate);
            objsToAnimate.forEach(obj => {
              if (obj.animationType === 'bird') {
                const body = obj.getObjects().find(o => o.type === 'polygon');
                const wings = obj.getObjects().filter(o => o.type === 'triangle');
                console.log("Bird BEFORE animation - Body:", body ? body.fill : 'none', 
                          "Wings:", wings.map(w => w.fill), 
                          "Z-index:", obj.get('zIndex'));
              }
            });
          }
          
          // Ensure all animation properties are preserved during replay
          const animOptions = { 
            data: animationData,
            id: anim.id,
            title: anim.title,
            _titleCustomized: anim._titleCustomized,
            // Include any other properties that need preserving
            preserveZIndex: true,
            preserveColor: true,
            debugMode: true // Add debug flag
          };
          
          // Replay the animation with the found objects
          animate(anim.prompt || anim.type, this.canvas, objsToAnimate, animOptions, { save: false });
          
          // Debug log after animation replay
          if (anim.type === 'birds') {
            console.log("Animation complete, checking results...");
            setTimeout(() => {
              const birdObjects = this.canvas.getObjects().filter(o => o.animationType === 'bird');
              birdObjects.forEach(obj => {
                const body = obj.getObjects().find(o => o.type === 'polygon');
                const wings = obj.getObjects().filter(o => o.type === 'triangle');
                console.log("Bird AFTER animation - Body:", body ? body.fill : 'none', 
                          "Wings:", wings.map(w => w.fill), 
                          "Z-index:", obj.get('zIndex'));
                
                // Check if this bird has a corresponding data entry
                const dataEntry = animationData.find(d => d.id === obj.id);
                if (dataEntry) {
                  console.log("Data entry for this bird:", dataEntry);
                  console.log("Color match:", dataEntry.color === body?.fill);
                  console.log("Z-index match:", dataEntry.zIndex === obj.get('zIndex'));
                }
              });
            }, 100);
          }
        });
      }
        

    updateButtons() {
        document.getElementById('undoBtn').disabled = !this.undoStack.length;
        document.getElementById('redoBtn').disabled = !this.redoStack.length;
    }
}
