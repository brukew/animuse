import { StateHistory } from './stateHistory.js';
import { renderAnimationPanel } from './animationPanel.js';

export function setupCanvas(id) {
  const canvas = new fabric.Canvas(id, { 
    preserveObjectStacking: true // preserve manual object stacking
  });
  
  // Track object creation order using incrementing counter
  let objectCreationCounter = 0;
  
  // Override the original add method to assign creation order
  const originalAdd = canvas.add;
  canvas.add = function(...objects) {
    objects.forEach(obj => {
      // Assign a creation timestamp if not already present
      if (obj._creationOrder === undefined) {
        obj._creationOrder = objectCreationCounter++;
        
        // If z-index is not explicitly set, use creation order as z-index
        if (obj.zIndex === undefined) {
          obj.set('zIndex', obj._creationOrder);
        }
      }
    });
    
    return originalAdd.apply(this, objects);
  };
  
  // Add custom render method to ensure proper stacking order
  const originalRenderAll = canvas.renderAll;
  canvas.renderAll = function() {
    // Sort by explicit z-index first, then by creation order if z-index is equal
    this._objects.sort((a, b) => {
      // Get z-index values (default to creation order if not set)
      const aZIndex = a.zIndex !== undefined ? a.zIndex : (a._creationOrder || 0);
      const bZIndex = b.zIndex !== undefined ? b.zIndex : (b._creationOrder || 0);
      
      // Sort by z-index
      return aZIndex - bZIndex;
    });
    
    originalRenderAll.call(this);
  };
  
  gsap.ticker.add(canvas.requestRenderAll.bind(canvas));

  const history = new StateHistory(canvas);
  canvas.history = history;

  canvas.on('path:created', () => setTimeout(() => history.saveState(), 20));

  canvas.on('object:modified', (e) => {
    const objects = e.target.type === 'activeSelection' ? e.target.getObjects() : [e.target];
  
    objects.forEach(o => {
      if (o.isAnimated) {
        console.log('Object moved:', o.id, 'Animation type:', o.animationType);
        
        // Reset dragging flag since the modification is complete
        o.dragging = false;
        
        // Common handling for all animation types
        if (o._pausedState) {
          console.log('Object was paused when moved');
          // Mark that this object was manually moved while paused
          o._manuallyMoved = true;
        }
        
        // Animation-specific handling
        if (o.animationType === 'apple') {
          // Update the original position to the new position
          o.originalLeft = o.left;
          if (o.top !== undefined) {
            o.originalTop = o.top;
          }
          
          // Reset animation parameters if paused
          if (o._pausedState) {
            // Don't modify the existing left/top/angle in the paused state
            // since we'll handle those specially in the customResume method
            o._pausedState.originalLeft = o.left;
            if (o.top !== undefined) {
              o._pausedState.originalTop = o.top;
            }
          } else {
            // If animation is running, reset the sway values
            o.swayX = 0;
            o.swayAngle = 0;
          }
        } else if (o.animationType === 'bird') {
          // For birds, update original position
          o.originalLeft = o.left;
          o.originalTop = o.top;
          
          // Update paused state if needed
          if (o._pausedState) {
            o._pausedState.originalLeft = o.left;
            o._pausedState.originalTop = o.top;
          }
        }
        
        // Important: Do NOT automatically resume animation after moving
        // Only resume if it was not paused before
        if (o.tween && !o._pausedState) {
          console.log('Animation was running - restarting from new position');
          // Only resume if not manually paused
          
          // For apple animations, we need to restart the animation
          // to prevent jumps when the object is moved during animation
          if (o.animationType === 'apple') {
            // Kill the old tween and create a new one to restart from current position
            if (typeof o.tween.kill === 'function') {
              // First pause the current tween
              o.tween.pause();
              
              // Get animation parameters from the original object
              const drift = 10;  // These values are hardcoded in swayApples
              const rock = 8;
              const dur = 1.2;
              
              // Reset animation parameters
              o.swayX = 0;
              o.swayAngle = 0;
              
              // Create a new update function
              const updateFn = () => {
                if (!o.dragging) {
                  o.set('left', o.originalLeft + o.swayX);
                  o.set('angle', o.swayAngle);
                  o.setCoords();
                  canvas.requestRenderAll();
                }
              };
              
              // Create a new tween
              const newTween = gsap.to(o, {
                swayX: `+=${drift}`,
                swayAngle: `+=${rock}`,
                duration: dur,
                yoyo: true,
                repeat: -1,
                ease: 'sine.inOut',
                onUpdate: updateFn
              });
              
              // Copy the custom methods
              if (o.tween.customPause) {
                newTween.customPause = o.tween.customPause;
                newTween.customResume = o.tween.customResume;
              }
              
              // Kill the old tween and replace it
              o.tween.kill();
              o.tween = newTween;
            } else {
              // Just reset the animation parameters if we can't kill/recreate
              o.swayX = 0;
              o.swayAngle = 0;
              o.tween.resume();
            }
          } else if (o.animationType === 'bird') {
            // For birds, we need to handle specially too, but not completely restart
            // Just resume the animation from the new position
            
            // First update velocity based on new position
            // (we'll just resume the animation, the flocking behavior will adapt)
            if (typeof o.tween.kill === 'function') {
              // Try to properly restart the bird's animation
              // But since birds use ticker, we can just pause/resume
              o.tween.pause();
              // Reset any temporary parameters
              o.angle = 0; // Reset angle, flocking will adjust
              o.tween.resume();
            } else {
              // Just resume
              o.tween.resume();
            }
          } else {
            // Resume the animation from the new position for other animation types
            o.tween.resume();
          }
        }
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

  // This is the first event handler for selection:created
  // which handles pausing animations when objects are selected
  canvas.on('selection:created', () => {
    // Pause animations for selected objects using custom pause
    canvas.getActiveObjects().forEach(o => {
      if (o?.isAnimated && o?.tween) {
        // Use custom pause if available, otherwise regular pause
        // Always pause on selection, regardless of global pause state
        if (o.tween.customPause) {
          o.tween.customPause();
        } else {
          o.tween.pause();
        }
      }
    });
  });
  
  // Add event listeners for dragging to prevent animation updates during drag
  canvas.on('mouse:down', (e) => {
    if (e.target?.isAnimated) {
      e.target.dragging = true;
    } else if (e.target?.type === 'activeSelection') {
      // Handle multiple selected items
      e.target.getObjects().forEach(o => {
        if (o.isAnimated) {
          o.dragging = true;
        }
      });
    }
  });
  
  canvas.on('object:moving', (e) => {
    // Ensure the dragging flag is set during movement
    if (e.target?.isAnimated) {
      e.target.dragging = true;
    } else if (e.target?.type === 'activeSelection') {
      // Handle multiple selected items
      e.target.getObjects().forEach(o => {
        if (o.isAnimated) {
          o.dragging = true;
        }
      });
    }
  });
  
  canvas.on('mouse:up', () => {
    // Reset dragging flag on all objects when mouse is released
    canvas.getObjects().forEach(o => {
      if (o?.isAnimated) {
        o.dragging = false;
      }
    });
  });
  
  canvas.on('selection:updated', (e) => {
    // Handle objects added to selection
    const newlySelected = e.selected || [];
    
    newlySelected.forEach(o => {
      if (o?.isAnimated && o?.tween) {
        // Use custom pause if available, otherwise regular pause
        if (o.tween.customPause) {
          o.tween.customPause();
        } else {
          o.tween.pause();
        }
      }
    });
    
    // Handle objects removed from selection
    const deselected = e.deselected || [];
    
    // Check if global animations are paused
    const toolbar = window.toolbar;
    const globalPaused = toolbar?.animationsPaused || false;
    
    // Only resume animations if they're not globally paused
    if (!globalPaused) {
      deselected.forEach(o => {
        if (o?.isAnimated && o?.tween) {
          // Check if object is no longer in any selection
          if (!canvas.getActiveObjects().includes(o)) {
            // Use custom resume if available, otherwise regular resume
            if (o.tween.customResume) {
              o.tween.customResume();
            } else {
              o.tween.resume();
            }
          }
        }
      });
    }
  });

  canvas.on('selection:cleared', () => {
    // Skip processing if we're in the middle of shift-selecting groups
    // This prevents objects from being unexpectedly deselected
    if (canvas._skipSelectionCleared) {
      console.log('Skipping selection:cleared event due to shift-select operation');
      return;
    }
    
    // Resume animations for objects that were in selection
    // BUT only if global animations aren't paused
    const toolbar = window.toolbar; // Access the toolbar through the global reference
    const globalPaused = toolbar?.animationsPaused || false;
    
    console.log('Selection cleared - global animations paused:', globalPaused);
    
    // Only resume if the global animations are not paused
    if (!globalPaused) {
      // Get objects that were in the previous selection
      const previousSelection = canvas._previousSelection;
      const objectsToResume = [];
      
      if (previousSelection) {
        if (previousSelection.type === 'activeSelection') {
          // Multiple objects were selected
          objectsToResume.push(...previousSelection.getObjects());
        } else {
          // Single object was selected
          objectsToResume.push(previousSelection);
        }
      }
      
      console.log('Selection cleared - objects to resume:', objectsToResume.length);
      
      // Resume only the previously selected objects
      objectsToResume.forEach(obj => {
        if (obj?.isAnimated && obj?.tween) {
          console.log('Resuming animation for:', obj.id, obj.animationType);
          // Use custom resume if available, otherwise regular resume
          if (obj.tween.customResume) {
            obj.tween.customResume();
          } else {
            obj.tween.resume();
          }
        }
      });
    } else {
      console.log('Animations globally paused - not resuming on deselection');
    }
  });
  
  // Enhanced handling of clicking on grouped objects while preserving shift-select
  let shiftGroupSelectionInProgress = false;
  
  // Prevent default behavior for mouse:down on objects when shift is pressed
  canvas.on('mouse:down', (e) => {
    if (e.e.shiftKey && e.target) {
      // If the user is holding shift and clicking on ANY object, we want to handle selection specially
      e.e.preventDefault();
      
      // For groups, we'll handle this in our own mouse:down handler below
      if (e.target.groupId) {
        shiftGroupSelectionInProgress = true;
      }
    }
  }, { priority: 999 }); // Make this run before Fabric's handlers
  
  // Our custom handler for selecting groups
  canvas.on('mouse:down', (e) => {
    const clicked = e.target;
    const isShiftPressed = e.e.shiftKey;
    
    // If we're clicking on an object that's part of a group
    if (clicked?.groupId) {
      const groupId = clicked.groupId;
      
      // Find all objects with the same group ID
      const grouped = canvas.getObjects().filter(o => o.groupId === groupId);
      
      // Only handle if there are multiple objects in the group
      if (grouped.length > 1) {
        // If shift is pressed and there's an active selection
        if (isShiftPressed && canvas.getActiveObject()) {
          const currentSelection = canvas.getActiveObject();
          let selectedObjects = [];
          
          // The key was using includes() instead of strict equality
          if (currentSelection.type && currentSelection.type.includes('activeSelection')) {
            selectedObjects = currentSelection.getObjects();
          } else {
            selectedObjects = [currentSelection];
          }
          
          // Create a combined selection with all objects
          const allObjects = [...new Set([...selectedObjects, ...grouped])];
          
          // Use flag to prevent selection:cleared from being processed
          canvas._skipSelectionCleared = true;
          canvas.discardActiveObject();
          
          // Create a new selection with all objects
          const newSelection = new fabric.ActiveSelection(allObjects, { canvas });
          canvas.setActiveObject(newSelection);
          canvas.requestRenderAll();
          
          // Clear the flag after the operation
          setTimeout(() => {
            canvas._skipSelectionCleared = false;
          }, 0);
          
          // We've handled this shift-group selection
          shiftGroupSelectionInProgress = false;
          return;
        } else {
          // Not using shift, just select this group
          const sel = new fabric.ActiveSelection(grouped, { canvas });
          canvas.setActiveObject(sel);
          canvas.requestRenderAll();
        }
      }
    }
    
    // Reset our flag if we didn't specifically handle a group selection
    shiftGroupSelectionInProgress = false;
  });
  
  // Override Fabric's selection:created event to handle groups in drag selection
  canvas.on('before:selection:cleared', (e) => {
    // Store the previous selection before it's cleared
    canvas._previousSelection = canvas.getActiveObject();
    console.log('Storing previous selection before clearing:', 
      canvas._previousSelection ? 
        (canvas._previousSelection.type === 'activeSelection' ? 
          canvas._previousSelection.getObjects().length + ' objects' : 
          '1 object') : 
        'none');
  });
  
  canvas.on('selection:created', (e) => {
    // Get the current selection
    const selection = e.selected;
    if (!selection || !selection.length) return;
    
    // Check if this is a drag selection (multiple objects)
    if (selection.length > 1) {
      // Find all unique groups that have at least one object selected
      const groupIds = new Set();
      selection.forEach(obj => {
        if (obj.groupId) {
          groupIds.add(obj.groupId);
        }
      });
      
      // If we found groups with partial selection
      if (groupIds.size > 0) {
        const additionalObjects = [];
        
        // For each group, add all its members
        groupIds.forEach(groupId => {
          const groupMembers = canvas.getObjects().filter(o => o.groupId === groupId);
          additionalObjects.push(...groupMembers);
        });
        
        // Create a new merged selection with all objects
        const allObjects = [...new Set([...selection, ...additionalObjects])];
        
        // Replace the current selection with the enhanced one
        if (allObjects.length > selection.length) {
          const newSelection = new fabric.ActiveSelection(allObjects, { canvas });
          canvas.setActiveObject(newSelection);
          canvas.requestRenderAll();
        }
      }
    }
  });

  setTimeout(() => history.initState(), 100);
  return canvas;
}
