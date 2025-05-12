/**
 * Gets the maximum z-index for a given animation
 * @param {Object} anim - The animation object
 * @returns {Number} - The maximum z-index found
 */
function getAnimationZIndex(anim) {
  let maxZ = -Infinity;
  if (anim.data && Array.isArray(anim.data)) {
    anim.data.forEach(d => {
      if (d.zIndex !== undefined && d.zIndex > maxZ) {
        maxZ = d.zIndex;
      }
    });
  }
  return maxZ !== -Infinity ? maxZ : 0;
}

/**
 * Creates an entry for an animation in the interaction panel
 * @param {Object} anim - The animation object
 * @param {Object} canvas - The fabric.js canvas object
 * @returns {HTMLElement} - The created entry element
 */
function createInteractionEntry(anim, canvas) {
  const entry = document.createElement('div');
  entry.className = 'interaction-entry';
  entry.dataset.id = anim.id;
  
  // Store the z-index for drag and drop operations
  entry.dataset.zIndex = getAnimationZIndex(anim);
  
  // Create simple layout with just title and buttons
  const title = document.createElement('div');
  title.className = 'animation-title';
  title.textContent = anim.title || anim.prompt || `(${anim.type})`;
  
  // Add layer control buttons
  const controls = document.createElement('div');
  controls.className = 'layer-controls';
  
  // Move Up/Down buttons
  const moveUpBtn = document.createElement('button');
  moveUpBtn.textContent = '↑';
  moveUpBtn.title = 'Move Up';
  moveUpBtn.className = 'move-up-btn';
  
  const moveDownBtn = document.createElement('button');
  moveDownBtn.textContent = '↓';
  moveDownBtn.title = 'Move Down';
  moveDownBtn.className = 'move-down-btn';
  
  // Send to Front/Back buttons
  const frontBtn = document.createElement('button');
  frontBtn.textContent = 'Front';
  frontBtn.title = 'Send to Front';
  frontBtn.className = 'front-btn';
  
  const backBtn = document.createElement('button');
  backBtn.textContent = 'Back';
  backBtn.title = 'Send to Back';
  backBtn.className = 'back-btn';
  
  // Add the elements to the entry
  controls.append(frontBtn, moveUpBtn, moveDownBtn, backBtn);
  entry.append(title, controls);
  
  // Setup drag and drop functionality
  entry.draggable = true;
  
  // Handle drag start
  entry.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', anim.id);
    e.dataTransfer.effectAllowed = 'move';
    
    // Wait a bit before adding the dragging class (for better visual feedback)
    setTimeout(() => {
      entry.classList.add('dragging');
    }, 0);
  });
  
  // Handle drag end
  entry.addEventListener('dragend', () => {
    entry.classList.remove('dragging');
    
    // Remove all drag-over classes
    document.querySelectorAll('.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });
  });
  
  // Find all objects for this animation
  const getAnimationObjects = () => {
    const objectIds = new Set();
    anim.data.forEach(d => objectIds.add(d.id));
    return canvas.getObjects().filter(o => objectIds.has(o.id));
  };
  
  // Get the highest z-index from all objects on canvas
  const getMaxZIndexOnCanvas = () => {
    if (!canvas.getObjects().length) return 0;
    return canvas.getObjects().reduce((max, obj) => {
      return Math.max(max, obj.get('zIndex') || 0);
    }, 0);
  };
  
  // Get the lowest z-index from all objects on canvas
  const getMinZIndexOnCanvas = () => {
    if (!canvas.getObjects().length) return 0;
    return canvas.getObjects().reduce((min, obj) => {
      const z = obj.get('zIndex');
      return z !== undefined ? Math.min(min, z) : min;
    }, Infinity) || 0;
  };
  
  // Update and refresh after making z-index changes
  const finishZIndexUpdate = () => {
    // Resort canvas objects
    canvas._objects.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    canvas.requestRenderAll();
    
    // Save to history
    setTimeout(() => canvas.history.saveState(), 20);
    
    // Refresh the panel
    renderInteractionPanel(canvas);
  };
  
  // Send to Front
  frontBtn.addEventListener('click', () => {
    const objects = getAnimationObjects();
    if (!objects.length) return;
    
    // Get the maximum z-index on canvas and add 1
    const newZIndex = getMaxZIndexOnCanvas() + 1;
    
    // Update all objects in this animation to be on top
    objects.forEach(obj => {
      obj.set('zIndex', newZIndex);
      
      // Update the data entry
      const dataEntry = anim.data.find(d => d.id === obj.id);
      if (dataEntry) {
        dataEntry.zIndex = newZIndex;
      }
    });
    
    finishZIndexUpdate();
  });
  
  // Send to Back
  backBtn.addEventListener('click', () => {
    const objects = getAnimationObjects();
    if (!objects.length) return;
    
    // Get the minimum z-index on canvas and subtract 1, but don't go below 0
    const minZ = getMinZIndexOnCanvas();
    const newZIndex = Math.max(0, minZ - 1);
    
    // Update all objects in this animation to be at the back
    objects.forEach(obj => {
      obj.set('zIndex', newZIndex);
      
      // Update the data entry
      const dataEntry = anim.data.find(d => d.id === obj.id);
      if (dataEntry) {
        dataEntry.zIndex = newZIndex;
      }
    });
    
    finishZIndexUpdate();
  });
  
  // Move Up one step
  moveUpBtn.addEventListener('click', () => {
    const objects = getAnimationObjects();
    if (!objects.length) return;
    
    // Increase all z-indices by 1
    objects.forEach(obj => {
      const currentZ = obj.get('zIndex') || 0;
      obj.set('zIndex', currentZ + 1);
      
      // Update the data entry
      const dataEntry = anim.data.find(d => d.id === obj.id);
      if (dataEntry) {
        dataEntry.zIndex = currentZ + 1;
      }
    });
    
    finishZIndexUpdate();
  });
  
  // Move Down one step
  moveDownBtn.addEventListener('click', () => {
    const objects = getAnimationObjects();
    if (!objects.length) return;
    
    // Decrease all z-indices by 1, but not below 0
    objects.forEach(obj => {
      const currentZ = obj.get('zIndex') || 0;
      const newZ = Math.max(0, currentZ - 1);
      obj.set('zIndex', newZ);
      
      // Update the data entry
      const dataEntry = anim.data.find(d => d.id === obj.id);
      if (dataEntry) {
        dataEntry.zIndex = newZ;
      }
    });
    
    finishZIndexUpdate();
  });
  
  return entry;
}

/**
 * Sorts animations by their z-index
 * @param {Array} animations - Array of animation objects
 * @returns {Array} - Sorted array of animations
 */
function sortAnimationsByZIndex(animations) {
  if (!animations || animations.length === 0) return [];
  
  return [...animations].sort((a, b) => {
    // Calculate the max z-index for each animation
    const getMaxZIndex = (anim) => {
      let maxZ = -Infinity;
      anim.data.forEach(d => {
        if (d.zIndex !== undefined && d.zIndex > maxZ) {
          maxZ = d.zIndex;
        }
      });
      return maxZ !== -Infinity ? maxZ : 0;
    };
    
    const aZIndex = getMaxZIndex(a);
    const bZIndex = getMaxZIndex(b);
    
    // Sort by z-index (descending, so higher z-index comes first/top)
    return bZIndex - aZIndex;
  });
}

/**
 * Updates z-indices for all objects in an animation
 * @param {Object} anim - The animation to update
 * @param {Number} newZIndex - The new z-index to apply
 * @param {Object} canvas - The fabric.js canvas
 */
function updateAnimationZIndex(anim, newZIndex, canvas) {
  if (!anim || !anim.data || !Array.isArray(anim.data)) return;
  
  // Find all objects for this animation
  const objectIds = new Set();
  anim.data.forEach(d => objectIds.add(d.id));
  
  // Find matching objects on canvas
  const objects = canvas.getObjects().filter(o => objectIds.has(o.id));
  
  // Update z-index for all objects
  objects.forEach(obj => {
    obj.set('zIndex', newZIndex);
    
    // Update the data entry
    const dataEntry = anim.data.find(d => d.id === obj.id);
    if (dataEntry) {
      dataEntry.zIndex = newZIndex;
    }
  });
}

/**
 * Rearranges z-indices to accommodate a drag and drop operation
 * @param {Array} animations - All animations
 * @param {String} sourceId - ID of the animation being moved
 * @param {String} targetId - ID of the animation being dropped onto
 * @param {Boolean} isBeforeTarget - Whether to place source before or after target
 * @param {Object} canvas - The fabric.js canvas
 * @returns {Boolean} - Whether the operation was successful
 */
function rearrangeZIndices(animations, sourceId, targetId, isBeforeTarget, canvas) {
  if (!animations || !sourceId || !targetId) return false;
  
  // Get the animations by ID
  const sourceAnim = animations.find(a => a.id === sourceId);
  const targetAnim = animations.find(a => a.id === targetId);
  
  if (!sourceAnim || !targetAnim) return false;
  
  // Get z-indices
  const sourceZ = getAnimationZIndex(sourceAnim);
  const targetZ = getAnimationZIndex(targetAnim);
  
  // If they have the same z-index, no need to rearrange
  if (sourceZ === targetZ) return true;
  
  // Collect all animations sorted by z-index (ascending)
  const sortedAnims = [...animations].sort((a, b) => {
    return getAnimationZIndex(a) - getAnimationZIndex(b);
  });
  
  // Determine the new position
  let insertIndex;
  for (let i = 0; i < sortedAnims.length; i++) {
    if (sortedAnims[i].id === targetId) {
      insertIndex = isBeforeTarget ? i : i + 1;
      break;
    }
  }
  
  // If inserting at the end
  if (insertIndex >= sortedAnims.length) {
    // Set source to have z-index one more than the highest
    const highestZ = getAnimationZIndex(sortedAnims[sortedAnims.length - 1]);
    updateAnimationZIndex(sourceAnim, highestZ + 1, canvas);
    return true;
  }
  
  // Create a new array without the source animation
  const withoutSource = sortedAnims.filter(a => a.id !== sourceId);
  
  // Insert the source at the new position
  withoutSource.splice(insertIndex, 0, sourceAnim);
  
  // Assign sequential z-indices to maintain order
  withoutSource.forEach((anim, index) => {
    // Use index+1 to ensure positive z-indices
    updateAnimationZIndex(anim, index + 1, canvas);
  });
  
  return true;
}

/**
 * Renders the interaction panel with animations sorted by z-index
 * @param {Object} canvas - The fabric.js canvas object
 */
// Creates the animations interaction view
function createInteractionsView(canvas) {
  const container = document.createElement('div');
  container.className = 'interactions-view';
  
  // If no animations exist
  if (!canvas.activeAnimations || canvas.activeAnimations.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-message';
    emptyMessage.textContent = 'No animations to display.';
    container.appendChild(emptyMessage);
    return container;
  }
  
  // Add button to create new interactions
  const actionBar = document.createElement('div');
  actionBar.className = 'interactions-actions';
  
  const linkBtn = document.createElement('button');
  linkBtn.className = 'link-animations-btn';
  linkBtn.textContent = 'Link Animations';
  linkBtn.title = 'Create a relationship between two animations';
  
  actionBar.appendChild(linkBtn);
  container.appendChild(actionBar);
  
  // Initialize or get the existing interactions array
  canvas.animationInteractions = canvas.animationInteractions || [];
  
  // Display existing animation interactions
  const interactionsContainer = document.createElement('div');
  interactionsContainer.className = 'interactions-list';
  
  if (canvas.animationInteractions.length === 0) {
    const noInteractionsMsg = document.createElement('div');
    noInteractionsMsg.className = 'no-interactions-message';
    noInteractionsMsg.textContent = 'No interactions created yet. Use the "Link Animations" button to create relationships between animations.';
    interactionsContainer.appendChild(noInteractionsMsg);
  } else {
    // Render each interaction
    canvas.animationInteractions.forEach(interaction => {
      const interactionItem = document.createElement('div');
      interactionItem.className = 'interaction-item';
      
      // Find the source and target animations
      const sourceAnim = canvas.activeAnimations.find(a => a.id === interaction.sourceId);
      const targetAnim = canvas.activeAnimations.find(a => a.id === interaction.targetId);
      
      if (!sourceAnim || !targetAnim) {
        // Skip if either animation no longer exists
        return;
      }
      
      const sourceTitle = sourceAnim.title || sourceAnim.prompt || '(Unknown)';
      const targetTitle = targetAnim.title || targetAnim.prompt || '(Unknown)';
      const relationshipType = interaction.type || 'affects';
      
      // Create interaction display
      interactionItem.innerHTML = `
        <div class="interaction-source">${sourceTitle}</div>
        <div class="interaction-relation">${relationshipType}</div>
        <div class="interaction-target">${targetTitle}</div>
        <button class="remove-interaction-btn" data-id="${interaction.id}">×</button>
      `;
      
      // Add event listener to remove button
      interactionItem.querySelector('.remove-interaction-btn').addEventListener('click', () => {
        // Remove this interaction
        canvas.animationInteractions = canvas.animationInteractions.filter(i => i.id !== interaction.id);
        
        // Save state and refresh the panel
        setTimeout(() => canvas.history.saveState(), 20);
        renderInteractionPanel(canvas);
      });
      
      interactionsContainer.appendChild(interactionItem);
    });
  }
  
  container.appendChild(interactionsContainer);
  
  // Add event listener to the "Link Animations" button
  linkBtn.addEventListener('click', () => {
    if (canvas.activeAnimations.length < 2) {
      alert('You need at least two animations to create a link.');
      return;
    }
    
    // Create the animation selection modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'linkAnimationsModal';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    modalContent.innerHTML = `
      <h3>Link Animations</h3>
      <div class="input-group">
        <label for="sourceAnimSelect">Source Animation:</label>
        <select id="sourceAnimSelect">
          ${canvas.activeAnimations.map(anim => `
            <option value="${anim.id}">${anim.title || anim.prompt || anim.type}</option>
          `).join('')}
        </select>
      </div>
      <div class="input-group">
        <label for="relationshipSelect">Relationship:</label>
        <select id="relationshipSelect">
          <option value="avoid">Avoid</option>
          <option value="orbit">Orbit</option>
        </select>
      </div>
      <div class="input-group">
        <label for="targetAnimSelect">Target Animation:</label>
        <select id="targetAnimSelect">
          ${canvas.activeAnimations.map(anim => `
            <option value="${anim.id}">${anim.title || anim.prompt || anim.type}</option>
          `).join('')}
        </select>
      </div>
      <div class="modal-buttons">
        <button id="saveLinkBtn">Create Link</button>
        <button id="cancelLinkBtn">Cancel</button>
      </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Add event listeners to the modal buttons
    document.getElementById('saveLinkBtn').addEventListener('click', () => {
      const sourceId = document.getElementById('sourceAnimSelect').value;
      const targetId = document.getElementById('targetAnimSelect').value;
      const type = document.getElementById('relationshipSelect').value;
      
      createInteraction(sourceId, targetId, type, canvas);
      // Remove the modal
      document.body.removeChild(modal);
    });
    
    document.getElementById('cancelLinkBtn').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
  });
  
  return container;
}

/**
 * Helper function to get all objects for a given animation
 * @param {Object} canvas - The Fabric.js canvas
 * @param {Object} animation - The animation data object
 * @returns {Array} - Array of objects
 */
function getObjectsFromAnimation(canvas, animation) {
  if (!animation || !animation.data) return [];
  
  // Get all IDs from the animation data
  const animObjectIds = new Set();
  animation.data.forEach(d => animObjectIds.add(d.id));
  
  // Find matching objects on the canvas
  return canvas.getObjects().filter(obj => animObjectIds.has(obj.id));
}

export function renderInteractionPanel(canvas) {
  const entriesContainer = document.getElementById('interaction-entries');
  if (!entriesContainer) return;
  
  // Clear existing entries
  entriesContainer.innerHTML = '';
  
  // Get display mode
  const displaySelect = document.getElementById('displayInteractions');
  const displayMode = displaySelect ? displaySelect.value : 'order';
  
  if (displayMode === 'order') {
    // Get animations and sort by z-index
    const animations = canvas.activeAnimations || [];
    const sortedAnimations = sortAnimationsByZIndex(animations);
    
    if (sortedAnimations.length === 0) {
      // Show a message if there are no animations
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'empty-message';
      emptyMessage.textContent = 'No animations to display.';
      entriesContainer.appendChild(emptyMessage);
      return;
    }
    
    // Render each animation
    sortedAnimations.forEach(anim => {
      const entry = createInteractionEntry(anim, canvas);
      entriesContainer.appendChild(entry);
    });
    
    // Add drag and drop event handlers to the container
    entriesContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      // Find the entry we're dragging over
      const target = e.target.closest('.interaction-entry');
      if (!target) return;
      
      // Don't allow dropping onto itself
      const draggingElement = document.querySelector('.dragging');
      if (draggingElement === target) return;
      
      // Determine if we're in the top or bottom half of the target
      const rect = target.getBoundingClientRect();
      const isInTopHalf = e.clientY < rect.top + rect.height / 2;
      
      // Remove drag-over class from all elements
      document.querySelectorAll('.drag-over').forEach(el => {
        el.classList.remove('drag-over');
      });
      
      // Add drag-over class to the target
      target.classList.add('drag-over');
    });
    
    entriesContainer.addEventListener('dragleave', (e) => {
      // Only remove class if leaving an entry
      if (e.target.closest('.interaction-entry')) {
        e.target.closest('.interaction-entry').classList.remove('drag-over');
      }
    });
    
    entriesContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      
      // Get the animation ID that's being dragged
      const draggedId = e.dataTransfer.getData('text/plain');
      if (!draggedId) return;
      
      // Find the target entry
      const targetEntry = e.target.closest('.interaction-entry');
      if (!targetEntry) return;
      
      // Don't drop onto itself
      if (targetEntry.dataset.id === draggedId) return;
      
      // Determine if we're dropping before or after the target
      const rect = targetEntry.getBoundingClientRect();
      const isBeforeTarget = e.clientY < rect.top + rect.height / 2;
      
      // Rearrange z-indices
      const success = rearrangeZIndices(
        canvas.activeAnimations,
        draggedId,
        targetEntry.dataset.id,
        isBeforeTarget,
        canvas
      );
      
      if (success) {
        // Resort canvas objects
        canvas._objects.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
        canvas.requestRenderAll();
        
        // Save to history
        setTimeout(() => canvas.history.saveState(), 20);
        
        // Refresh the panel
        renderInteractionPanel(canvas);
      }
    });
  } else {
    // Show the animation interactions view
    const interactionsView = createInteractionsView(canvas);
    entriesContainer.appendChild(interactionsView);
  }
  
  // Add event listener to the display dropdown if it hasn't been added yet
  if (displaySelect && !displaySelect.hasEventListener) {
    displaySelect.addEventListener('change', () => renderInteractionPanel(canvas));
    displaySelect.hasEventListener = true;
  }
}


export function createInteraction(sourceId, targetId, type, canvas) {
  
  if (sourceId === targetId) {
    alert('Source and target animations must be different.');
    return;
  }
  
  // For avoid relationships, validate that at least one animation is birds or hop
  if (type === 'avoid') {
    const sourceAnim = canvas.activeAnimations.find(a => a.id === sourceId);
    const targetAnim = canvas.activeAnimations.find(a => a.id === targetId);
    
    if (!sourceAnim || !targetAnim) {
      alert('Could not find one of the selected animations.');
      return;
    }
    
    const sourceIsMoving = sourceAnim.type === 'birds' || sourceAnim.type === 'hop';
    const targetIsMoving = targetAnim.type === 'birds' || targetAnim.type === 'hop';
    
    if (!sourceIsMoving && !targetIsMoving) {
      alert('For "avoid" relationships, at least one animation must be a moving type (birds or hop).');
      return;
    }
  }
  
  // For orbit relationships, validate the source and target animations
  if (type === 'orbit') {
    console.log("Source ID:", sourceId);
    console.log("Target ID:", targetId);

    console.log("Animations:", canvas.activeAnimations);
    const sourceAnim = canvas.activeAnimations.find(a => a.id === sourceId);
    const targetAnim = canvas.activeAnimations.find(a => a.id === targetId);
    
    if (!sourceAnim) {
      alert('Could not find the source animation.');
      return;
    }
    
    if (!targetAnim) {
      alert('Could not find the target animation.');
      return;
    }
    
    // Any animated object can orbit, but we'll show a helpful message
    if (sourceAnim.type === 'fix') {
      if (!confirm('A "fix" animation will now orbit. This will override its static behavior. Continue?')) {
        return;
      }
    }
    
    // Validate that target is a fixed animation
    if (targetAnim.type !== 'fix') {
      if (!confirm('For best results, target should be a "fix" animation. Continue anyway?')) {
        return;
      }
    }
  }
  
  // Create the new interaction
  // For orbit interactions, always use the target animation as the orbit center
  let orbitParameters = {};
  if (type === 'orbit') {
    const targetAnim = canvas.activeAnimations.find(a => a.id === targetId);
    
    if (targetAnim && targetAnim.data && targetAnim.data.length > 0) {
      // Always use the target animation's position as the orbit center
      const targetObjects = getObjectsFromAnimation(canvas, targetAnim);
      if (targetObjects.length > 0) {
        // Calculate the center of all target objects
        let centerX = 0, centerY = 0;
        targetObjects.forEach(obj => {
          centerX += obj.left;
          centerY += obj.top;
        });
        centerX /= targetObjects.length;
        centerY /= targetObjects.length;
        
        // Use the target's center with target tracking enabled
        orbitParameters = {
          orbitSpeed: 0.5, // Degrees per frame
          orbitRadius: undefined, // Use current distance if undefined
          centerX: centerX,
          centerY: centerY,
          orbitTarget: targetId, // Store reference to the target we're orbiting
          trackTarget: true // Enable dynamic center point tracking
        };
      } else {
        // Fallback to canvas center, but this shouldn't happen with validation
        orbitParameters = {
          orbitSpeed: 0.5,
          orbitRadius: undefined,
          centerX: canvas.getWidth() / 2,
          centerY: canvas.getHeight() / 2
        };
        console.warn("Target animation has no objects to orbit around.");
      }
    } else {
      // If no valid target, use canvas center, but this shouldn't happen with validation
      orbitParameters = {
        orbitSpeed: 0.5,
        orbitRadius: undefined,
        centerX: canvas.getWidth() / 2,
        centerY: canvas.getHeight() / 2
      };
      console.warn("Invalid target animation for orbit.");
    }
  }
  
  const newInteraction = {
    id: `interaction_${Date.now()}`,
    sourceId,
    targetId,
    type,
    parameters: type === 'orbit' 
      ? orbitParameters
      : {
          boundaryDistance: 30, // Default radius for boundary/wall detection
          hopStrength: 1.0 // How bouncy the walls are (1.0 = perfect reflection)
        },
    createdAt: Date.now()
  };
  
  // Add to the canvas interactions array
  canvas.animationInteractions = canvas.animationInteractions || [];
  canvas.animationInteractions.push(newInteraction);
  
  // Save state and refresh the panel
  setTimeout(() => canvas.history.saveState(), 20);
  renderInteractionPanel(canvas);
}
