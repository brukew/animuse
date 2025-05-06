import { renderAnimationPanel } from "./animationPanel.js";
import { renderInteractionPanel } from "./interactionPanel.js";

export const animationHandlers = {
  birds: animateBirds,
  apples: swayApples,
  fix: fixObjects // New static "animation" that just fixes objects in place
};

/**
 * Sets all provided objects to the same z-index to ensure they move together visually
 * @param {Array} objects - Array of fabric.js objects to set to the same z-index
 * @param {Number} zIndex - Optional specific z-index to use (otherwise uses max of existing z-indices)
 * @returns {Number} - The z-index that was set
 */
export function setObjectsToSameZIndex(objects, zIndex) {
  if (!objects || objects.length === 0) return null;
  
  // If no zIndex provided, use the maximum z-index from the group
  if (zIndex === undefined) {
    zIndex = objects.reduce((max, obj) => {
      const objZIndex = obj.get('zIndex') || 0;
      return Math.max(max, objZIndex);
    }, 0);
  }
  
  // Set all objects to this z-index
  objects.forEach(obj => {
    obj.set('zIndex', zIndex);
  });
  
  return zIndex;
}

export function animate(prompt, canvas, selected, options = {}, { save = true } = {}) {
  const key = Object.keys(animationHandlers).find(k => new RegExp(k, 'i').test(prompt));
  if (!key) return alert('Only birds, apples, or fix are supported.');

  // Debug mode
  const debugMode = options.debugMode || false;
  if (debugMode) {
    console.log("Animate called with options:", options);
  }

  // Ensure all selected objects share the same z-index/creation order
  // First, find the maximum z-index or creation order among selected objects
  let maxZIndex = -Infinity;
  let maxCreationOrder = -Infinity;
  
  selected.forEach(obj => {
    // Track maximum z-index
    const objZIndex = obj.zIndex !== undefined ? obj.zIndex : -Infinity;
    if (objZIndex > maxZIndex) {
      maxZIndex = objZIndex;
    }
    
    // Track maximum creation order
    const creationOrder = obj._creationOrder !== undefined ? obj._creationOrder : -Infinity;
    if (creationOrder > maxCreationOrder) {
      maxCreationOrder = creationOrder;
    }
  });
  
  // Store the group values to pass to animation handlers
  const groupZIndex = maxZIndex !== -Infinity ? maxZIndex : undefined;
  const groupCreationOrder = maxCreationOrder !== -Infinity ? maxCreationOrder : undefined;

  canvas.activeAnimations ||= [];

  const reanimate = options.update && (options.data?.length !== 0);
  let all_changed = false;
  let animId = options.id || `${key}_${Date.now()}`;
  let existingTitle = null;

  if (reanimate) {
    const existingIndex = canvas.activeAnimations.findIndex(a => a.id === options.id);

    if (existingIndex !== -1) {
      const anim = canvas.activeAnimations[existingIndex];
      
      // Create a set of all selected object IDs, including those in the same group
      const selectedIds = new Set();
      
      selected.forEach(obj => {
        // Add the object's ID
        selectedIds.add(obj.id);
        
        // If this is part of a group, also check for other objects in the same group
        if (obj.groupId) {
          const groupId = obj.groupId;
          // Find all objects with this group ID and add their IDs
          selected.forEach(o => {
            if (o.groupId === groupId) {
              selectedIds.add(o.id);
            }
          });
        }
      });
      
      // Filter out data entries for objects that are being reanimated
      const remainingData = anim.data.filter(d => {
        // Check if this data entry is for an object being reanimated
        if (selectedIds.has(d.id)) {
          return false;
        }
        
        // If this is a grouped object, check if its group is being reanimated
        if (d.groupId && selected.some(o => o.groupId === d.groupId)) {
          return false;
        }
        
        return true;
      });

      console.log('Remaining data:', remainingData);

      if (remainingData.length === 0) {
        canvas.activeAnimations.splice(existingIndex, 1);
        all_changed = true;
      } else if (remainingData.length !== anim.data.length) {
        canvas.activeAnimations[existingIndex].data = remainingData;
        canvas.activeAnimations[existingIndex].updatedAt = Date.now(); // Update the modification timestamp
      }

      // reuse ID if full reanimation, otherwise assign new one
      animId = all_changed ? options.id : `${key}_${Date.now()}`;
  
  // If this is a reanimation, preserve the title and customization state from the existing animation
  if (reanimate && !all_changed && existingIndex !== -1) {
    const existingAnimation = canvas.activeAnimations[existingIndex];
    existingTitle = existingAnimation.title;
    // If there was no _titleCustomized flag passed in options, use the existing one
    if (options._titleCustomized === undefined) {
      options._titleCustomized = existingAnimation._titleCustomized;
    }
  }
    }
  }

  const animateFunc = animationHandlers[key];
  
  // Pass the group z-index and creation order to the animation handler
  const animOptions = {
    ...options,
    groupZIndex,
    groupCreationOrder
  };
  
  const result = animateFunc(canvas, selected, animOptions);
  const { objects, data } = result;

  objects.forEach((obj, i) => {
    obj.id ||= fabric.Object.__uidCounter++;
  });

  data.forEach((entry, i) => {
    entry.id ||= objects[i]?.id;
  });

  // Get creation timestamp from the ID or generate a new one
  const createdAt = options.id ? 
    parseInt(options.id.split('_').pop(), 10) || Date.now() : 
    Date.now();
    
  const animationEntry = {
    id: animId,
    type: key,
    name: options.name || `${key} animation`,
    title: options.title || existingTitle || prompt || `${key} animation`, // Preserve title during reanimation
    _titleCustomized: options._titleCustomized || false, // Preserve customization state
    prompt,
    data,
    createdAt,
    updatedAt: Date.now() // Track last modification time
  };

  console.log('Animation entry:', animationEntry);
  console.log('Reanimate:', reanimate);
  console.log('All changed:', all_changed);

  canvas.activeAnimations.push(animationEntry);
  renderAnimationPanel(canvas);
  renderInteractionPanel(canvas);

  if (save && objects.length > 0) {
    setTimeout(() => canvas.history.saveState(), 20);
  }
}


export function animateBirds(canvas, selected, { data = [], debugMode = false, preserveColor = false, preserveZIndex = false, groupZIndex, groupCreationOrder } = {}) {
  // Debug info
  if (debugMode) {
    console.log("animateBirds called with options:", { 
      preserveColor, 
      preserveZIndex, 
      dataLength: data.length,
      selectedObjects: selected.length,
      groupZIndex,
      groupCreationOrder
    });
    console.log("Animation data:", data);
  }
  
  // If we have a group z-index, ensure all birds use it
  const useGroupZIndex = groupZIndex !== undefined;
  // Group objects by groupId
  const groupedObjects = new Map(); // Map of groupId -> objects
  const singleObjects = []; // Objects that are not part of any group
  
  // Categorize objects
  selected.forEach(obj => {
    if (obj.groupId) {
      if (!groupedObjects.has(obj.groupId)) {
        groupedObjects.set(obj.groupId, []);
      }
      groupedObjects.get(obj.groupId).push(obj);
    } else {
      singleObjects.push(obj);
    }
  });
  
  // Calculate positions for all objects (each group will have just one position)
  const positions = [];
  const originalIds = [];
  const zIndices = new Map(); // Store z-index by group or individual object
  
  // Process single objects
  singleObjects.forEach(obj => {
    const pt = obj.getCenterPoint();
    // Preserve the object's z-index
    const zIndex = obj.get('zIndex') || 0;
    zIndices.set(obj.id, zIndex);
    
    positions.push({ 
      x: pt.x, 
      y: pt.y, 
      color: obj.stroke || '#222',
      sourceId: obj.id,
      zIndex: zIndex
    });
    originalIds.push([obj.id]); // Each single object is its own entry
  });
  
  // Process grouped objects - one bird per group
  groupedObjects.forEach((members, groupId) => {
    // Calculate the center of the group
    let centerX = 0, centerY = 0;
    let primaryColor = '#222';
    
    // Set all objects in the group to the same z-index (using max)
    const groupZIndex = setObjectsToSameZIndex(members);
    zIndices.set(groupId, groupZIndex);
    
    members.forEach(obj => {
      const pt = obj.getCenterPoint();
      centerX += pt.x;
      centerY += pt.y;
      // Use the first colored object's stroke as the bird color
      if (obj.stroke && !primaryColor) {
        primaryColor = obj.stroke;
      }
    });
    
    centerX /= members.length;
    centerY /= members.length;
    
    positions.push({
      x: centerX,
      y: centerY,
      color: primaryColor,
      groupId: groupId,
      sourceIds: members.map(obj => obj.id),
      zIndex: groupZIndex
    });
    
    // Store group member IDs for data tracking
    originalIds.push(members.map(obj => obj.id));
  });

  // Remove all original objects
  canvas.discardActiveObject();
  selected.forEach(o => canvas.remove(o));
  canvas.requestRenderAll();

  const birds = [];

  function createBirdAt(x, y, color, positionIndex, zIndex, debugMode = false) {
    // Ensure we have a valid color - this is crucial for correct restoration
    if (!color || color === 'undefined' || color === 'null') {
      if (debugMode) console.warn("Invalid bird color:", color, "using default #222");
      color = '#222'; // Fallback color
    }
    
    const body = new fabric.Polygon(
      [{ x: 0, y: -6 }, { x: 8, y: 0 }, { x: 0, y: 6 }, { x: -8, y: 0 }],
      { fill: color, originX: 'center', originY: 'center' }
    );

    const wingL = new fabric.Triangle({ width: 14, height: 6, fill: color, left: -4, angle: -20, originX: 'center', originY: 'center' });
    const wingR = new fabric.Triangle({ width: 14, height: 6, fill: color, left: 4, angle: 200, originX: 'center', originY: 'center' });

    const padding = new fabric.Rect({
      width: 40,
      height: 40,
      fill: 'rgba(0,0,0,0)',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false
    });

    // Get the position data
    const position = positions[positionIndex];
    
    // Use provided zIndex or get from position or default to 0
    zIndex = zIndex !== undefined ? zIndex : (position.zIndex || 0);

    // Create bird with consistent group z-index/creation order
    const birdOptions = {
      left: x,
      top: y,
      originX: 'center',
      originY: 'center',
      selectable: true,
      hasControls: false,
      hoverCursor: 'pointer'
    };
    
    // Apply z-index if it was specified
    if (zIndex !== undefined) {
      birdOptions.zIndex = zIndex;
    }
    
    // Apply group creation order if available
    if (groupCreationOrder !== undefined) {
      birdOptions._creationOrder = groupCreationOrder;
    }
    
    const bird = new fabric.Group([padding, body, wingL, wingR], birdOptions);

    bird.isAnimated = true;
    bird.animationType = 'bird';
    bird.originalLeft = x;
    bird.originalTop = y;
    
    // Store the intended color for debug/verification
    bird._debugColor = color;
    bird._debugZIndex = zIndex;
    
    // Store source object information
    if (position.groupId) {
      bird.groupId = position.groupId;
      bird.memberIds = position.sourceIds;
      bird.isGroupRepresentative = true;
    }

    if (debugMode) {
      console.log(`Bird created at (${x}, ${y}) - Color: ${color}, Z-index: ${zIndex}`);
      
      // Verify bird components have the right color
      const verifyBody = bird.getObjects().find(o => o.type === 'polygon');
      const verifyWings = bird.getObjects().filter(o => o.type === 'triangle');
      
      console.log("Bird components - Body fill:", verifyBody ? verifyBody.fill : 'none', 
                 "Wing fills:", verifyWings.map(w => w.fill),
                 "Z-index:", bird.get('zIndex'));
                 
      if (verifyBody && verifyBody.fill !== color) {
        console.warn("Color mismatch! Expected:", color, "Got:", verifyBody.fill);
      }
      
      if (bird.get('zIndex') !== zIndex) {
        console.warn("Z-index mismatch! Expected:", zIndex, "Got:", bird.get('zIndex'));
      }
    }

    canvas.add(bird);
    bird.setCoords();

    gsap.to([wingL, wingR], {
      angle: '+=40',
      duration: 0.3,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
      stagger: { each: 0.05 },
      onUpdate: canvas.requestRenderAll.bind(canvas)
    });

    return bird;
  }

  positions.forEach((p, i) => {
    // Get the correct color - favor data entries if available
    let color = '#222'; // Default color
    
    // Use color from data if available
    if (data[i] && data[i].color) {
      color = data[i].color;
    } 
    // Otherwise use color from position
    else if (p.color) {
      color = p.color;
    }
    
    // Get z-index - use this priority order:
    // 1. Explicit data z-index from history
    // 2. Group z-index if available (to ensure all animated objects are on same layer)
    // 3. Original position z-index
    // 4. Let canvas assign based on creation order
    let zIndex;
    if (data[i]?.zIndex !== undefined) {
      // Use z-index from history data
      zIndex = data[i].zIndex;
    } else if (useGroupZIndex) {
      // Use the shared group z-index for consistent layering
      zIndex = groupZIndex;
    } else if (p.zIndex !== undefined) {
      // Use position z-index
      zIndex = p.zIndex;
    }
    
    if (debugMode) {
      console.log(`Creating bird ${i}:`, {
        positionColor: p.color,
        dataColor: data[i]?.color,
        finalColor: color,
        positionZIndex: p.zIndex,
        dataZIndex: data[i]?.zIndex,
        finalZIndex: zIndex
      });
    }
    
    const bird = createBirdAt(p.x, p.y, color, i, zIndex, debugMode);
    birds.push(bird);
  });

  function setupFlocking(birds) {
    const vel = birds.map(() => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 }));

    const NEIGHBOR = 60;
    const MAX_SPEED = 2.5;
    const ALIGN_W = 0.05, COH_W = 0.02, SEP_W = 0.1;
    const BOUNDS = { w: canvas.getWidth(), h: canvas.getHeight() };

    function limit(v) {
      const m = Math.hypot(v.x, v.y);
      if (m > MAX_SPEED) {
        v.x = (v.x / m) * MAX_SPEED;
        v.y = (v.y / m) * MAX_SPEED;
      }
    }

    // Store velocities on the birds to reference later
    birds.forEach((b, i) => {
      b._velocity = vel[i];
    });

    // Store the interactions module once it's loaded
    let interactionsModule = null;
    
    // Try to load the interactions module immediately
    import('./animationInteractions.js').then(module => {
      interactionsModule = module;
    }).catch(err => {
      console.error("Failed to load animation interactions module:", err);
    });
    
    function update() {
      birds.forEach((b, i) => {
        let ax = 0, ay = 0, cx = 0, cy = 0, sx = 0, sy = 0, cnt = 0;

        birds.forEach((o, j) => {
          if (i === j) return;
          const dx = o.left - b.left;
          const dy = o.top - b.top;
          const d = Math.hypot(dx, dy);
          if (d < NEIGHBOR) {
            ax += vel[j].x; ay += vel[j].y;
            cx += o.left; cy += o.top;
            sx -= dx / d; sy -= dy / d;
            cnt++;
          }
        });

        if (cnt) {
          ax /= cnt; ay /= cnt;
          cx = cx / cnt - b.left;
          cy = cy / cnt - b.top;
        }

        vel[i].x += ax * ALIGN_W + cx * COH_W + sx * SEP_W;
        vel[i].y += ay * ALIGN_W + cy * COH_W + sy * SEP_W;
        
        // Store the flocking velocity before applying boundary checks
        b._flockingVelocity = { x: vel[i].x, y: vel[i].y };
        
        // Check if the bird will hit a boundary in the next frame
        if (interactionsModule && canvas.animationInteractions && canvas.animationInteractions.length > 0) {
          // Apply boundary checks using a prediction of where the bird will be
          const predictedPosition = {
            left: b.left + vel[i].x,
            top: b.top + vel[i].y
          };
          
          // Store current position so the interaction module can check if bird is moving toward object
          b._currentPosition = { left: b.left, top: b.top };
          
          // Pass the bird and its velocity to the interaction module for boundary checking
          interactionsModule.predictAndProcessAvoidance(canvas, b, vel[i]);
        }
        
        limit(vel[i]);

        b.left += vel[i].x;
        b.top += vel[i].y;
        if (b.left < 0 || b.left > BOUNDS.w) {
          vel[i].x *= -1;
          b.left = Math.max(0, Math.min(BOUNDS.w, b.left));
        }
        if (b.top < 0 || b.top > BOUNDS.h) {
          vel[i].y *= -1;
          b.top = Math.max(0, Math.min(BOUNDS.h, b.top));
        }

        b.angle = Math.atan2(vel[i].y, vel[i].x) * 180 / Math.PI;
        b.setCoords();
      });

      canvas.requestRenderAll();
    }
    
    // Fallback function if the module import fails
    function updateWithoutInteractions() {
      birds.forEach((b, i) => {
        let ax = 0, ay = 0, cx = 0, cy = 0, sx = 0, sy = 0, cnt = 0;

        birds.forEach((o, j) => {
          if (i === j) return;
          const dx = o.left - b.left;
          const dy = o.top - b.top;
          const d = Math.hypot(dx, dy);
          if (d < NEIGHBOR) {
            ax += vel[j].x; ay += vel[j].y;
            cx += o.left; cy += o.top;
            sx -= dx / d; sy -= dy / d;
            cnt++;
          }
        });

        if (cnt) {
          ax /= cnt; ay /= cnt;
          cx = cx / cnt - b.left;
          cy = cy / cnt - b.top;
        }

        vel[i].x += ax * ALIGN_W + cx * COH_W + sx * SEP_W;
        vel[i].y += ay * ALIGN_W + cy * COH_W + sy * SEP_W;
        limit(vel[i]);

        b.left += vel[i].x;
        b.top += vel[i].y;
        if (b.left < 0 || b.left > BOUNDS.w) {
          vel[i].x *= -1;
          b.left = Math.max(0, Math.min(BOUNDS.w, b.left));
        }
        if (b.top < 0 || b.top > BOUNDS.h) {
          vel[i].y *= -1;
          b.top = Math.max(0, Math.min(BOUNDS.h, b.top));
        }

        b.angle = Math.atan2(vel[i].y, vel[i].x) * 180 / Math.PI;
        b.setCoords();
      });

      canvas.requestRenderAll();
    }

    gsap.ticker.add(update);

    birds.forEach(b => {
      // Create the tween object with custom pause/resume methods
      b.tween = {
        // Standard pause/resume for the ticker
        pause: () => gsap.ticker.remove(update),
        resume: () => gsap.ticker.add(update),
        
        // Custom pause/resume with state preservation
        customPause: function() {
          // Save the current state
          b._pausedState = {
            left: b.left,
            top: b.top,
            angle: b.angle,
            originalLeft: b.originalLeft,
            originalTop: b.originalTop
          };
          
          // Reset the manually moved flag
          b._manuallyMoved = false;
          
          // Call the standard pause
          this.pause();
        },
        
        customResume: function() {
          // Restore state if it was saved
          if (b._pausedState) {
            // If the bird was manually moved while paused
            if (b._manuallyMoved) {
              // Update the original position to the current position
              b.originalLeft = b.left;
              b.originalTop = b.top;
              
              // We need to recreate the flocking behavior for this bird
              // But we won't implement that here since it would require
              // rewriting the flocking algorithm
              
              // For now, just allow the bird to continue from its new position
              b.setCoords();
            } else {
              // Normal restore if not manually moved
              b.left = b._pausedState.left;
              b.top = b._pausedState.top;
              b.angle = b._pausedState.angle;
              b.originalLeft = b._pausedState.originalLeft;
              b.originalTop = b._pausedState.originalTop;
              b.setCoords();
            }
            
            // Clear the paused state and manual move flag
            delete b._pausedState;
            delete b._manuallyMoved;
          }
          
          // Call the standard resume
          this.resume();
        }
      };
    });
  }

  setupFlocking(birds);
  
  // Make sure all birds have the intended z-index applied
  birds.forEach(bird => {
    // Update render order if needed
    if (bird._debugZIndex !== undefined && bird.get('zIndex') !== bird._debugZIndex) {
      bird.set('zIndex', bird._debugZIndex);
    }
  });
  
  // Make sure canvas sorts objects by z-index
  canvas._objects.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  
  // Create data entries for each bird
  const birdData = birds.map((bird, i) => {
    // Get the body element to extract the actual color
    const body = bird.getObjects().find(o => o.type === 'polygon');
    const actualColor = body ? body.fill : (positions[i].color || '#222');
    
    const dataEntry = {
      id: bird.id,
      color: actualColor, // Use the actual body color, not the group's fill
      zIndex: bird.get('zIndex') || 0 // Store the z-index for history
    };
    
    // If this is a group representation, include the member info
    if (bird.isGroupRepresentative) {
      dataEntry.isGroup = true;
      dataEntry.groupId = bird.groupId;
      dataEntry.memberIds = bird.memberIds;
    }
    
    return dataEntry;
  });
  
  const result = {
    objects: birds,
    data: birdData
  };
  
  if (debugMode) {
    console.log("Final bird animation data:", birdData);
    
    // Verify each bird has the right color stored in its data
    birds.forEach((bird, i) => {
      const dataEntry = birdData[i];
      
      const body = bird.getObjects().find(o => o.type === 'polygon');
      const bodyColor = body ? body.fill : null;
      
      console.log(`Bird ${i} - Data color: ${dataEntry.color}, Actual body color: ${bodyColor}, Z-index in data: ${dataEntry.zIndex}, Actual z-index: ${bird.get('zIndex')}`);
      
      if (dataEntry.color !== bodyColor) {
        console.warn(`Bird ${i} color mismatch!`);
      }
      
      if (dataEntry.zIndex !== bird.get('zIndex')) {
        console.warn(`Bird ${i} z-index mismatch!`);
      }
    });
  }
  
  return result;
}

export function swayApples(canvas, objs, { data = [], debugMode = false, preserveColor = false, preserveZIndex = false, groupZIndex, groupCreationOrder } = {}) {
  // Debug info
  if (debugMode) {
    console.log("swayApples called with options:", { 
      preserveColor, 
      preserveZIndex, 
      dataLength: data.length,
      selectedObjects: objs.length,
      groupZIndex,
      groupCreationOrder
    });
    console.log("Animation data:", data);
  }
  
  // If we have a group z-index, ensure all apples use it
  const useGroupZIndex = groupZIndex !== undefined;
  const drift = 10;
  const rock = 8;
  const dur = 1.2;

  canvas.discardActiveObject();
  
  // Group objects by their groupId
  const groupedObjects = new Map(); // Map of groupId -> objects
  const singleObjects = []; // Objects that are not part of any group
  const animatedObjects = []; // Objects that will be animated
  const processedData = []; // Data for animation tracking
  const zIndices = new Map(); // Store z-index by group or individual object
  
  // First, categorize objects into groups or singles
  objs.forEach(obj => {
    if (obj.groupId) {
      if (!groupedObjects.has(obj.groupId)) {
        groupedObjects.set(obj.groupId, []);
      }
      groupedObjects.get(obj.groupId).push(obj);
    } else {
      singleObjects.push(obj);
    }
  });
  
  // Handle single objects (not in groups)
  singleObjects.forEach(obj => {
    const { x, y } = obj.getCenterPoint();
    
    // Determine z-index to use, with priority:
    // 1. Data z-index from history
    // 2. Group z-index if available 
    // 3. Original object z-index
    let zIndex;
    const dataItem = data.find(d => d.id === obj.id);
    
    if (dataItem && dataItem.zIndex !== undefined) {
      // Use z-index from history data
      zIndex = dataItem.zIndex;
    } else if (useGroupZIndex) {
      // Use the shared group z-index
      zIndex = groupZIndex;
    } else {
      // Use the object's existing z-index
      zIndex = obj.get('zIndex');
    }
    
    // Store for data tracking
    zIndices.set(obj.id, zIndex);
    
    // Apply settings including z-index
    const appleOptions = {
      originX: 'center',
      originY: 'center',
      left: x,
      top: y,
      selectable: true
    };
    
    // Apply z-index if defined
    if (zIndex !== undefined) {
      appleOptions.zIndex = zIndex;
    }
    
    // Apply group creation order if defined
    if (groupCreationOrder !== undefined) {
      appleOptions._creationOrder = groupCreationOrder;
    }
    
    obj.set(appleOptions);

    obj.isAnimated = true;
    obj.animationType = 'apple';
    obj.originalLeft = x;
    obj.swayX = 0;
    obj.swayAngle = 0;

    // Create a better tween handling that saves state on pause
    const updateFn = () => {
      // Only update if the animation is running (not being dragged)
      if (!obj.dragging) {
        obj.set('left', obj.originalLeft + obj.swayX);
        obj.set('angle', obj.swayAngle);
        obj.setCoords();
        canvas.requestRenderAll();
      }
    };
    
    const tween = gsap.to(obj, {
      swayX: `+=${drift}`,
      swayAngle: `+=${rock}`,
      duration: dur,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
      onUpdate: updateFn
    });
    
    // Create custom pause/resume methods
    tween.customPause = function() {
      this.pause();
      // Save the current state when paused
      obj._pausedState = {
        left: obj.left,
        originalLeft: obj.originalLeft,
        angle: obj.angle,
        swayX: obj.swayX,
        swayAngle: obj.swayAngle,
        zIndex: obj.get('zIndex') // Also save z-index
      };
      // Reset the manually moved flag
      obj._manuallyMoved = false;
    };
    
    tween.customResume = function() {
      // Restore state if it was saved
      if (obj._pausedState) {
        // If the object was manually moved while paused, we don't want to
        // restore the old position, just update the animation parameters
        if (obj._manuallyMoved) {
          // Keep the current position but reset animation parameters
          obj.swayX = 0;
          obj.swayAngle = 0;
          // Important: Update the original position to the current position
          obj.originalLeft = obj.left;
          if (obj.originalTop !== undefined) {
            obj.originalTop = obj.top;
          }
          // Force immediate update of position in the GSAP animation
          gsap.set(obj, { swayX: 0, swayAngle: 0 });
          // Ensure the animation uses the new origin point
          this.kill(); // Kill the old tween
          // Create a new tween with the updated position
          const newTween = gsap.to(obj, {
            swayX: `+=${drift}`,
            swayAngle: `+=${rock}`,
            duration: dur,
            yoyo: true,
            repeat: -1,
            ease: 'sine.inOut',
            onUpdate: updateFn
          });
          // Replace the old tween with the new one
          obj.tween = newTween;
          // Copy custom methods to the new tween
          newTween.customPause = this.customPause;
          newTween.customResume = this.customResume;
          obj.setCoords();
        } else {
          // Normal restore if not manually moved
          obj.originalLeft = obj._pausedState.originalLeft;
          obj.left = obj._pausedState.left;
          obj.angle = obj._pausedState.angle;
          obj.swayX = obj._pausedState.swayX;
          obj.swayAngle = obj._pausedState.swayAngle;
          // Restore z-index if it was saved
          if (obj._pausedState.zIndex !== undefined) {
            obj.set('zIndex', obj._pausedState.zIndex);
          }
          obj.setCoords();
          this.resume();
        }
        
        // Clear the paused state and manual move flag
        delete obj._pausedState;
        delete obj._manuallyMoved;
      } else {
        this.resume();
      }
    };

    obj.tween = tween;
    animatedObjects.push(obj);
    
    // Add data entry for single object with z-index
    processedData.push({
      id: obj.id,
      zIndex: zIndex
    });
  });
  
  // Handle grouped objects - treat each group as one unit
  groupedObjects.forEach((groupMembers, groupId) => {
    // Calculate the center of the group
    let centerX = 0, centerY = 0;
    
    // Determine z-index to use, with priority:
    // 1. Explicit data z-index from history
    // 2. Group-level z-index (passed from animation function)
    // 3. Calculate max z-index from group members
    // 4. Let canvas assign based on creation order
    let thisGroupZIndex;
    
    // Look for data entry for this group
    const groupDataEntry = data.find(d => d.groupId === groupId);
    
    if (groupDataEntry && groupDataEntry.zIndex !== undefined) {
      // Use z-index from history data
      thisGroupZIndex = groupDataEntry.zIndex;
    } else if (useGroupZIndex) {
      // Use the shared animation group z-index
      thisGroupZIndex = groupZIndex;
    } else {
      // Calculate max z-index from members
      thisGroupZIndex = setObjectsToSameZIndex(groupMembers);
    }
    
    // Store the z-index for data tracking
    zIndices.set(groupId, thisGroupZIndex);
    
    // Calculate center position
    groupMembers.forEach(obj => {
      const point = obj.getCenterPoint();
      centerX += point.x;
      centerY += point.y;
    });
    centerX /= groupMembers.length;
    centerY /= groupMembers.length;
    
    // Create group options 
    const groupOptions = {
      left: centerX,
      top: centerY,
      originX: 'center',
      originY: 'center',
      selectable: true
    };
    
    // Apply z-index if defined
    if (thisGroupZIndex !== undefined) {
      groupOptions.zIndex = thisGroupZIndex;
    }
    
    // Apply creation order if available
    if (groupCreationOrder !== undefined) {
      groupOptions._creationOrder = groupCreationOrder;
    }
    
    // Create a Fabric.js Group from the objects
    const fabricGroup = new fabric.Group(groupMembers, groupOptions);
    
    // Remove original objects from canvas
    groupMembers.forEach(obj => canvas.remove(obj));
    
    // Add group properties for animation
    fabricGroup.isAnimated = true;
    fabricGroup.animationType = 'apple';
    fabricGroup.originalLeft = centerX;
    fabricGroup.swayX = 0;
    fabricGroup.swayAngle = 0;
    fabricGroup.groupId = groupId;
    fabricGroup.memberIds = groupMembers.map(obj => obj.id);
    
    // Animate the group as a single unit
    // Create a better tween handling that saves state on pause for groups
    const updateFn = () => {
      // Only update if the group is not being dragged
      if (!fabricGroup.dragging) {
        fabricGroup.set('left', fabricGroup.originalLeft + fabricGroup.swayX);
        fabricGroup.set('angle', fabricGroup.swayAngle);
        fabricGroup.setCoords();
        canvas.requestRenderAll();
      }
    };
    
    const tween = gsap.to(fabricGroup, {
      swayX: `+=${drift}`,
      swayAngle: `+=${rock}`,
      duration: dur,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
      onUpdate: updateFn
    });
    
    // Create custom pause/resume methods for groups
    tween.customPause = function() {
      this.pause();
      // Save the current state when paused
      fabricGroup._pausedState = {
        left: fabricGroup.left,
        originalLeft: fabricGroup.originalLeft,
        angle: fabricGroup.angle,
        swayX: fabricGroup.swayX,
        swayAngle: fabricGroup.swayAngle,
        zIndex: fabricGroup.get('zIndex') // Save z-index
      };
      // Reset the manually moved flag
      fabricGroup._manuallyMoved = false;
    };
    
    tween.customResume = function() {
      // Restore state if it was saved
      if (fabricGroup._pausedState) {
        // If the group was manually moved while paused
        if (fabricGroup._manuallyMoved) {
          // Keep the current position but reset animation parameters
          fabricGroup.swayX = 0;
          fabricGroup.swayAngle = 0;
          // Update the original position to the current position
          fabricGroup.originalLeft = fabricGroup.left;
          if (fabricGroup.originalTop !== undefined) {
            fabricGroup.originalTop = fabricGroup.top;
          }
          // Force immediate update of position in the GSAP animation
          gsap.set(fabricGroup, { swayX: 0, swayAngle: 0 });
          // Ensure the animation uses the new origin point
          this.kill(); // Kill the old tween
          // Create a new tween with the updated position
          const newTween = gsap.to(fabricGroup, {
            swayX: `+=${drift}`,
            swayAngle: `+=${rock}`,
            duration: dur,
            yoyo: true,
            repeat: -1,
            ease: 'sine.inOut',
            onUpdate: updateFn
          });
          // Replace the old tween with the new one
          fabricGroup.tween = newTween;
          // Copy custom methods to the new tween
          newTween.customPause = this.customPause;
          newTween.customResume = this.customResume;
          fabricGroup.setCoords();
        } else {
          // Normal restore if not manually moved
          fabricGroup.originalLeft = fabricGroup._pausedState.originalLeft;
          fabricGroup.left = fabricGroup._pausedState.left;
          fabricGroup.angle = fabricGroup._pausedState.angle;
          fabricGroup.swayX = fabricGroup._pausedState.swayX;
          fabricGroup.swayAngle = fabricGroup._pausedState.swayAngle;
          // Restore z-index if it was saved
          if (fabricGroup._pausedState.zIndex !== undefined) {
            fabricGroup.set('zIndex', fabricGroup._pausedState.zIndex);
          }
          fabricGroup.setCoords();
          this.resume();
        }
        // Clear the paused state and manual move flag
        delete fabricGroup._pausedState;
        delete fabricGroup._manuallyMoved;
      } else {
        this.resume();
      }
    };
    
    fabricGroup.tween = tween;
    
    // Add the group to the canvas
    canvas.add(fabricGroup);
    fabricGroup.setCoords();
    
    animatedObjects.push(fabricGroup);
    
    // Add data entry for the group
    processedData.push({
      id: fabricGroup.id ||= fabric.Object.__uidCounter++,
      isGroup: true,
      groupId: groupId,
      memberIds: fabricGroup.memberIds,
      zIndex: fabricGroup.get('zIndex') || groupZIndex || 0 // Include z-index in data
    });
  });

  // Make sure canvas sorts objects by z-index
  canvas._objects.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  
  // Add debug info
  if (debugMode) {
    console.log("Final apple animation data:", processedData);
    console.log("Apple objects z-indices:", animatedObjects.map(o => o.get('zIndex')));
  }
  
  return {
    objects: animatedObjects,
    data: processedData
  };
}

/**
 * "Fix" animation that doesn't actually animate anything,
 * but allows objects to be managed in the interaction panel
 * @param {Object} canvas - The fabric canvas
 * @param {Array} objs - Selected objects to fix
 * @param {Object} options - Animation options
 * @returns {Object} Animation data
 */
export function fixObjects(canvas, objs, { data = [], debugMode = false, preserveZIndex = false, groupZIndex, groupCreationOrder } = {}) {
  if (debugMode) {
    console.log("fixObjects called with options:", { 
      preserveZIndex, 
      groupZIndex,
      groupCreationOrder,
      dataLength: data.length,
      selectedObjects: objs.length
    });
  }

  // Group objects by their groupId
  const groupedObjects = new Map(); // Map of groupId -> objects
  const singleObjects = []; // Objects that are not part of any group
  const fixedObjects = []; // Objects that will be in the animation
  const processedData = []; // Data for animation tracking
  const zIndices = new Map(); // Store z-index by group or individual object
  
  // First, categorize objects into groups or singles
  objs.forEach(obj => {
    if (obj.groupId) {
      if (!groupedObjects.has(obj.groupId)) {
        groupedObjects.set(obj.groupId, []);
      }
      groupedObjects.get(obj.groupId).push(obj);
    } else {
      singleObjects.push(obj);
    }
  });
  
  // Handle single objects
  singleObjects.forEach(obj => {
    // Determine z-index to use
    let zIndex;
    const dataItem = data.find(d => d.id === obj.id);
    
    if (dataItem && dataItem.zIndex !== undefined) {
      // Use z-index from history data
      zIndex = dataItem.zIndex;
    } else if (groupZIndex !== undefined) {
      // Use the shared group z-index
      zIndex = groupZIndex;
    } else {
      // Use the object's existing z-index
      zIndex = obj.get('zIndex');
    }
    
    // Store for data tracking
    zIndices.set(obj.id, zIndex);
    
    // Apply z-index if defined
    if (zIndex !== undefined) {
      obj.set('zIndex', zIndex);
    }
    
    // Apply group creation order if defined
    if (groupCreationOrder !== undefined) {
      obj._creationOrder = groupCreationOrder;
    }
    
    // Mark as "fixed" animation
    obj.isAnimated = true;
    obj.animationType = 'fix';
    
    // Create a dummy tween that does nothing
    // This ensures compatibility with code that expects a tween object
    const dummyTween = {
      pause: () => {},
      resume: () => {},
      customPause: function() {
        // Save the state but don't actually pause anything
        obj._pausedState = {
          zIndex: obj.get('zIndex')
        };
      },
      customResume: function() {
        // Restore state if it was saved
        if (obj._pausedState) {
          // Restore z-index if it was saved
          if (obj._pausedState.zIndex !== undefined) {
            obj.set('zIndex', obj._pausedState.zIndex);
          }
          delete obj._pausedState;
        }
      }
    };
    
    obj.tween = dummyTween;
    fixedObjects.push(obj);
    
    // Add data entry
    processedData.push({
      id: obj.id,
      zIndex: zIndex
    });
  });
  
  // Handle grouped objects - keep them grouped
  groupedObjects.forEach((groupMembers, groupId) => {
    // Determine z-index to use
    let groupZIndexValue;
    const groupDataEntry = data.find(d => d.groupId === groupId);
    
    if (groupDataEntry && groupDataEntry.zIndex !== undefined) {
      // Use z-index from history data
      groupZIndexValue = groupDataEntry.zIndex;
    } else if (groupZIndex !== undefined) {
      // Use the shared animation group z-index
      groupZIndexValue = groupZIndex;
    } else {
      // Calculate max z-index from members
      groupZIndexValue = setObjectsToSameZIndex(groupMembers);
    }
    
    // Store the z-index for data tracking
    zIndices.set(groupId, groupZIndexValue);
    
    // Apply the same z-index to all group members
    groupMembers.forEach(obj => {
      obj.set('zIndex', groupZIndexValue);
      
      // Mark as "fixed" animation
      obj.isAnimated = true;
      obj.animationType = 'fix';
      
      // Create a dummy tween
      const dummyTween = {
        pause: () => {},
        resume: () => {},
        customPause: function() {
          obj._pausedState = {
            zIndex: obj.get('zIndex')
          };
        },
        customResume: function() {
          if (obj._pausedState) {
            if (obj._pausedState.zIndex !== undefined) {
              obj.set('zIndex', obj._pausedState.zIndex);
            }
            delete obj._pausedState;
          }
        }
      };
      
      obj.tween = dummyTween;
    });
    
    // Add all group members to fixedObjects
    fixedObjects.push(...groupMembers);
    
    // Add a group data entry
    processedData.push({
      isGroup: true,
      groupId: groupId,
      memberIds: groupMembers.map(obj => obj.id),
      zIndex: groupZIndexValue
    });
  });
  
  // Make sure canvas objects are sorted by z-index
  canvas._objects.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  
  // Return the fixed objects and data
  return {
    objects: fixedObjects,
    data: processedData
  };
}
