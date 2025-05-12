import { setupCanvas } from './canvasSetup.js';
import { Toolbar, deleteSel } from './toolbar.js';
import { enableGestures } from './gestures.js';
import { renderInteractionPanel } from './interactionPanel.js';
import { SpeechController } from './speechRecognition.js';
import { LLMController } from './llmController.js';
import { initCanvasResize } from './canvasResize.js';

fabric.Object.prototype.toObject = (function(toObject) {
    return function(propertiesToInclude) {
      const original = toObject.call(this, propertiesToInclude);
      original.id = this.id;
      original.groupId = this.groupId || null;
      return original;
    };
  })(fabric.Object.prototype.toObject);
  
fabric.Object.__uidCounter = 1;

// Make deleteSel function available globally
window.deleteSel = deleteSel;


window.addEventListener('load', () => {
  const canvas = setupCanvas('canvas');
  const toolbar = new Toolbar(canvas);
  // Expose the toolbar for group button updates
  window.toolbar = toolbar;
  enableGestures(canvas);
  
  // Initialize canvas resize functionality
  initCanvasResize(canvas);
  
  // Initialize the interaction panel
  renderInteractionPanel(canvas);
  
  // Initialize panel collapse functionality
  initializePanelCollapse();
  
  // Initialize LLM controller
  const llmController = new LLMController(canvas);
  // Expose LLM controller for debugging
  window.llmController = llmController;
  
  // Initialize speech recognition
  const speechController = new SpeechController(canvas);
  // Expose speech controller for debugging
  window.speechController = speechController;
  
  // Add a button to toggle speech recognition
  const speechToggleBtn = document.createElement('button');
  speechToggleBtn.id = 'speechToggleBtn';
  speechToggleBtn.className = 'speech-toggle-btn';
  speechToggleBtn.innerHTML = 'Enable Voice';
  speechToggleBtn.title = 'Toggle Voice Input (Ctrl/Cmd + V)';
  
  // Add to toolbar
  const toolbar_div = document.getElementById('toolbar');
  toolbar_div.querySelector('.buttons').appendChild(speechToggleBtn);
  
  // Track speech recognition state
  let speechEnabled = false;
  
  // Toggle speech recognition on button click
  speechToggleBtn.addEventListener('click', () => {
    if (speechEnabled) {
      speechController.stop();
      speechToggleBtn.innerHTML = 'Enable Voice';
      speechToggleBtn.classList.remove('active');
    } else {
      speechController.start();
      speechToggleBtn.innerHTML = 'Disable Voice';
      speechToggleBtn.classList.add('active');
    }
    speechEnabled = !speechEnabled;
  });
  
  initializeHelpOverlay();
});

// Panel collapse functionality
function initializePanelCollapse() {
  const animationPanel = document.getElementById('animationPanel');
  const interactionPanel = document.getElementById('interactionPanel');
  const animationCollapse = document.querySelector('.animation-collapse');
  const interactionCollapse = document.querySelector('.interaction-collapse');
  
  if (animationCollapse && animationPanel) {
    animationCollapse.addEventListener('click', () => {
      animationPanel.classList.toggle('collapsed');
      animationPanel.classList.toggle('expanded');
      updateCanvasWrapperWidth();
    });
  }
  
  if (interactionCollapse && interactionPanel) {
    interactionCollapse.addEventListener('click', () => {
      interactionPanel.classList.toggle('collapsed');
      interactionPanel.classList.toggle('expanded');
      updateCanvasWrapperWidth();
    });
  }
}

function updateCanvasWrapperWidth() {
  const canvasWrapper = document.getElementById('canvasWrapper');
  const leftPanel = document.getElementById('animationPanel');
  const rightPanel = document.getElementById('interactionPanel');
  
  const leftWidth = leftPanel.classList.contains('collapsed') ? 24 : leftPanel.offsetWidth;
  const rightWidth = rightPanel.classList.contains('collapsed') ? 24 : rightPanel.offsetWidth;
  
  canvasWrapper.style.width = `calc(100% - ${leftWidth + rightWidth}px)`;
  
  // Log for debugging
  console.log('Canvas wrapper width updated:', canvasWrapper.style.width);
}

// Initialize help overlay functionality
function initializeHelpOverlay() {
  const helpButton = document.querySelector('.help-button');
  const helpOverlay = document.querySelector('.help-overlay');
  const helpClose = document.querySelector('.help-close');

  helpButton.addEventListener('click', () => {
    helpOverlay.classList.add('visible');
  });

  helpClose.addEventListener('click', () => {
    helpOverlay.classList.remove('visible');
  });

  // Close overlay when clicking outside the content
  helpOverlay.addEventListener('click', (e) => {
    if (e.target === helpOverlay) {
      helpOverlay.classList.remove('visible');
    }
  });

  // Close overlay with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && helpOverlay.classList.contains('visible')) {
      helpOverlay.classList.remove('visible');
    }
  });
}