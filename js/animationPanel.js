import { deleteSel } from './toolbar.js';
import { animate } from './animations.js';

export function createAnimationEntry(anim, canvas) {
    const entry = document.createElement('div');
    entry.className = 'animation-entry';
    entry.dataset.id = anim.id;
  
    const header = document.createElement('div');
    header.className = 'entry-header';
  
    const titleText = document.createElement('span');
    titleText.className = 'entry-title-text';
    titleText.textContent = anim.prompt || `(${anim.type})`;
  
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
    meta.textContent = `${objectCount} object${objectCount !== 1 ? 's' : ''}`;
  
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
    selectBtn.addEventListener('click', () => {
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
      
      if (matching.length > 1) {
        const sel = new fabric.ActiveSelection(matching, { canvas });
        canvas.setActiveObject(sel);
      } else if (matching.length === 1) {
        canvas.setActiveObject(matching[0]);
      } else {
        console.warn('No objects found to select for animation:', anim.id);
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
        anim.prompt = input.value.trim();
        titleText.textContent = anim.prompt;

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
  
  export function renderAnimationPanel(canvas) {
    const panel = document.getElementById('animationPanel');
    panel.innerHTML = '';
  
    (canvas.activeAnimations || []).forEach(anim => {
      const entry = createAnimationEntry(anim, canvas);
      panel.appendChild(entry);
    });
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
    }, 20);
  }
  