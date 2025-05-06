// llmController.js - Handles LLM interaction for prompt parsing and animation creation

import { createInteraction } from './interactionPanel.js';

/**
 * LLM Controller for parsing animation commands
 * This controller processes user prompts through an LLM to create or modify animations
 */
export class LLMController {
  constructor(canvas) {
    this.canvas = canvas;
    this.apiEndpoint = 'https://api.openai.com/v1/chat/completions';
    this.apiKey = '<add api key here>'; // This will be set by the user
    this.isProcessing = false;
    this.model = 'gpt-4o';
    
    // Animation types supported by the system
    this.supportedAnimations = ['birds', 'sway', 'hop', 'fix'];
    
    // Interaction types supported by the system
    this.supportedInteractions = ['avoid', 'orbit'];
    
    // System prompt to explain the context to the LLM
    this.systemPrompt = `You are an animation assistant for AniMuse, a web-based animation tool. 
Your job is to interpret user prompts and convert them into specific animation commands.

The system supports these animation types:
- birds: Animated birds that flock together
- sway: Objects that sway gently side to side
- hop: Objects that hop up and down while moving horizontally
- fix: Static objects that don't animate but can be part of interactions

The system also supports these interaction types:
- avoid: One animation avoids another
- orbit: One animation orbits around another

The system provides you with context information about all objects on the canvas. Use this context to identify specific objects when the user refers to them by their properties (color, animation type, title, etc.).

For any user input, respond ONLY with a valid JSON object matching one of these formats:

1. For creating animations (objects are already selected):
{
  "action": "create",
  "animationType": "birds|sway|hop|fix",
  "targets": ["selected"],
  "title": "A short and relevant title based on the user's prompt",
  "parameters": {}
}

2. For interactions between animations:
{
  "action": "interact",
  "type": "avoid|orbit",
  "sourceAnimIds": ["id1", "id2"],
  "targetAnimIds": ["id3", "id4"],
  "parameters": {
    "type": "avoid|orbit"
  }
}

3. For selecting objects:
{
  "action": "select",
  "objectIds": ["id1", "id2", "id3"]
}

4. For deleting objects:
{
  "action": "delete",
  "objectIds": ["id1", "id2", "id3"]
}

5. If the command can't be understood:
{
  "error": "Explanation of the issue"
}

The "title" field for animations is very important - it should be:
- Based on the user's prompt intent (short and relevant)

For example:
- For "make birds fly around": "Flock of Birds"
- For "make apples sway": "Swinging Apples"
- For "hopping rabbits": "Bouncing Rabbits"
- For "stationary trees": "Trees"

Special command patterns to handle:
1. "Animate the current selection as X" or "Make the selection X" - If the user refers to animating the currently selected objects, use format #1 above with the appropriate animation type based on X.

2. "Select the X" - Use the context to find all objects that match the description X and respond with a "select" action.

3. "Delete the X" - Find objects matching X and create a "delete" action.

4. "Make X orbit/avoid Y" - Create an interaction between objects matching X and Y.

When handling selection, deletion, or interaction commands:
- Use the context to find objects matching user descriptions
- Include the exact IDs of objects for selection and deletion.
- Include the exact animation IDs for sources and targets in interactions.
- For example, if user says "select the red birds", find all objects in the context that have bird animation and red color, and include their IDs in the "objectIds" array
- For interactions, make sure to identify which objects are sources and which are targets

Do not include any text outside the JSON. Only respond with valid JSON. Do not even add triple backticks!!`;
  }

  /**
   * Set the API key for OpenAI
   * @param {string} apiKey - The OpenAI API key
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  /**
   * Process a user prompt through the LLM to generate an animation command
   * @param {string} userPrompt - The user's text prompt
   * @returns {Promise} - Promise that resolves with the parsed animation command
   */
  async processPrompt(userPrompt) {
    if (this.isProcessing) {
      return { error: 'Already processing a request' };
    }

    if (!this.apiKey) {
      // Fall back to mock responses if no API key is set
      console.warn('No API key set for LLM. Using mock responses.');
      return this.mockLLMResponse(userPrompt);
    }

    try {
      this.isProcessing = true;

      const context = this.getCanvasContext();
      
      // Prepare the request to the OpenAI API
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model, // Using GPT-4-Nano
          messages: [
            {
              role: 'system',
              content: this.systemPrompt
            },
            {
              role: 'user',
              content: `Prompt: ${userPrompt}\n\n Context:\n${JSON.stringify(context, null, 2)}`
            }
          ],
          temperature: 0.3, // Lower temperature for more predictable responses
          max_tokens: 500
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        return { error: `API Error: ${errorData.error?.message || 'Unknown error'}` };
      }

      const responseData = await response.json();
      
      // Extract the content from the response
      const rawContent = responseData.choices[0]?.message?.content;
      
      if (!rawContent) {
        return { error: 'No response from API' };
      }

      // Try to parse the JSON response
      try {
        const content = stripMarkdown(rawContent);
        const parsedCommand = JSON.parse(content);
        
        // Validate the response
        if (this.validateResponse(parsedCommand)) {
          return parsedCommand;
        } else {
          console.error('Invalid response from API:', parsedCommand);
          return { error: 'Invalid response format from AI' };
        }
      } catch (parseError) {
        console.error('Failed to parse API response as JSON:', content, parseError);
        return { error: 'Failed to parse AI response' };
      }
    } catch (error) {
      console.error('Error processing prompt with LLM:', error);
      return { error: 'Failed to process prompt: ' + error.message };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Validate the response from the LLM
   * @param {Object} response - The parsed response from the LLM
   * @returns {Boolean} - Whether the response is valid
   */
  validateResponse(response) {
    // Check for error response format
    if (response.error) {
      return true;
    }

    // Check for create animation format
    if (
      response.action === 'create' &&
      this.supportedAnimations.includes(response.animationType) &&
      Array.isArray(response.targets) &&
      typeof response.parameters === 'object'
    ) {
      return true;
    }

    // Check for interaction format
    if (
      response.action === 'interact' &&
      this.supportedInteractions.includes(response.type) &&
      Array.isArray(response.sourceAnimIds) &&
      Array.isArray(response.targetAnimIds) &&
      typeof response.parameters === 'object' &&
      this.supportedInteractions.includes(response.parameters.type)
    ) {
      return true;
    }
    
    // Check for selection format
    if (
      response.action === 'select' &&
      Array.isArray(response.objectIds)
    ) {
      return true;
    }
    
    // Check for deletion format
    if (
      response.action === 'delete' &&
      Array.isArray(response.objectIds)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Execute an animation command based on parsed LLM response
   * @param {Object} parsedCommand - The parsed command structure from the LLM
   * @returns {Object} - Result of the command execution
   */
  executeCommand(parsedCommand) {
    // Validate the command first
    if (!parsedCommand || parsedCommand.error) {
      return { success: false, message: parsedCommand.error || 'Invalid command' };
    }

    try {
      const { action } = parsedCommand;
      
      // Handle different command actions
      switch (action) {
        case 'create':
          const { animationType, targets, parameters, title } = parsedCommand;
          // Make sure to pass the title from the top level of parsedCommand
          const animationParams = { ...parameters };
          // Only set the title if it exists in the parsed command
          if (title) {
            animationParams.title = title;
          }
          return this.createAnimation(animationType, targets, animationParams);
        
        case 'modify':
          const { targets: modifyTargets, parameters: modifyParams } = parsedCommand;
          return this.modifyAnimation(modifyTargets, modifyParams);
        
        case 'interact':
          const { type, sourceAnimIds, targetAnimIds, parameters: interactParams } = parsedCommand;
          return this.createInteractionBetweenObjects(type, sourceAnimIds, targetAnimIds, interactParams);
        
        case 'select':
          const { objectIds: selectIds } = parsedCommand;
          return this.selectObjects(selectIds);
          
        case 'delete':
          const { objectIds: deleteIds } = parsedCommand;
          return this.deleteObjects(deleteIds);
          
        default:
          return { success: false, message: `Unknown action: ${action}` };
      }
    } catch (error) {
      console.error('Error executing command:', error);
      return { success: false, message: 'Error executing command' };
    }
  }

  /**
   * Create a new animation based on command
   * @param {string} animationType - Type of animation to create
   * @param {Array} targets - Target objects to animate
   * @param {Object} parameters - Animation parameters
   * @returns {Object} - Result of the animation creation
   */
  createAnimation(animationType, targets, parameters = {}) {
    // Validate animation type
    if (!this.supportedAnimations.includes(animationType)) {
      return { 
        success: false, 
        message: `Unsupported animation type: ${animationType}. Supported types: ${this.supportedAnimations.join(', ')}` 
      };
    }

    // Get selected objects from the canvas
    const selectedObjects = this.canvas.getActiveObjects();
    
    if (selectedObjects.length === 0) {
      return { success: false, message: 'No objects selected to animate' };
    }

    try {
        // Import animation function dynamically
        import('./animations.js').then(module => {
          // Call the animate function with the parsed parameters
          module.animate(animationType, this.canvas, selectedObjects, {
            ...parameters,
            title: parameters.title
          });
        });
      
      return { 
        success: true, 
        message: `Created ${animationType} animation for ${selectedObjects.length} objects` 
      };
    } catch (error) {
      console.error('Error creating animation:', error);
      return { success: false, message: 'Failed to create animation' };
    }
  }

  /**
   * Modify existing animations
   * @param {Array} targets - Target animations to modify
   * @param {Object} parameters - New parameters to apply
   * @returns {Object} - Result of the modification
   */
  modifyAnimation(targets, parameters = {}) {
    // This would be implemented to change color, speed, or other properties
    // of existing animations
    return { success: false, message: 'Animation modification not yet implemented' };
  }
  
  /**
   * Create an interaction between specified objects
   * @param {string} type - Interaction type ('avoid' or 'orbit')
   * @param {Array<string>} sourceIds - IDs of source objects
   * @param {Array<string>} targetIds - IDs of target objects
   * @param {Object} parameters - Interaction parameters
   * @returns {Object} - Result of the interaction creation
   */
  createInteractionBetweenObjects(type, sourceIds, targetIds, parameters = {}) {
    if (!this.supportedInteractions.includes(type)) {
      return { 
        success: false, 
        message: `Unsupported interaction type: ${type}. Supported types: ${this.supportedInteractions.join(', ')}` 
      };
    }
    // // Convert string IDs to integers
    // sourceIds = sourceIds.map(id => parseInt(id));
    // targetIds = targetIds.map(id => parseInt(id));

    // Filter out invalid IDs
    const validSourceIds = sourceIds.filter(id => this.canvas.activeAnimations.some(anim => anim.id === id));
    const validTargetIds = targetIds.filter(id => this.canvas.activeAnimations.some(anim => anim.id === id));

    if (validSourceIds.length === 0) {
      return { success: false, message: 'No valid source animations found with the provided IDs' };
    }

    if (validTargetIds.length === 0) {
      return { success: false, message: 'No valid target animations found with the provided IDs' };
    }

    try {

      validSourceIds.forEach(sourceId => {
        validTargetIds.forEach(targetId => {
          createInteraction(sourceId, targetId, type, this.canvas);
        });
      });
        
        return { 
          success: true, 
          message: `Created ${type} interaction between ${sourceIds.length} source animation(s) and ${targetIds.length} target animation(s)` 
        };
      }
      
      catch (error) {
        console.error('Error creating interaction:', error);
        return { success: false, message: 'Failed to create interaction: ' + error.message };
    }
  }
  
  /**
   * Select objects with the specified IDs
   * @param {Array<string>} objectIds - IDs of objects to select
   * @returns {Object} - Result of the selection
   */
  selectObjects(objectIds) {
    if (!Array.isArray(objectIds) || objectIds.length === 0) {
      return { success: false, message: 'No object IDs provided for selection' };
    }
    
    try {
      // Find objects with the provided IDs
      const allObjects = this.canvas.getObjects();
      const objectsToSelect = [];
      
      for (const id of objectIds) {
        const obj = allObjects.find(o => o.id === parseInt(id));
        if (obj) {
          objectsToSelect.push(obj);
        }
      }
      
      if (objectsToSelect.length === 0) {
        return { success: false, message: 'No objects found with the provided IDs' };
      }
      
      // First, clear current selection
      this.canvas.discardActiveObject();
      
      // If only one object, select it directly
      if (objectsToSelect.length === 1) {
        this.canvas.setActiveObject(objectsToSelect[0]);
      } else {
        // For multiple objects, create a selection group
        const selection = new fabric.ActiveSelection(objectsToSelect, { canvas: this.canvas });
        this.canvas.setActiveObject(selection);
      }
      
      // Update the canvas
      this.canvas.requestRenderAll();
      
      return { 
        success: true, 
        message: `Selected ${objectsToSelect.length} object(s)` 
      };
    } catch (error) {
      console.error('Error selecting objects:', error);
      return { success: false, message: 'Failed to select objects' };
    }
  }
  
  /**
   * Delete objects with the specified IDs
   * @param {Array<string>} objectIds - IDs of objects to delete
   * @returns {Object} - Result of the deletion
   */
  deleteObjects(objectIds) {
    if (!Array.isArray(objectIds) || objectIds.length === 0) {
      return { success: false, message: 'No object IDs provided for deletion' };
    }
    
    try {
      // Find objects with the provided IDs
      const allObjects = this.canvas.getObjects();
      const objectsToDelete = [];
      
      for (const id of objectIds) {
        const obj = allObjects.find(o => o.id === parseInt(id));
        if (obj) {
          objectsToDelete.push(obj);
        }
      }
      
      if (objectsToDelete.length === 0) {
        return { success: false, message: 'No objects found with the provided IDs' };
      }
      
      // First, clear current selection
      this.canvas.discardActiveObject();
      
      // Remove each object from the canvas
      objectsToDelete.forEach(obj => {
        this.canvas.remove(obj);
      });
      
      // Update the canvas
      this.canvas.requestRenderAll();
      
      // Update animation panels if needed
      if (typeof window.renderAnimationPanel === 'function') {
        window.renderAnimationPanel(this.canvas);
      }
      
      // Update interaction panels if needed
      if (typeof window.renderInteractionPanel === 'function') {
        window.renderInteractionPanel(this.canvas);
      }
      
      // Update history
      if (this.canvas.history && typeof this.canvas.history.saveState === 'function') {
        setTimeout(() => this.canvas.history.saveState(), 100);
      }
      
      return { 
        success: true, 
        message: `Deleted ${objectsToDelete.length} object(s)` 
      };
    } catch (error) {
      console.error('Error deleting objects:', error);
      return { success: false, message: 'Failed to delete objects' };
    }
  }

  /**
   * Extracts structured context of all canvas objects for LLM reasoning
   * Includes canvas objects, animations, and their relationships
   * @returns {Object} Canvas context with objects and animations
   */
  getCanvasContext() {
    if (!this.canvas || !this.canvas.getObjects) return { objects: [], animations: [] };

    // Get all objects on the canvas
    const objects = this.canvas.getObjects().map(obj => {
      // Only include color for birds
      let color = null;
      
      // Only process color for bird animations
      if (obj.animationType === 'birds') {
        if (obj.fill && obj.fill !== 'transparent' && obj.fill !== 'rgba(0,0,0,0)') {
          color = obj.fill;
        } else if (obj.stroke) {
          color = obj.stroke;
        }
        
        // Handle group objects (might contain children with different colors)
        if (obj.type === 'group' && (!color || color === 'transparent')) {
          const groupObjects = obj.getObjects();
          if (groupObjects.length > 0) {
            // Try to find a colored object in the group
            for (const groupObj of groupObjects) {
              if (groupObj.fill && groupObj.fill !== 'transparent') {
                color = groupObj.fill;
                break;
              } else if (groupObj.stroke) {
                color = groupObj.stroke;
                break;
              }
            }
          }
        }
        
        // Standardize color representation for birds
        if (color) {
          // Extract color name from color value if possible
          const colorNames = {
            '#ff0000': 'red',
            '#00ff00': 'green',
            '#0000ff': 'blue',
            '#ffff00': 'yellow',
            '#ff00ff': 'magenta',
            '#00ffff': 'cyan',
            '#000000': 'black',
            '#ffffff': 'white',
            'rgb(255, 0, 0)': 'red',
            'rgb(0, 255, 0)': 'green',
            'rgb(0, 0, 255)': 'blue',
            // Add more color mappings as needed
          };
          
          const normalizedColor = color.toLowerCase();
          if (colorNames[normalizedColor]) {
            color = colorNames[normalizedColor];
          }
        }
      }
      
      // Return object data, but only include color for birds
      return {
        id: obj.id || null,
        label: obj.label || obj.name || null,
        title: obj.title || null,
        color: obj.animationType === 'birds' ? color : null, // Only include color for birds
        groupId: obj.groupId || null,
        animationType: obj.animationType || 'static',
        isGroup: obj.type === 'group',
        isAnimated: obj.isAnimated || false,
        position: {
          x: obj.left,
          y: obj.top
        }
      };
    });
    
    // Get all animation data
    const animations = Array.isArray(this.canvas.activeAnimations) 
      ? this.canvas.activeAnimations.map(anim => {
          // Convert animation data to a simpler format
          return {
            id: anim.id || null,
            type: anim.type || null,
            title: anim.title || null,
            objectIds: Array.isArray(anim.data) 
              ? anim.data.map(d => d.id).filter(Boolean) 
              : []
          };
        })
      : [];
    
    // Get interaction data if available
    const interactions = Array.isArray(this.canvas.animationInteractions)
      ? this.canvas.animationInteractions.map(interaction => {
          return {
            type: interaction.type || null,
            sourceId: interaction.sourceId || null,
            targetId: interaction.targetId || null
          };
        })
      : [];

    const selectedObjects = this.canvas.getActiveObject()
    
    return {
      objects: objects,
      animations: animations,
      interactions: interactions,
      selectedObjects: selectedObjects
    };
  }

  /**
   * Mock LLM response for initial development or when API key is not available
   * @param {string} userPrompt - The user's text prompt
   * @returns {Promise<Object>} - Promise that resolves with a mock parsed command
   */
  async mockLLMResponse(userPrompt) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const prompt = userPrompt.toLowerCase();
    
    // Check for "animate the current selection as" or "make the selection" pattern
    const currentSelectionPattern = /animate\s+(the\s+)?(current\s+)?selection\s+(as|into|with|like)\s+/i;
    const makeSelectionPattern = /make\s+(the\s+)?(current\s+)?selection\s+/i;
    
    if (currentSelectionPattern.test(prompt) || makeSelectionPattern.test(prompt)) {
      // Determine the animation type from what follows
      let animationType = null;
      
      if (prompt.includes('bird') || prompt.includes('fly')) {
        animationType = 'birds';
      } else if (prompt.includes('sway') || prompt.includes('swing')) {
        animationType = 'sway';
      } else if (prompt.includes('hop') || prompt.includes('jump') || prompt.includes('bounce')) {
        animationType = 'hop';
      } else if (prompt.includes('fix') || prompt.includes('static') || prompt.includes('still')) {
        animationType = 'fix';
      }
      
      // If we could determine an animation type
      if (animationType) {
        // Generate a creative title based on the animation type
        let title;
        switch (animationType) {
          case 'birds':
            title = "Fluttering Flock";
            break;
          case 'sway':
            title = "Gentle Pendulum";
            break;
          case 'hop':
            title = "Bouncy Movement";
            break;
          case 'fix':
            title = "Stationary Object";
            break;
          default:
            title = `${animationType.charAt(0).toUpperCase() + animationType.slice(1)} Animation`;
        }
        
        return {
          action: 'create',
          animationType: animationType,
          targets: ['selected'],
          title: title,
          parameters: {}
        };
      }
    }
    
    // Simple pattern matching to simulate LLM understanding for other patterns
    if (prompt.includes('bird') || prompt.includes('fly')) {
      return {
        action: 'create',
        animationType: 'birds',
        targets: ['selected'],
        title: "Soaring Birds",
        parameters: {}
      };
    } else if (prompt.includes('apple') || prompt.includes('sway')) {
      return {
        action: 'create',
        animationType: 'sway',
        targets: ['selected'],
        title: "Swaying Rhythm",
        parameters: {}
      };
    } else if (prompt.includes('hop') || prompt.includes('jump') || prompt.includes('bounce')) {
      return {
        action: 'create',
        animationType: 'hop',
        targets: ['selected'],
        title: "Joyful Jumpers",
        parameters: {}
      };
    } else if (prompt.includes('fix') || prompt.includes('static') || prompt.includes('still')) {
      return {
        action: 'create',
        animationType: 'fix',
        targets: ['selected'],
        title: "Fixed Position",
        parameters: {}
      };
    } else if (prompt.includes('avoid') && (prompt.includes('make') || prompt.includes('create'))) {
      return {
        action: 'interact',
        type: 'avoid',
        sourceIds: [],
        targetIds: [],
        parameters: {
          type: 'avoid'
        }
      };
    } else if (prompt.includes('orbit') && (prompt.includes('make') || prompt.includes('create'))) {
      return {
        action: 'interact',
        type: 'orbit',
        sourceIds: [],
        targetIds: [],
        parameters: {
          type: 'orbit'
        }
      };
    } else {
      // Default to trying to extract an animation type
      for (const type of this.supportedAnimations) {
        if (prompt.includes(type)) {
          return {
            action: 'create',
            animationType: type,
            targets: ['selected'],
            title: `${type.charAt(0).toUpperCase() + type.slice(1)} Animation`,
            parameters: {}
          };
        }
      }
      
      // If no recognized pattern
      return {
        error: 'I couldn\'t understand that command. Try something like "make these birds fly" or "animate the selection as hopping rabbits".'
      };
    }
  }
}

/**
 * Strips Markdown code block wrappers from the response content
 * @param {string} raw - The raw response string from the LLM
 * @returns {string} Cleaned JSON string
 */
function stripMarkdown(raw) {
  return raw
    .replace(/^```(?:json)?\s*/i, '')  // remove opening ``` or ```json
    .replace(/\s*```$/, '')            // remove closing ```
    .trim();
}