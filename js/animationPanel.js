export function renderAnimationPanel(canvas) {
    const panel = document.getElementById('animationPanel');
    panel.innerHTML = ''; // clear current list
  
    (canvas.activeAnimations || []).forEach(anim => {
      const entry = document.createElement('div');
      entry.className = 'animationEntry';
  
      const prompt = document.createElement('textarea');
      prompt.value = anim.prompt || `(${anim.type})`;
      prompt.addEventListener('input', () => {
        anim.prompt = prompt.value; // update stored prompt
      });
  
      const count = document.createElement('div');
      count.textContent = `${anim.data.length} object${anim.data.length !== 1 ? 's' : ''}`;
  
      entry.appendChild(prompt);
      entry.appendChild(count);
  
      entry.addEventListener('click', () => {
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
  
      panel.appendChild(entry);
    });
  }
  