// Import required dependencies
import { renderAnimationPanel } from './animationPanel.js';

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
    // For future implementation: animation interactions
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-message';
    emptyMessage.textContent = 'Animation interactions view not implemented yet.';
    entriesContainer.appendChild(emptyMessage);
  }
  
  // Add event listener to the display dropdown if it hasn't been added yet
  if (displaySelect && !displaySelect.hasEventListener) {
    displaySelect.addEventListener('change', () => renderInteractionPanel(canvas));
    displaySelect.hasEventListener = true;
  }
}