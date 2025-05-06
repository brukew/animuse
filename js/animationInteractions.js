// animationInteractions.js - Handles interactions between animations

/**
 * Process all interactions for a given canvas
 * @param {Object} canvas - The Fabric.js canvas object
 */
export function processInteractions(canvas) {
  if (!canvas.animationInteractions || canvas.animationInteractions.length === 0) {
    return; // No interactions to process
  }
  
  // Process each interaction
  canvas.animationInteractions.forEach(interaction => {
    if (interaction.type === 'avoid') {
      processAvoidInteraction(canvas, interaction);
    }
    // Add other interaction types here as they're implemented
  });
}

/**
 * Process avoidance for a single animated object with its current movement
 * This is called for each animated object during the animation update
 * @param {Object} canvas - The Fabric.js canvas object 
 * @param {Object} animatedObj - The animated object (bird, hop, etc.)
 * @param {Object} velocity - The object's current velocity
 */
export function predictAndProcessAvoidance(canvas, animatedObj, velocity) {
  if (!canvas.animationInteractions || !animatedObj) return;
  
  // Find all "avoid" interactions
  const avoidInteractions = canvas.animationInteractions.filter(interaction => 
    interaction.type === 'avoid'
  );
  
  if (avoidInteractions.length === 0) return;
  
  avoidInteractions.forEach(interaction => {
    const { sourceId, targetId, parameters } = interaction;
    
    // Get the source and target animations
    const sourceAnim = canvas.activeAnimations.find(a => a.id === sourceId);
    const targetAnim = canvas.activeAnimations.find(a => a.id === targetId);
    
    if (!sourceAnim || !targetAnim) return;
    
    // See if this object belongs to either animation
    const objInSource = isObjectInAnimation(animatedObj, sourceAnim);
    const objInTarget = isObjectInAnimation(animatedObj, targetAnim);
    
    // If object is not in either animation, skip
    if (!objInSource && !objInTarget) return;
    
    // Determine which animation to avoid
    const avoidAnim = objInSource ? targetAnim : sourceAnim;
    
    // Get default parameters or use provided ones
    const boundaryDistance = parameters?.boundaryDistance || 30;
    const hopFactor = parameters?.hopStrength || 1.0;
    
    // Get all objects from the animation to avoid
    const avoidObjects = getObjectsFromAnimation(canvas, avoidAnim);
    
    // Check animation type and process accordingly
    if (animatedObj.animationType === 'bird') {
      // For birds, use the existing avoidance function
      processAvoidanceForBird(animatedObj, velocity, avoidObjects, boundaryDistance, hopFactor);
    } 
    else if (animatedObj.animationType === 'hop') {
      // For hop animations, handle direction change on collision
      processAvoidanceForHop(animatedObj, avoidObjects, boundaryDistance);
    }
    // Add other animation types as needed
  });
}

/**
 * Process an "avoid" interaction between animations
 * @param {Object} canvas - The Fabric.js canvas object
 * @param {Object} interaction - The interaction data object
 */
function processAvoidInteraction(canvas, interaction) {
  const { sourceId, targetId, parameters } = interaction;
  
  // Get the source and target animations
  const sourceAnim = canvas.activeAnimations.find(a => a.id === sourceId);
  const targetAnim = canvas.activeAnimations.find(a => a.id === targetId);
  
  if (!sourceAnim || !targetAnim) {
    console.warn('Could not find animations for interaction:', interaction);
    return;
  }
  
  // Get default parameters or use provided ones
  const boundaryDistance = parameters?.boundaryDistance || 30;
  const hopFactor = parameters?.hopStrength || 1.0; // How "bouncy" the walls are
  
  // Handle different animation type combinations
  if (sourceAnim.type === 'birds' || targetAnim.type === 'birds') {
    // Birds avoid something
    const birdsAnim = sourceAnim.type === 'birds' ? sourceAnim : targetAnim;
    const avoidAnim = birdsAnim === sourceAnim ? targetAnim : sourceAnim;
    
    // Get all objects from the animations
    const birdsObjects = getBirdsFromAnimation(canvas, birdsAnim);
    const avoidObjects = getObjectsFromAnimation(canvas, avoidAnim);
    
    if (birdsObjects.length === 0 || avoidObjects.length === 0) {
      return; // Nothing to avoid or no birds
    }
    
    // Apply boundary behavior to each bird
    birdsObjects.forEach(bird => {
      if (!bird || !bird._velocity) return;
      
      // Easier reference to the bird's velocity
      const vel = bird._velocity;
      
      // For each object to avoid (treat as wall/boundary)
      avoidObjects.forEach(obj => {
        // Calculate distance between bird and object
        const distance = calculateDistance(bird, obj);
        
        // If within boundary distance, apply wall response
        if (distance < boundaryDistance) {
          // Calculate normal vector (from object to bird)
          const nx = bird.left - obj.left;
          const ny = bird.top - obj.top;
          
          // Normalize the normal vector
          const normalLength = Math.sqrt(nx * nx + ny * ny);
          if (normalLength === 0) return; // Avoid division by zero
          
          const nnx = nx / normalLength;
          const nny = ny / normalLength;
          
          // Calculate dot product of velocity and normal
          const dotProduct = vel.x * nnx + vel.y * nny;
          
          // If the bird is moving toward the object
          if (dotProduct < 0) {
            // Reflect velocity vector across the normal (like a mirror)
            // The formula is: v' = v - 2(v·n)n
            const reflectionFactor = 2 * dotProduct * hopFactor;
            
            // Calculate new velocity (with some randomness to avoid getting stuck)
            const jitter = 0.1; // Small random factor to avoid perfect reflections
            
            vel.x = vel.x - reflectionFactor * nnx + (Math.random() * jitter - jitter/2);
            vel.y = vel.y - reflectionFactor * nny + (Math.random() * jitter - jitter/2);
            
            // Store reflection state to visualize if needed
            bird._reflectionPoint = {
              x: bird.left,
              y: bird.top,
              nx: nnx,
              ny: nny
            };
            
            // Move the bird slightly away from the boundary to prevent getting stuck
            bird.left += nnx * 2;
            bird.top += nny * 2;
          }
        }
      });
    });
  } 
  else if (sourceAnim.type === 'hop' || targetAnim.type === 'hop') {
    // Hop animations avoid something
    const hopAnim = sourceAnim.type === 'hop' ? sourceAnim : targetAnim;
    const avoidAnim = hopAnim === sourceAnim ? targetAnim : sourceAnim;
    
    // Get all objects
    const hopObjects = getObjectsFromAnimation(canvas, hopAnim);
    const avoidObjects = getObjectsFromAnimation(canvas, avoidAnim);
    
    if (hopObjects.length === 0 || avoidObjects.length === 0) {
      return; // Nothing to avoid or no hop objects
    }
    
    // Process avoidance for hop objects
    hopObjects.forEach(hopObj => {
      if (!hopObj || hopObj.animationType !== 'hop') return;
      
      // Apply avoidance logic for each hop object
      processAvoidanceForHop(hopObj, avoidObjects, boundaryDistance);
    });
  }
}

/**
 * Get all bird objects from a bird animation
 * @param {Object} canvas - The Fabric.js canvas
 * @param {Object} animation - The animation data object
 * @returns {Array} - Array of bird objects
 */
function getBirdsFromAnimation(canvas, animation) {
  if (animation.type !== 'birds') return [];
  
  // Get all IDs from the animation data
  const animObjectIds = new Set();
  animation.data.forEach(d => animObjectIds.add(d.id));
  
  // Find matching objects on the canvas
  return canvas.getObjects().filter(obj => 
    animObjectIds.has(obj.id) && obj.animationType === 'bird' && obj.tween
  );
}

/**
 * Get all objects from an animation
 * @param {Object} canvas - The Fabric.js canvas
 * @param {Object} animation - The animation data object
 * @returns {Array} - Array of objects
 */
function getObjectsFromAnimation(canvas, animation) {
  // Get all IDs from the animation data
  const animObjectIds = new Set();
  animation.data.forEach(d => animObjectIds.add(d.id));
  
  // Find matching objects on the canvas
  return canvas.getObjects().filter(obj => animObjectIds.has(obj.id));
}

/**
 * Calculate the distance between two objects
 * @param {Object} obj1 - First object
 * @param {Object} obj2 - Second object
 * @returns {Number} - Distance between the objects
 */
function calculateDistance(obj1, obj2) {
  const dx = obj1.left - obj2.left;
  const dy = obj1.top - obj2.top;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Checks if an object is part of an animation
 * @param {Object} obj - The object to check
 * @param {Object} animation - The animation data
 * @returns {Boolean} - True if the object is in the animation
 */
function isObjectInAnimation(obj, animation) {
  if (!obj || !animation || !animation.data) return false;
  
  // Check if obj.id is in animation.data[].id
  return animation.data.some(d => d.id === obj.id);
}

/**
 * Process boundary avoidance for a single bird
 * @param {Object} bird - The bird object
 * @param {Object} velocity - The bird's velocity
 * @param {Array} avoidObjects - Objects to avoid
 * @param {Number} boundaryDistance - How close the bird can get
 * @param {Number} hopFactor - How bouncy the walls are
 */
function processAvoidanceForBird(bird, velocity, avoidObjects, boundaryDistance, hopFactor) {
  if (!bird || !velocity || !avoidObjects || avoidObjects.length === 0) return;
  
  // Predict bird's next position with lookahead
  const lookaheadFactor = 3; // Look ahead 3 frames
  const predictX = bird.left + (velocity.x * lookaheadFactor);
  const predictY = bird.top + (velocity.y * lookaheadFactor);
  
  // For each object to avoid (treat as wall/boundary)
  avoidObjects.forEach(obj => {
    // Get bounding box for the object
    const bbox = getObjectBoundingBox(obj);
    if (!bbox) return;
    
    // Expand bounding box by boundary distance
    const expandedBox = {
      left: bbox.left - boundaryDistance,
      top: bbox.top - boundaryDistance,
      right: bbox.right + boundaryDistance,
      bottom: bbox.bottom + boundaryDistance
    };
    
    // Check if bird's predicted position is inside the expanded box
    if (predictX >= expandedBox.left && 
        predictX <= expandedBox.right && 
        predictY >= expandedBox.top && 
        predictY <= expandedBox.bottom) {
      
      // Calculate which edge is closest to determine reflection normal
      const distToLeft = Math.abs(predictX - expandedBox.left);
      const distToRight = Math.abs(predictX - expandedBox.right);
      const distToTop = Math.abs(predictY - expandedBox.top);
      const distToBottom = Math.abs(predictY - expandedBox.bottom);
      
      // Find the smallest distance to determine which edge was hit
      const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);
      
      let normal = { x: 0, y: 0 };
      
      // Set normal based on which edge was hit
      if (minDist === distToLeft) {
        normal.x = -1; // Hit left edge, normal points left
      } else if (minDist === distToRight) {
        normal.x = 1;  // Hit right edge, normal points right
      } else if (minDist === distToTop) {
        normal.y = -1; // Hit top edge, normal points up
      } else if (minDist === distToBottom) {
        normal.y = 1;  // Hit bottom edge, normal points down
      }
      
      // Calculate dot product of velocity and normal
      const dotProduct = velocity.x * normal.x + velocity.y * normal.y;
      
      // Only reflect if moving toward the object (negative dot product)
      if (dotProduct < 0) {
        // Reflect velocity across the normal
        const reflectionFactor = 2 * dotProduct * hopFactor;
        
        // Add small random variation to avoid perfect reflection loops
        const jitter = 0.1;
        const randomAngle = Math.random() * Math.PI * 2;
        const jitterX = Math.cos(randomAngle) * jitter;
        const jitterY = Math.sin(randomAngle) * jitter;
        
        // Apply the reflection to velocity
        velocity.x = velocity.x - reflectionFactor * normal.x + jitterX;
        velocity.y = velocity.y - reflectionFactor * normal.y + jitterY;
        
        // Move bird slightly away from boundary to prevent sticking
        bird.left += normal.x * 3;
        bird.top += normal.y * 3;
        
        // Store hop information for debugging
        bird._lasthop = {
          time: Date.now(),
          point: { x: bird.left, y: bird.top },
          normal: normal,
          reflected: { x: velocity.x, y: velocity.y }
        };
      }
    }
  });
}

/**
 * Process avoidance for a hopping object
 * @param {Object} hopObj - The hopping object
 * @param {Array} avoidObjects - Objects to avoid
 * @param {Number} boundaryDistance - How close the hop object can get
 */
function processAvoidanceForHop(hopObj, avoidObjects, boundaryDistance) {
  if (!hopObj || !avoidObjects || avoidObjects.length === 0) return;
  
  // For hop objects, we only care about horizontal movement and changing direction
  // Predict next position based on current direction
  const hopConfig = {
    speed: 4, // Should match the speed in the animation function
    boundaryPadding: 5
  };
  
  // Predict where the hop object will be in the next few frames
  const predictX = hopObj.left + (hopConfig.speed * hopObj.moveDirection * 3);
  
  // For each object to avoid
  avoidObjects.forEach(obj => {
    // Get bounding box for the object
    const bbox = getObjectBoundingBox(obj);
    if (!bbox) return;
    
    // Expand bounding box by boundary distance
    const expandedBox = {
      left: bbox.left - boundaryDistance,
      top: bbox.top - boundaryDistance,
      right: bbox.right + boundaryDistance,
      bottom: bbox.bottom + boundaryDistance
    };
    
    // Calculate vertical overlap (if any)
    const verticalOverlap = 
      hopObj.top + (hopObj.getScaledHeight() / 2) >= expandedBox.top &&
      hopObj.top - (hopObj.getScaledHeight() / 2) <= expandedBox.bottom;
    
    // Check if predicted horizontal position will hit the object
    // but only if there's vertical overlap (to avoid changing direction when object is above/below)
    if (verticalOverlap) {
      // Check if moving right and will hit the left edge of the object
      if (hopObj.moveDirection > 0 && 
          predictX + (hopObj.getScaledWidth() / 2) >= expandedBox.left && 
          hopObj.left + (hopObj.getScaledWidth() / 2) < expandedBox.left) {
        
        // Reverse direction
        hopObj.moveDirection = -1;
        
        // Move away from the boundary to prevent sticking
        hopObj.left = expandedBox.left - (hopObj.getScaledWidth() / 2) - 2;
        
        // Store collision information for debugging
        hopObj._lastCollision = {
          time: Date.now(),
          point: { x: hopObj.left, y: hopObj.top },
          edge: 'left',
          objectId: obj.id
        };
      }
      // Check if moving left and will hit the right edge of the object
      else if (hopObj.moveDirection < 0 && 
               predictX - (hopObj.getScaledWidth() / 2) <= expandedBox.right && 
               hopObj.left - (hopObj.getScaledWidth() / 2) > expandedBox.right) {
        
        // Reverse direction
        hopObj.moveDirection = 1;
        
        // Move away from the boundary to prevent sticking
        hopObj.left = expandedBox.right + (hopObj.getScaledWidth() / 2) + 2;
        
        // Store collision information for debugging
        hopObj._lastCollision = {
          time: Date.now(),
          point: { x: hopObj.left, y: hopObj.top },
          edge: 'right',
          objectId: obj.id
        };
      }
    }
  });
}

/**
 * Get the bounding box for an object or group
 * @param {Object} obj - The object to get the bounding box for
 * @returns {Object|null} - The bounding box {left, top, right, bottom} or null
 */
function getObjectBoundingBox(obj) {
  if (!obj) return null;
  
  // Check if it's a fabric.js group
  if ((obj.type === 'group' || obj.isGroupRepresentative) && obj.getObjects) {
    // If it's a group, calculate the bounding box of all its members
    const members = obj.getObjects();
    if (!members || members.length === 0) {
      return null;
    }
    
    // Start with extreme values
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    // Find min/max coordinates
    members.forEach(member => {
      if (member && typeof member.getBoundingRect === 'function') {
        const memberBox = member.getBoundingRect();
        minX = Math.min(minX, memberBox.left);
        minY = Math.min(minY, memberBox.top);
        maxX = Math.max(maxX, memberBox.left + memberBox.width);
        maxY = Math.max(maxY, memberBox.top + memberBox.height);
      }
    });
    
    // If we got valid coordinates
    if (minX !== Infinity && minY !== Infinity && maxX !== -Infinity && maxY !== -Infinity) {
      return {
        left: minX,
        top: minY,
        right: maxX,
        bottom: maxY
      };
    }
  } 
  // Regular object with getBoundingRect method
  else if (obj && typeof obj.getBoundingRect === 'function') {
    const rect = obj.getBoundingRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height
    };
  }
  
  // Fallback for objects without proper bounding rect
  if (obj && obj.left !== undefined && obj.top !== undefined) {
    const width = obj.getScaledWidth ? obj.getScaledWidth() : 20;
    const height = obj.getScaledHeight ? obj.getScaledHeight() : 20;
    
    return {
      left: obj.left - width/2,
      top: obj.top - height/2,
      right: obj.left + width/2,
      bottom: obj.top + height/2
    };
  }
  
  return null;
}