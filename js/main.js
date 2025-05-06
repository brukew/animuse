import { setupCanvas } from './canvasSetup.js';
import { Toolbar, deleteSel } from './toolbar.js';
import { enableGestures } from './gestures.js';
import { renderInteractionPanel } from './interactionPanel.js';
import { SpeechController } from './speechRecognition.js';
import { LLMController } from './llmController.js';

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
  
  // Initialize the interaction panel
  renderInteractionPanel(canvas);
  
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
  speechToggleBtn.innerHTML = '🎤 Enable Voice';
  speechToggleBtn.title = 'Toggle voice commands';
  
  // Add to toolbar
  const toolbar_div = document.getElementById('toolbar');
  toolbar_div.querySelector('.buttons').appendChild(speechToggleBtn);
  
  // Track speech recognition state
  let speechEnabled = false;
  
  // Toggle speech recognition on button click
  speechToggleBtn.addEventListener('click', () => {
    if (speechEnabled) {
      speechController.stop();
      speechToggleBtn.innerHTML = '🎤 Enable Voice';
      speechToggleBtn.classList.remove('active');
    } else {
      speechController.start();
      speechToggleBtn.innerHTML = '🎤 Disable Voice';
      speechToggleBtn.classList.add('active');
    }
    speechEnabled = !speechEnabled;
  });
});