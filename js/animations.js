import { renderAnimationPanel } from "./animationPanel.js";

export const animationHandlers = {
  birds: animateBirds,
  apples: swayApples
};

export function animate(prompt, canvas, selected, options = {}, { save = true } = {}) {
  const key = Object.keys(animationHandlers).find(k => new RegExp(k, 'i').test(prompt));
  if (!key) return alert('Only birds or apples are supported.');

  canvas.activeAnimations ||= [];

  const reanimate = options.update && (options.data?.length !== 0);
  let all_changed = false;
  let animId = options.id || `${key}_${Date.now()}`;

  if (reanimate) {
    const existingIndex = canvas.activeAnimations.findIndex(a => a.id === options.id);

    if (existingIndex !== -1) {
      const anim = canvas.activeAnimations[existingIndex];
      
      // Create a set of all selected object IDs, including those in the same group
      const selectedIds = new Set();
      
      selected.forEach(obj => {
        // Add the object's ID
        selectedIds.add(obj.id);
        
        // If this is part of a group, also check for other objects in the same group
        if (obj.groupId) {
          const groupId = obj.groupId;
          // Find all objects with this group ID and add their IDs
          selected.forEach(o => {
            if (o.groupId === groupId) {
              selectedIds.add(o.id);
            }
          });
        }
      });
      
      // Filter out data entries for objects that are being reanimated
      const remainingData = anim.data.filter(d => {
        // Check if this data entry is for an object being reanimated
        if (selectedIds.has(d.id)) {
          return false;
        }
        
        // If this is a grouped object, check if its group is being reanimated
        if (d.groupId && selected.some(o => o.groupId === d.groupId)) {
          return false;
        }
        
        return true;
      });

      console.log('Remaining data:', remainingData);

      if (remainingData.length === 0) {
        canvas.activeAnimations.splice(existingIndex, 1);
        all_changed = true;
      } else if (remainingData.length !== anim.data.length) {
        canvas.activeAnimations[existingIndex].data = remainingData;
      }

      // reuse ID if full reanimation, otherwise assign new one
      animId = all_changed ? options.id : `${key}_${Date.now()}`;
    }
  }

  const animateFunc = animationHandlers[key];
  const result = animateFunc(canvas, selected, options);
  const { objects, data } = result;

  objects.forEach((obj, i) => {
    obj.id ||= fabric.Object.__uidCounter++;
  });

  data.forEach((entry, i) => {
    entry.id ||= objects[i]?.id;
  });

  const animationEntry = {
    id: animId,
    type: key,
    name: options.name || `${key} animation`,
    prompt,
    data
  };

  console.log('Animation entry:', animationEntry);
  console.log('Reanimate:', reanimate);
  console.log('All changed:', all_changed);

  canvas.activeAnimations.push(animationEntry);
  renderAnimationPanel(canvas);

  if (save && objects.length > 0) {
    setTimeout(() => canvas.history.saveState(), 20);
  }
}


export function animateBirds(canvas, selected, { data = [] } = {}) {
  // Group objects by groupId
  const groupedObjects = new Map(); // Map of groupId -> objects
  const singleObjects = []; // Objects that are not part of any group
  
  // Categorize objects
  selected.forEach(obj => {
    if (obj.groupId) {
      if (!groupedObjects.has(obj.groupId)) {
        groupedObjects.set(obj.groupId, []);
      }
      groupedObjects.get(obj.groupId).push(obj);
    } else {
      singleObjects.push(obj);
    }
  });
  
  // Calculate positions for all objects (each group will have just one position)
  const positions = [];
  const originalIds = [];
  
  // Process single objects
  singleObjects.forEach(obj => {
    const pt = obj.getCenterPoint();
    positions.push({ 
      x: pt.x, 
      y: pt.y, 
      color: obj.stroke || '#222',
      sourceId: obj.id
    });
    originalIds.push([obj.id]); // Each single object is its own entry
  });
  
  // Process grouped objects - one bird per group
  groupedObjects.forEach((members, groupId) => {
    // Calculate the center of the group
    let centerX = 0, centerY = 0;
    let primaryColor = '#222';
    
    members.forEach(obj => {
      const pt = obj.getCenterPoint();
      centerX += pt.x;
      centerY += pt.y;
      // Use the first colored object's stroke as the bird color
      if (obj.stroke && !primaryColor) {
        primaryColor = obj.stroke;
      }
    });
    
    centerX /= members.length;
    centerY /= members.length;
    
    positions.push({
      x: centerX,
      y: centerY,
      color: primaryColor,
      groupId: groupId,
      sourceIds: members.map(obj => obj.id)
    });
    
    // Store group member IDs for data tracking
    originalIds.push(members.map(obj => obj.id));
  });

  // Remove all original objects
  canvas.discardActiveObject();
  selected.forEach(o => canvas.remove(o));
  canvas.requestRenderAll();

  const birds = [];

  function createBirdAt(x, y, color, positionIndex) {
    const body = new fabric.Polygon(
      [{ x: 0, y: -6 }, { x: 8, y: 0 }, { x: 0, y: 6 }, { x: -8, y: 0 }],
      { fill: color, originX: 'center', originY: 'center' }
    );

    const wingL = new fabric.Triangle({ width: 14, height: 6, fill: color, left: -4, angle: -20, originX: 'center', originY: 'center' });
    const wingR = new fabric.Triangle({ width: 14, height: 6, fill: color, left: 4, angle: 200, originX: 'center', originY: 'center' });

    const padding = new fabric.Rect({
      width: 40,
      height: 40,
      fill: 'rgba(0,0,0,0)',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false
    });

    const bird = new fabric.Group([padding, body, wingL, wingR], {
      left: x,
      top: y,
      originX: 'center',
      originY: 'center',
      selectable: true,
      hasControls: false,
      hoverCursor: 'pointer'
    });

    bird.isAnimated = true;
    bird.animationType = 'bird';
    bird.originalLeft = x;
    bird.originalTop = y;
    
    // Store source object information
    const position = positions[positionIndex];
    if (position.groupId) {
      bird.groupId = position.groupId;
      bird.memberIds = position.sourceIds;
      bird.isGroupRepresentative = true;
    }

    canvas.add(bird);
    bird.setCoords();

    gsap.to([wingL, wingR], {
      angle: '+=40',
      duration: 0.3,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
      stagger: { each: 0.05 },
      onUpdate: canvas.requestRenderAll.bind(canvas)
    });

    return bird;
  }

  positions.forEach((p, i) => {
    const color = data[i]?.color || p.color;
    const bird = createBirdAt(p.x, p.y, color, i);
    birds.push(bird);
  });

  function setupFlocking(birds) {
    const vel = birds.map(() => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 }));

    const NEIGHBOR = 60;
    const MAX_SPEED = 2.5;
    const ALIGN_W = 0.05, COH_W = 0.02, SEP_W = 0.1;
    const BOUNDS = { w: canvas.getWidth(), h: canvas.getHeight() };

    function limit(v) {
      const m = Math.hypot(v.x, v.y);
      if (m > MAX_SPEED) {
        v.x = (v.x / m) * MAX_SPEED;
        v.y = (v.y / m) * MAX_SPEED;
      }
    }

    function update() {
      birds.forEach((b, i) => {
        let ax = 0, ay = 0, cx = 0, cy = 0, sx = 0, sy = 0, cnt = 0;

        birds.forEach((o, j) => {
          if (i === j) return;
          const dx = o.left - b.left;
          const dy = o.top - b.top;
          const d = Math.hypot(dx, dy);
          if (d < NEIGHBOR) {
            ax += vel[j].x; ay += vel[j].y;
            cx += o.left; cy += o.top;
            sx -= dx / d; sy -= dy / d;
            cnt++;
          }
        });

        if (cnt) {
          ax /= cnt; ay /= cnt;
          cx = cx / cnt - b.left;
          cy = cy / cnt - b.top;
        }

        vel[i].x += ax * ALIGN_W + cx * COH_W + sx * SEP_W;
        vel[i].y += ay * ALIGN_W + cy * COH_W + sy * SEP_W;
        limit(vel[i]);

        b.left += vel[i].x;
        b.top += vel[i].y;
        if (b.left < 0 || b.left > BOUNDS.w) {
          vel[i].x *= -1;
          b.left = Math.max(0, Math.min(BOUNDS.w, b.left));
        }
        if (b.top < 0 || b.top > BOUNDS.h) {
          vel[i].y *= -1;
          b.top = Math.max(0, Math.min(BOUNDS.h, b.top));
        }

        b.angle = Math.atan2(vel[i].y, vel[i].x) * 180 / Math.PI;
        b.setCoords();
      });

      canvas.requestRenderAll();
    }

    gsap.ticker.add(update);

    birds.forEach(b => {
      b.tween = {
        pause: () => gsap.ticker.remove(update),
        resume: () => gsap.ticker.add(update),
      };
    });
  }

  setupFlocking(birds);
  
  // Create data entries for each bird
  const birdData = birds.map((bird, i) => {
    const dataEntry = {
      id: bird.id,
      color: bird.fill || positions[i].color
    };
    
    // If this is a group representation, include the member info
    if (bird.isGroupRepresentative) {
      dataEntry.isGroup = true;
      dataEntry.groupId = bird.groupId;
      dataEntry.memberIds = bird.memberIds;
    }
    
    return dataEntry;
  });
  
  return {
    objects: birds,
    data: birdData
  };
}

export function swayApples(canvas, objs, { data = [] } = {}) {
  const drift = 10;
  const rock = 8;
  const dur = 1.2;

  canvas.discardActiveObject();
  
  // Group objects by their groupId
  const groupedObjects = new Map(); // Map of groupId -> objects
  const singleObjects = []; // Objects that are not part of any group
  const animatedObjects = []; // Objects that will be animated
  const processedData = []; // Data for animation tracking
  
  // First, categorize objects into groups or singles
  objs.forEach(obj => {
    if (obj.groupId) {
      if (!groupedObjects.has(obj.groupId)) {
        groupedObjects.set(obj.groupId, []);
      }
      groupedObjects.get(obj.groupId).push(obj);
    } else {
      singleObjects.push(obj);
    }
  });
  
  // Handle single objects (not in groups)
  singleObjects.forEach(obj => {
    const { x, y } = obj.getCenterPoint();
    obj.set({
      originX: 'center',
      originY: 'center',
      left: x,
      top: y,
      selectable: true
    });

    obj.isAnimated = true;
    obj.animationType = 'apple';
    obj.originalLeft = x;
    obj.swayX = 0;
    obj.swayAngle = 0;

    const tween = gsap.to(obj, {
      swayX: `+=${drift}`,
      swayAngle: `+=${rock}`,
      duration: dur,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
      onUpdate: () => {
        obj.set('left', obj.originalLeft + obj.swayX);
        obj.set('angle', obj.swayAngle);
        obj.setCoords();
        canvas.requestRenderAll();
      }
    });

    obj.tween = tween;
    animatedObjects.push(obj);
    
    // Add data entry for single object
    processedData.push({
      id: obj.id
    });
  });
  
  // Handle grouped objects - treat each group as one unit
  groupedObjects.forEach((groupMembers, groupId) => {
    // Calculate the center of the group
    let centerX = 0, centerY = 0;
    groupMembers.forEach(obj => {
      const point = obj.getCenterPoint();
      centerX += point.x;
      centerY += point.y;
    });
    centerX /= groupMembers.length;
    centerY /= groupMembers.length;
    
    // Create a Fabric.js Group from the objects
    const fabricGroup = new fabric.Group(groupMembers, {
      left: centerX,
      top: centerY,
      originX: 'center',
      originY: 'center',
      selectable: true
    });
    
    // Remove original objects from canvas
    groupMembers.forEach(obj => canvas.remove(obj));
    
    // Add group properties for animation
    fabricGroup.isAnimated = true;
    fabricGroup.animationType = 'apple';
    fabricGroup.originalLeft = centerX;
    fabricGroup.swayX = 0;
    fabricGroup.swayAngle = 0;
    fabricGroup.groupId = groupId;
    fabricGroup.memberIds = groupMembers.map(obj => obj.id);
    
    // Animate the group as a single unit
    const tween = gsap.to(fabricGroup, {
      swayX: `+=${drift}`,
      swayAngle: `+=${rock}`,
      duration: dur,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
      onUpdate: () => {
        fabricGroup.set('left', fabricGroup.originalLeft + fabricGroup.swayX);
        fabricGroup.set('angle', fabricGroup.swayAngle);
        fabricGroup.setCoords();
        canvas.requestRenderAll();
      }
    });
    
    fabricGroup.tween = tween;
    
    // Add the group to the canvas
    canvas.add(fabricGroup);
    fabricGroup.setCoords();
    
    animatedObjects.push(fabricGroup);
    
    // Add data entry for the group
    processedData.push({
      id: fabricGroup.id ||= fabric.Object.__uidCounter++,
      isGroup: true,
      groupId: groupId,
      memberIds: fabricGroup.memberIds
    });
  });

  return {
    objects: animatedObjects,
    data: processedData
  };
}
