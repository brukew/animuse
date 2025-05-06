import { deleteSel } from './toolbar.js';
import { animate } from './animations.js';
import { renderInteractionPanel } from './interactionPanel.js';

export function createAnimationEntry(anim, canvas) {
    const entry = document.createElement('div');
    entry.className = 'animation-entry';
    entry.dataset.id = anim.id;
  
    const header = document.createElement('div');
    header.className = 'entry-header';
  
    const titleText = document.createElement('span');
    titleText.className = 'entry-title-text';
    titleText.textContent = anim.title || anim.prompt || `(${anim.type})`;
    titleText.title = "Double-click to edit title";
    
    // Handle double-click to edit title
    titleText.addEventListener('dblclick', (e) => {
      // Create an input element to replace the title text
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'title-edit-input';
      input.value = anim.title || '';
      input.placeholder = 'Enter a title';
      
      // Replace the title text with the input
      titleText.style.display = 'none';
      header.insertBefore(input, titleText);
      
      // Focus and select all text in the input
      input.focus();
      input.select();
      
      // Track whether input has already been removed
      let inputRemoved = false;

      // Function to save the edited title
      const saveTitle = () => {
        // Only proceed if the input is still in the DOM
        if (inputRemoved) return;
        inputRemoved = true;
        
        const newTitle = input.value.trim();
        if (newTitle) {
          anim.title = newTitle;
          anim.updatedAt = Date.now();
          anim._titleCustomized = true; // Mark that title has been manually customized
          titleText.textContent = newTitle;
          
          // Update the interaction panel with the new title
          renderInteractionPanel(canvas);
          
          // Save to history after title change
          setTimeout(() => canvas.history.saveState(), 20);
        }
        
        // Remove the input and show the title again
        try {
          header.removeChild(input);
        } catch (e) {
          console.log("Input already removed");
        }
        titleText.style.display = '';

      };

      // Function to cancel editing without saving
      const cancelEdit = () => {
        if (inputRemoved) return;
        inputRemoved = true;
        
        try {
          header.removeChild(input);
        } catch (e) {
          console.log("Input already removed");
        }
        titleText.style.display = '';
      };
      
      // Save on enter key, cancel on escape
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          saveTitle();
          e.preventDefault();
        } else if (e.key === 'Escape') {
          cancelEdit();
          e.preventDefault();
        }
      });
      
      // Save on blur (click outside)
      input.addEventListener('blur', saveTitle);
      
      // Prevent the event from bubbling up
      e.stopPropagation();
    });
  
    // Calculate the actual object count, considering grouped objects
    let objectCount = 0;
    
    anim.data.forEach(entry => {
      if (entry.isGroup && Array.isArray(entry.memberIds)) {
        // Count each group as 1 object since we're treating groups as single units
        objectCount += 1;
      } else {
        // Count individual objects
        objectCount += 1;
      }
    });
    
    const meta = document.createElement('span');
    meta.className = 'entry-meta';
    
    // Show object count
    const objectCountSpan = document.createElement('span');
    objectCountSpan.className = 'object-count';
    objectCountSpan.textContent = `${objectCount} object${objectCount !== 1 ? 's' : ''}`;

    // Add both to the meta element
    meta.appendChild(objectCountSpan);
  
    header.append(titleText, meta);
  
    const controls = document.createElement('div');
    controls.className = 'entry-controls';
  
    const selectBtn = document.createElement('button');
    selectBtn.className = 'select-btn';
    selectBtn.textContent = 'Select';
  
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '🗑';

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = '✏️';
  
    controls.append(selectBtn, deleteBtn, editBtn);
    entry.append(header, controls);

    // Delete logic
    deleteBtn.addEventListener('click', () => {
        deleteAnimationBySelection(anim, canvas);
      });
  
    // Select logic
    selectBtn.addEventListener('click', (e) => {
      console.log('Selecting animation with data:', anim.data);
      
      // Collect all IDs to select, including those in groups
      const allIds = new Set();
      const groupIds = new Set();
      
      // Process all data entries to find objects and groups
      anim.data.forEach(d => {
        allIds.add(d.id);
        if (d.groupId) {
          groupIds.add(d.groupId);
        }
      });
      
      // Find objects that match the animation data
      const matching = canvas.getObjects().filter(o => {
        // Direct ID match
        if (allIds.has(o.id)) {
          return true;
        }
        
        // Group ID match - select all objects in the same groups
        if (o.groupId && groupIds.has(o.groupId)) {
          return true;
        }
        
        return false;
      });
      
      console.log(`Found ${matching.length} objects to select`);
      
      // Check if shift key is pressed for multi-selection
      const isShiftPressed = e.shiftKey;
      
      if (matching.length === 0) {
        console.warn('No objects found to select for animation:', anim.id);
        return;
      }
      
      // If shift is pressed and we already have a selection, add to it
      if (isShiftPressed && canvas.getActiveObject()) {
        const currentSelection = canvas.getActiveObject();
        let selectedObjects = [];
        
        // Get currently selected objects
        if (currentSelection.type === 'activeSelection') {
          selectedObjects = currentSelection.getObjects();
        } else {
          selectedObjects = [currentSelection];
        }
        
        // Combine previous selection with new matching objects
        const allObjects = [...new Set([...selectedObjects, ...matching])];
        
        // Create a new selection with all objects
        canvas.discardActiveObject();
        const newSelection = new fabric.ActiveSelection(allObjects, { canvas });
        canvas.setActiveObject(newSelection);
      } else {
        // Normal selection (no shift key or no previous selection)
        if (matching.length > 1) {
          const sel = new fabric.ActiveSelection(matching, { canvas });
          canvas.setActiveObject(sel);
        } else if (matching.length === 1) {
          canvas.setActiveObject(matching[0]);
        }
      }
      
      canvas.requestRenderAll();
    });
  
    // Prompt editing logic
    editBtn.addEventListener("click", () => {
      const modal = document.getElementById("editPromptModal");
      const input = document.getElementById("editPromptInput");
      const saveBtn = document.getElementById("savePromptBtn");
      const cancelBtn = document.getElementById("cancelPromptBtn");
  
      input.value = anim.prompt || "";
      modal.classList.remove("hidden");
  
      const save = () => {
        const newPrompt = input.value.trim();
        anim.prompt = newPrompt;
        anim.updatedAt = Date.now(); // Update the timestamp when editing
        
        // If title has never been customized, update it along with the prompt
        if (!anim._titleCustomized) {
          anim.title = newPrompt;
          titleText.textContent = newPrompt;
          // Update the interaction panel with the new title
          renderInteractionPanel(canvas);
        }
        
        // Prompt is updated, no need to update any time info

        // Collect all IDs to select, including those in groups
        const allIds = new Set();
        const groupIds = new Set();
        
        // Process all data entries to find objects and groups
        anim.data.forEach(d => {
          allIds.add(d.id);
          if (d.groupId) {
            groupIds.add(d.groupId);
          }
        });
        
        // Find objects that match the animation data
        const objs = canvas.getObjects().filter(o => {
          // Direct ID match
          if (allIds.has(o.id)) {
            return true;
          }
          
          // Group ID match - select all objects in the same groups
          if (o.groupId && groupIds.has(o.groupId)) {
            return true;
          }
          
          return false;
        });

        animate(anim.prompt, canvas, objs, {
            id: anim.id,
            data: anim.data,
            title: anim.title,
            _titleCustomized: anim._titleCustomized,
            update: true
          }, { save: true });
          
        modal.classList.add("hidden");
        saveBtn.removeEventListener("click", save);
        cancelBtn.removeEventListener("click", cancel);
      };
  
      const cancel = () => {
        modal.classList.add("hidden");
        saveBtn.removeEventListener("click", save);
        cancelBtn.removeEventListener("click", cancel);
      };
  
      saveBtn.addEventListener("click", save);
      cancelBtn.addEventListener("click", cancel);
    });
  
    return entry;
  }
  
  // Sort animations based on the selected sort order
function sortAnimations(animations, sortOrder) {
  if (!animations || animations.length === 0) return [];
  
  const sorted = [...animations]; // Make a copy to avoid modifying the original array
  
  switch (sortOrder) {
    case 'latest':
      // Sort by creation date, newest first
      sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      break;
    case 'oldest':
      // Sort by creation date, oldest first
      sorted.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      break;
    case 'recently-updated':
      // Sort by update date, most recent first
      sorted.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      break;
    default:
      // Default to latest created
      sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }
  
  return sorted;
}

// Update animation panel select buttons based on current selection
export function updateSelectionState(canvas) {
  if (!canvas) return;
  
  // Get all currently selected object IDs
  const activeObj = canvas.getActiveObject();
  if (!activeObj) {
    // No selection, clear all active states
    document.querySelectorAll('.select-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelectorAll('.animation-entry').forEach(entry => {
      entry.classList.remove('selected');
    });
    return;
  }
  
  // Create a set of selected object IDs
  const selectedIds = new Set();
  
  if (activeObj.type === 'activeSelection') {
    // Multiple objects selected
    activeObj.getObjects().forEach(obj => {
      selectedIds.add(obj.id);
    });
  } else {
    // Single object selected
    selectedIds.add(activeObj.id);
  }
  
  // Update each animation entry button
  document.querySelectorAll('.animation-entry').forEach(entry => {
    const animId = entry.dataset.id;
    const anim = canvas.activeAnimations.find(a => a.id === animId);
    const selectBtn = entry.querySelector('.select-btn');
    
    if (!anim || !selectBtn) return;
    
    // Check if any objects in this animation are selected
    let hasSelectedObjects = false;
    
    // Create sets of IDs to check against
    const animObjectIds = new Set();
    anim.data.forEach(d => {
      animObjectIds.add(d.id);
    });
    
    // Check for intersection between selected IDs and animation object IDs
    selectedIds.forEach(id => {
      if (animObjectIds.has(id)) {
        hasSelectedObjects = true;
      }
    });
    
    // Update button and entry state
    if (hasSelectedObjects) {
      selectBtn.classList.add('active');
      entry.classList.add('selected');
    } else {
      selectBtn.classList.remove('active');
      entry.classList.remove('selected');
    }
  });
}

export function renderAnimationPanel(canvas) {
  // Get the animation entries container
  const entriesContainer = document.getElementById('animation-entries');
  if (!entriesContainer) {
    // If the container doesn't exist (older version of HTML), fall back to the panel
    const panel = document.getElementById('animationPanel');
    panel.innerHTML = '';
    
    (canvas.activeAnimations || []).forEach(anim => {
      const entry = createAnimationEntry(anim, canvas);
      panel.appendChild(entry);
    });
    return;
  }
  
  // Clear existing entries
  entriesContainer.innerHTML = '';
  
  // Get the selected sort order
  const sortSelect = document.getElementById('sortAnimations');
  const sortOrder = sortSelect ? sortSelect.value : 'latest';
  
  // Sort animations based on the selected order
  const sortedAnimations = sortAnimations(canvas.activeAnimations || [], sortOrder);
  
  // Render the sorted animations
  sortedAnimations.forEach(anim => {
    const entry = createAnimationEntry(anim, canvas);
    entriesContainer.appendChild(entry);
  });
  
  // Add event listener to the sort dropdown if it hasn't been added yet
  if (sortSelect && !sortSelect.hasEventListener) {
    sortSelect.addEventListener('change', () => renderAnimationPanel(canvas));
    sortSelect.hasEventListener = true;
  }
  
  // Update the selection state for buttons
  updateSelectionState(canvas);
}
  
  function deleteAnimationBySelection(anim, canvas) {
    console.log('Deleting animation:', anim);
    
    // Collect all IDs to select, including those in groups
    const allIds = new Set();
    const groupIds = new Set();
    
    // Process all data entries to find objects and groups
    anim.data.forEach(d => {
      allIds.add(d.id);
      if (d.groupId) {
        groupIds.add(d.groupId);
      }
    });
    
    // Find objects that match the animation data
    const matching = canvas.getObjects().filter(o => {
      // Direct ID match
      if (allIds.has(o.id)) {
        return true;
      }
      
      // Group ID match - select all objects in the same groups
      if (o.groupId && groupIds.has(o.groupId)) {
        return true;
      }
      
      return false;
    });
    
    console.log(`Found ${matching.length} objects to delete`);
    
    if (matching.length === 0) {
      // If no objects found, just remove the animation entry
      canvas.activeAnimations = (canvas.activeAnimations || []).filter(a => a.id !== anim.id);
      renderAnimationPanel(canvas);
      renderInteractionPanel(canvas);
      return;
    }
  
    // Select the objects to delete
    if (matching.length === 1) {
      canvas.setActiveObject(matching[0]);
    } else if (matching.length > 1) {
      const sel = new fabric.ActiveSelection(matching, { canvas });
      canvas.setActiveObject(sel);
    }
  
    // Delete the objects
    canvas.requestRenderAll();
    setTimeout(() => {
      deleteSel(canvas);
      
      // Make sure the animation is removed from the list
      canvas.activeAnimations = (canvas.activeAnimations || []).filter(a => a.id !== anim.id);
      renderAnimationPanel(canvas);
      renderInteractionPanel(canvas);
    }, 20);
  }
  