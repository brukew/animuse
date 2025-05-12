/**
 * Handles canvas resizing and maintains aspect ratio while preserving animations
 */

/**
 * Resizes the canvas to fit the available space while maintaining aspect ratio
 * @param {Object} canvas - The Fabric.js canvas object
 * @param {number} baseWidth - The base width of the canvas
 * @param {number} baseHeight - The base height of the canvas
 */
export function resizeCanvas(canvas, baseWidth = 1000, baseHeight = 800) {
  const wrapper = document.getElementById('canvasWrapper');
  const toolbar = document.getElementById('toolbar');
  const animationPanel = document.getElementById('animationPanel');
  const interactionPanel = document.getElementById('interactionPanel');
  
  // Calculate available space
  const availableWidth = window.innerWidth - 
    (animationPanel.offsetWidth + interactionPanel.offsetWidth);
  const availableHeight = window.innerHeight - 
    (toolbar.offsetHeight + 100); // 100px for margins and header
  
  // Calculate scale to fit while maintaining aspect ratio
  const scaleX = availableWidth / baseWidth;
  const scaleY = availableHeight / baseHeight;
  const scale = Math.min(scaleX, scaleY);
  
  // Set new dimensions
  const newWidth = baseWidth * scale;
  const newHeight = baseHeight * scale;
  
  // Update canvas size
  canvas.setWidth(newWidth);
  canvas.setHeight(newHeight);
  
  // Scale all objects to maintain their relative positions
  const objects = canvas.getObjects();
  objects.forEach(obj => {
    const originalLeft = obj.left * (baseWidth / canvas.getWidth());
    const originalTop = obj.top * (baseHeight / canvas.getHeight());
    
    obj.set({
      left: originalLeft * scale,
      top: originalTop * scale,
      scaleX: obj.scaleX * scale,
      scaleY: obj.scaleY * scale
    });
  });
  
  // Update animation bounds
  if (canvas.activeAnimations) {
    canvas.activeAnimations.forEach(anim => {
      if (anim.bounds) {
        anim.bounds = {
          width: newWidth,
          height: newHeight,
          left: 0,
          right: newWidth
        };
      }
    });
  }
  
  canvas.requestRenderAll();
}

/**
 * Initializes canvas resize functionality
 * @param {Object} canvas - The Fabric.js canvas object
 */
export function initCanvasResize(canvas) {
  // Initial resize
  resizeCanvas(canvas);
  
  // Add resize event listener
  window.addEventListener('resize', () => {
    resizeCanvas(canvas);
  });
  
  // Add orientation change listener for mobile devices
  window.addEventListener('orientationchange', () => {
    // Small delay to ensure proper dimensions after orientation change
    setTimeout(() => resizeCanvas(canvas), 100);
  });
} 