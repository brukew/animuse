// speechRecognition.js - Handles speech recognition and wake word detection

/**
 * Speech recognition controller that listens for a wake word and processes commands
 */
export class SpeechController {
  constructor(canvas) {
    this.canvas = canvas;
    this.isListening = false;
    this.isProcessingCommand = false;
    this.wakeWord = "hey muse";
    this.recognition = null;
    this.setupRecognition();
    this.statusElement = this.createStatusElement();
    this.commandFeedbackElement = this.createCommandFeedbackElement();
  }

  /**
   * Creates a status indicator element
   * @returns {HTMLElement} The status element
   */
  createStatusElement() {
    const statusElement = document.createElement('div');
    statusElement.id = 'speech-status';
    statusElement.className = 'speech-status';
    statusElement.innerHTML = `
      <div class="status-icon">🎤</div>
      <div class="status-text">Speech recognition inactive</div>
    `;
    document.body.appendChild(statusElement);
    return statusElement;
  }

  /**
   * Creates a feedback element for displaying recognized commands
   * @returns {HTMLElement} The feedback element
   */
  createCommandFeedbackElement() {
    const feedbackElement = document.createElement('div');
    feedbackElement.id = 'command-feedback';
    feedbackElement.className = 'command-feedback hidden';
    document.body.appendChild(feedbackElement);
    return feedbackElement;
  }

  /**
   * Sets up the Web Speech API recognition
   */
  setupRecognition() {
    // Check if browser supports speech recognition
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error('Speech recognition not supported in this browser');
      this.updateStatus('Speech recognition not supported', false);
      return;
    }

    // Initialize speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = false; // Only process final results
    this.recognition.lang = 'en-US';

    // Handle speech recognition results
    this.recognition.onresult = (event) => {
      // Get the final result
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        
        // We're only using final results now
        if (result.isFinal) {
          const transcript = result[0].transcript.trim().toLowerCase();
          
          // Log for debugging
          console.log('Final speech recognized:', transcript);
          
          if (this.isProcessingCommand) {
            // If we're already processing a command, capture the command
            // but ignore the wake word if it's still in the transcript
            const commandText = transcript.replace(this.wakeWord, '').trim();
            if (commandText.length > 0) {
              this.processCommand(commandText);
            }
          } else if (transcript.includes(this.wakeWord)) {
            // If we detect the wake word, start processing commands
            this.activateCommandMode();
            
            // Also check if there's a command after the wake word
            const afterWakeWord = transcript.substring(transcript.indexOf(this.wakeWord) + this.wakeWord.length).trim();
            if (afterWakeWord.length > 0) {
              // If there's text after the wake word, process it as a command
              setTimeout(() => {
                this.processCommand(afterWakeWord);
              }, 500);
            }
          }
        }
      }
    };

    // Handle errors
    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      
      // Handle specific errors
      if (event.error === 'no-speech') {
        this.updateStatus('No speech detected', false);
      } else if (event.error === 'audio-capture') {
        this.updateStatus('No microphone detected', false);
      } else if (event.error === 'not-allowed') {
        this.updateStatus('Microphone access denied', false);
      }
      
      // Reset if needed
      if (this.isProcessingCommand) {
        setTimeout(() => this.deactivateCommandMode(), 2000);
      }
    };

    // Handle when recognition ends (automatically or manually)
    this.recognition.onend = () => {
      if (this.isListening) {
        // If we're supposed to be listening but recognition ended, restart it
        this.recognition.start();
      } else {
        this.updateStatus('Speech recognition inactive', false);
      }
    };
  }

  /**
   * Starts the speech recognition service
   */
  start() {
    if (!this.recognition) {
      console.error('Speech recognition not initialized');
      return;
    }

    try {
      this.recognition.start();
      this.isListening = true;
      this.updateStatus('Listening for wake word', true);
      console.log('Speech recognition started');
    } catch (error) {
      console.error('Error starting speech recognition:', error);
    }
  }

  /**
   * Stops the speech recognition service
   */
  stop() {
    if (!this.recognition) return;
    
    this.isListening = false;
    this.isProcessingCommand = false;
    try {
      this.recognition.stop();
      this.updateStatus('Speech recognition inactive', false);
      console.log('Speech recognition stopped');
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
    }
  }

  /**
   * Updates the status UI element
   * @param {string} message - The status message to display
   * @param {boolean} isActive - Whether speech recognition is active
   */
  updateStatus(message, isActive) {
    if (!this.statusElement) return;
    
    const statusIcon = this.statusElement.querySelector('.status-icon');
    const statusText = this.statusElement.querySelector('.status-text');
    
    if (isActive) {
      this.statusElement.classList.add('active');
      statusIcon.textContent = '🎤';
    } else {
      this.statusElement.classList.remove('active');
      statusIcon.textContent = '🎤';
    }
    
    statusText.textContent = message;
  }

  /**
   * Activates command processing mode after wake word is detected
   */
  activateCommandMode() {
    this.isProcessingCommand = true;
    this.updateStatus('Listening for command...', true);
    
    // Show feedback message but don't auto-hide it while we're listening for commands
    this.showCommandFeedback('I heard you! What would you like to do?', false);
    
    // Clear any existing timer
    if (this._commandModeTimer) {
      clearTimeout(this._commandModeTimer);
      this._commandModeTimer = null;
    }
    
    // Set a timeout to exit command mode if no command is detected
    // Using a longer timeout (10 seconds) to give more time to speak
    this._commandModeTimer = setTimeout(() => {
      if (this.isProcessingCommand) {
        this.deactivateCommandMode();
      }
      this._commandModeTimer = null;
    }, 10000);
  }

  /**
   * Deactivates command mode and returns to wake word detection
   */
  deactivateCommandMode() {
    this.isProcessingCommand = false;
    this.updateStatus('Listening for wake word', true);
    this.hideCommandFeedback();
    
    // Clear any command mode timer
    if (this._commandModeTimer) {
      clearTimeout(this._commandModeTimer);
      this._commandModeTimer = null;
    }
  }

  /**
   * Processes a voice command
   * @param {string} command - The command to process
   */
  processCommand(command) {
    // Display the command for user feedback
    this.showCommandFeedback(`Recognized: "${command}"`);
    
    // TODO: Send to LLM for processing
    // For now, use basic keyword detection
    this.handleBasicCommands(command);
    
    // Clear any existing timer
    if (this._commandModeTimer) {
      clearTimeout(this._commandModeTimer);
    }
    
    // After processing, continue listening for more commands
    this.updateStatus('Listening for another command...', true);
    this.showCommandFeedback('Command processed. What else would you like to do?', false);
    
    // Set a new timer to exit command mode if no more commands come in
    this._commandModeTimer = setTimeout(() => {
      if (this.isProcessingCommand) {
        this.deactivateCommandMode();
      }
    }, 10000); // Listen for another 10 seconds
  }

  /**
   * Shows feedback for the recognized command
   * @param {string} message - The message to display
   * @param {boolean} autoHide - Whether to automatically hide the feedback (default: true)
   */
  showCommandFeedback(message, autoHide = true) {
    if (!this.commandFeedbackElement) return;
    
    // Clear any existing hide timers
    if (this._feedbackTimer) {
      clearTimeout(this._feedbackTimer);
      this._feedbackTimer = null;
    }
    
    this.commandFeedbackElement.textContent = message;
    this.commandFeedbackElement.classList.remove('hidden');
    
    // Hide after a delay if autoHide is true
    if (autoHide) {
      this._feedbackTimer = setTimeout(() => {
        this.hideCommandFeedback();
        this._feedbackTimer = null;
      }, 5000);
    }
  }

  /**
   * Hides the command feedback element
   */
  hideCommandFeedback() {
    if (!this.commandFeedbackElement) return;
    this.commandFeedbackElement.classList.add('hidden');
  }

  /**
   * Basic command processing without LLM
   * @param {string} command - The command to process
   */
  handleBasicCommands(command) {
    // Example basic command handling
    const commandLower = command.toLowerCase();
    
    // Track if any command was recognized
    let commandRecognized = false;
    
    // Pause/Resume commands
    if (commandLower.includes('pause') || commandLower.includes('stop')) {
      this.pauseAnimations();
      this.showCommandFeedback('Pausing animations');
      commandRecognized = true;
    } 
    else if (commandLower.includes('resume') || commandLower.includes('play')) {
      this.resumeAnimations();
      this.showCommandFeedback('Resuming animations');
      commandRecognized = true;
    }
    // Delete commands
    else if (commandLower.includes('delete') || commandLower.includes('remove')) {
      this.deleteSelectedItems();
      commandRecognized = true;
    }
    // Select all command
    else if (commandLower.includes('select all')) {
      if (commandLower.includes('animation')) {
        this.selectAllAnimations();
        this.showCommandFeedback('Selected all animated objects');
      } else if (commandLower.includes('object')) {
        this.selectAllObjects();
        this.showCommandFeedback('Selected all objects on canvas');
      } else {
        // Default behavior - select all animated objects
        this.selectAllAnimations();
        this.showCommandFeedback('Selected all animated objects');
      }
      commandRecognized = true;
    }
    // Undo command
    else if (commandLower.includes('undo')) {
      this.undoLastAction();
      this.showCommandFeedback('Undoing last action');
      commandRecognized = true;
    }
    // Redo command
    else if (commandLower.includes('redo')) {
      this.redoLastAction();
      this.showCommandFeedback('Redoing last action');
      commandRecognized = true;
    }
    
    // If no command was recognized
    if (!commandRecognized) {
      this.showCommandFeedback('Sorry, I didn\'t understand that command');
    }
  }
  
  /**
   * Deletes the currently selected items
   */
  deleteSelectedItems() {
    if (!this.canvas) return;
    
    // Check if something is selected
    const activeObj = this.canvas.getActiveObject();
    console.log("Attempting to delete selected items:", activeObj);
    
    if (activeObj) {
      try {
        // Try using the deleteSel function from toolbar.js
        if (typeof window.deleteSel === 'function') {
          console.log("Using window.deleteSel()");
          window.deleteSel(this.canvas);
          this.showCommandFeedback('Deleted selected items');
          return;
        }
        
        // Try using the deleteBtn click
        const deleteBtn = document.getElementById('deleteBtn');
        if (deleteBtn) {
          console.log("Clicking delete button");
          deleteBtn.click();
          this.showCommandFeedback('Deleted selected items');
          return;
        }
        
        // Manual deletion as a fallback
        console.log("Using manual deletion");
        
        if (activeObj.type === 'activeSelection') {
          // For multiple objects
          const objects = activeObj.getObjects();
          console.log(`Removing ${objects.length} objects`);
          
          // Use spread operator with remove() method, which should handle multiple objects
          this.canvas.remove(...objects);
          this.canvas.discardActiveObject();
        } else {
          // For single object
          console.log("Removing single object");
          this.canvas.remove(activeObj);
        }
        
        this.canvas.requestRenderAll();
        
        // Update history
        if (this.canvas.history && typeof this.canvas.history.saveState === 'function') {
          setTimeout(() => this.canvas.history.saveState(), 100);
        }
        
        this.showCommandFeedback('Deleted selected items');
      } catch (error) {
        console.error('Error during deletion:', error);
        this.showCommandFeedback('Error during deletion');
      }
    } else {
      this.showCommandFeedback('Nothing selected to delete');
    }
  }
  
  /**
   * Performs an undo operation
   */
  undoLastAction() {
    if (!this.canvas) return;
    
    // Check if the canvas has history functionality
    if (this.canvas.history && typeof this.canvas.history.undo === 'function') {
      this.canvas.history.undo();
      this.canvas.requestRenderAll();
    } else {
      // Try finding and clicking the undo button
      const undoBtn = document.getElementById('undoBtn');
      if (undoBtn) {
        undoBtn.click();
      } else {
        this.showCommandFeedback('Undo functionality not available');
      }
    }
  }
  
  /**
   * Performs a redo operation
   */
  redoLastAction() {
    if (!this.canvas) return;
    
    // Check if the canvas has history functionality
    if (this.canvas.history && typeof this.canvas.history.redo === 'function') {
      this.canvas.history.redo();
      this.canvas.requestRenderAll();
    } else {
      // Try finding and clicking the redo button
      const redoBtn = document.getElementById('redoBtn');
      if (redoBtn) {
        redoBtn.click();
      } else {
        this.showCommandFeedback('Redo functionality not available');
      }
    }
  }
  
  /**
   * Pauses all animations on the canvas
   */
  pauseAnimations() {
    if (!this.canvas) return;
    
    // Find all animated objects on the canvas
    const animatedObjects = this.canvas.getObjects().filter(obj => obj.isAnimated && obj.tween);
    
    // Pause each animation's tween
    animatedObjects.forEach(obj => {
      if (obj.tween && typeof obj.tween.pause === 'function') {
        // Use custom pause if available
        if (typeof obj.tween.customPause === 'function') {
          obj.tween.customPause();
        } else {
          obj.tween.pause();
        }
      }
    });
    
    // Update UI if we have a pause button
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) {
      pauseBtn.textContent = 'Resume';
    }
  }
  
  /**
   * Resumes all animations on the canvas
   */
  resumeAnimations() {
    if (!this.canvas) return;
    
    // Find all animated objects on the canvas
    const animatedObjects = this.canvas.getObjects().filter(obj => obj.isAnimated && obj.tween);
    
    // Resume each animation's tween
    animatedObjects.forEach(obj => {
      if (obj.tween && typeof obj.tween.resume === 'function') {
        // Use custom resume if available
        if (typeof obj.tween.customResume === 'function') {
          obj.tween.customResume();
        } else {
          obj.tween.resume();
        }
      }
    });
    
    // Update UI if we have a pause button
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) {
      pauseBtn.textContent = 'Pause';
    }
  }
  
  /**
   * Selects all animations on the canvas
   */
  selectAllAnimations() {
    if (!this.canvas) return;
    
    console.log('Selecting all animations');
    
    // Find all animated objects on the canvas
    const animatedObjects = this.canvas.getObjects().filter(obj => obj.isAnimated);
    console.log(`Found ${animatedObjects.length} animated objects`);
    
    if (animatedObjects.length > 0) {
      try {
        // Select them all
        if (animatedObjects.length === 1) {
          console.log('Selecting single animated object');
          this.canvas.setActiveObject(animatedObjects[0]);
        } else {
          console.log(`Selecting ${animatedObjects.length} animated objects as a group`);
          const selection = new fabric.ActiveSelection(animatedObjects, { canvas: this.canvas });
          this.canvas.setActiveObject(selection);
        }
        this.canvas.requestRenderAll();
        console.log('Selection complete and canvas rendered');
      } catch (error) {
        console.error('Error selecting animated objects:', error);
      }
    } else {
      console.log('No animated objects found on canvas');
    }
  }
  
  /**
   * Selects all objects on the canvas (animated and static)
   */
  selectAllObjects() {
    if (!this.canvas) return;
    
    console.log('Selecting all objects on canvas');
    
    // Get all objects on the canvas
    const allObjects = this.canvas.getObjects();
    console.log(`Found ${allObjects.length} total objects`);
    
    if (allObjects.length > 0) {
      try {
        // Filter out any non-selectable objects
        const selectableObjects = allObjects.filter(obj => obj.selectable !== false);
        console.log(`${selectableObjects.length} of these objects are selectable`);
        
        if (selectableObjects.length > 0) {
          // Select them all
          if (selectableObjects.length === 1) {
            console.log('Selecting single object');
            this.canvas.setActiveObject(selectableObjects[0]);
          } else {
            console.log(`Selecting ${selectableObjects.length} objects as a group`);
            const selection = new fabric.ActiveSelection(selectableObjects, { canvas: this.canvas });
            this.canvas.setActiveObject(selection);
          }
          this.canvas.requestRenderAll();
          console.log('Selection complete and canvas rendered');
        } else {
          console.log('No selectable objects found');
        }
      } catch (error) {
        console.error('Error selecting objects:', error);
      }
    } else {
      console.log('No objects found on canvas');
    }
  }
}