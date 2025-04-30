// animations.js
export function animateSelection(canvas, selected, strokes = []) {
  console.log("Animating selection: ", selected);
  const positions = selected.map(o => {
    const pt = o.getCenterPoint();
    return { x: pt.x, y: pt.y, color: o.stroke || '#222' };
  });
  canvas.discardActiveObject();
  selected.forEach(o => canvas.remove(o));
  canvas.requestRenderAll();

  const birds = [];
  const vel = [];
  const BOUNDS = { w: canvas.getWidth(), h: canvas.getHeight() };
  const NEIGHBOR = 60, MAX_SPEED = 2.5;
  const ALIGN_W = 0.05, COH_W = 0.02, SEP_W = 0.08;

  function createBirdAt(x, y, color) {
    const body = new fabric.Polygon(
      [{ x: 0, y: -6 }, { x: 8, y: 0 }, { x: 0, y: 6 }, { x: -8, y: 0 }],
      { fill: color, originX: 'center', originY: 'center' }
    );
    const wingL = new fabric.Triangle({ width: 14, height: 6, fill: color, left: -4, angle: -20, originX: 'center', originY: 'center' });
    const wingR = new fabric.Triangle({ width: 14, height: 6, fill: color, left: 4, angle: 200, originX: 'center', originY: 'center' });
    const bird = new fabric.Group([body, wingL, wingR], { left: x, top: y, selectable: true }); // <-- SELECTABLE!
    bird.isAnimated = true; // <-- custom flag
    bird.animationType = 'bird';
    canvas.add(bird);

    // wing flapping
    gsap.to([wingL, wingR], {
      angle: '+=40', duration: 0.3, yoyo: true, repeat: -1,
      ease: 'sine.inOut', stagger: { each: 0.05 },
      onUpdate: canvas.requestRenderAll.bind(canvas)
    });
    return bird;
  }

  function limit(v) {
    const m = Math.hypot(v.x, v.y);
    if (m > MAX_SPEED) { v.x = v.x / m * MAX_SPEED; v.y = v.y / m * MAX_SPEED; }
  }

  positions.forEach((p, i) => {
    const color = strokes[i] || p.color;
    birds.push(createBirdAt(p.x, p.y, color));
    vel.push({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 });
  });

  (function flock() {
    birds.forEach((b, i) => {
      let ax = 0, ay = 0, cx = 0, cy = 0, sx = 0, sy = 0, cnt = 0;
      birds.forEach((o, j) => {
        if (i === j) return;
        const dx = o.left - b.left, dy = o.top - b.top;
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
        cx = cx / cnt - b.left; cy = cy / cnt - b.top;
      }
      vel[i].x += ax * ALIGN_W + cx * COH_W + sx * SEP_W;
      vel[i].y += ay * ALIGN_W + cy * COH_W + sy * SEP_W;
      limit(vel[i]);

      b.left += vel[i].x;
      b.top += vel[i].y;
      if (b.left < 0 || b.left > BOUNDS.w) { vel[i].x *= -1; b.left = Math.max(0, Math.min(BOUNDS.w, b.left)); }
      if (b.top < 0 || b.top > BOUNDS.h) { vel[i].y *= -1; b.top = Math.max(0, Math.min(BOUNDS.h, b.top)); }
      b.angle = Math.atan2(vel[i].y, vel[i].x) * 180 / Math.PI;
    });
    canvas.requestRenderAll();
    requestAnimationFrame(flock);
  })();

  canvas.activeAnimations ||= [];
  birds.forEach((bird, idx) => {
    bird.id ||= fabric.Object.__uidCounter++;
  });
  canvas.activeAnimations.push({
    type: 'birds',
    data: birds.map((b, i) => ({
      id: b.id,
      color: strokes[i] || positions[i].color
    }))
  });
}

export function swayApples(canvas, objs) {
  const drift = 10;
  const rock = 8;
  const dur = 1.2;

  canvas.discardActiveObject();

  objs.forEach(o => {
    const { x, y } = o.getCenterPoint();
    console.log('swayApples', x, y);
    o.set({
      originX: 'center',
      originY: 'center',
      left: x,
      top: y,
      selectable: true
    });

    o.isAnimated = true;
    o.animationType = 'apple';
    o.originalLeft = x;
    o.swayX = 0;
    o.swayAngle = 0;

    const tween = gsap.to(o, {
      swayX: `+=${drift}`,
      swayAngle: `+=${rock}`,
      duration: dur,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
      onUpdate: () => {
        o.set('left', o.originalLeft + o.swayX);
        o.set('angle', o.swayAngle);
        o.setCoords();
        canvas.requestRenderAll();
      }
    });

    o.tween = tween;
  });

  canvas.activeAnimations ||= [];
  objs.forEach(obj => {
    obj.id ||= fabric.Object.__uidCounter++;
  });
  canvas.activeAnimations.push({
    type: 'apples',
    data: objs.map(o => ({ id: o.id }))
  });
}
