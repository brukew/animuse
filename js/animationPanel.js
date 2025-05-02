export function createAnimationEntry(anim, canvas) {
    const entry = document.createElement('div');
    entry.className = 'animation-entry';
    entry.dataset.id = anim.id;
  
    const header = document.createElement('div');
    header.className = 'entry-header';
  
    const titleText = document.createElement('span');
    titleText.className = 'entry-title-text';
    titleText.textContent = anim.prompt || `(${anim.type})`;
  
    const meta = document.createElement('span');
    meta.className = 'entry-meta';
    meta.textContent = `${anim.data.length} object${anim.data.length !== 1 ? 's' : ''}`;
  
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
  
    // Select logic
    selectBtn.addEventListener('click', () => {
      const ids = anim.data.map(d => d.id);
      const matching = canvas.getObjects().filter(o => ids.includes(o.id));
      if (matching.length > 1) {
        const sel = new fabric.ActiveSelection(matching, { canvas });
        canvas.setActiveObject(sel);
      } else if (matching.length === 1) {
        canvas.setActiveObject(matching[0]);
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
  