let spheres = [];
let draggingIndex = -1;
let prevMouseX, prevMouseY;
let scale3D = 1.1;

// Ma trận xoay tích lũy
let curRot; 

let center;
const CORD_LENGTH = 70; 
const BOND_RADIUS = 90;
let arialFont;

const OVAL_A = 36;
const OVAL_B = 27;
const OVAL_C = 27;
const RED_RADIUS = 36; 

let pointerOnSidebar = false;
let sphereIdCounter = 1;

let showAngle = false;
let angleRepresentatives = []; 

// Biến hỗ trợ kéo thả chính xác
let dragOffset = null;      
let dragPlaneNormal = null; 
let dragPlanePoint = null;  

let chargeEnabled = true;

function preload() {
  arialFont = loadFont('Arial.ttf');
}

function setup() {
  let cW = windowWidth - document.getElementById('sidebar').offsetWidth;
  let cH = windowHeight;
  let cnv = createCanvas(cW, cH, WEBGL);
  cnv.parent('canvas-container');
  setAttributes('antialias', true);
  
  center = createVector(0, 0, 0);
  
  // Khởi tạo ma trận xoay
  curRot = createIdentityMatrix();
  rotateMatrixX(curRot, 0.5);
  rotateMatrixY(curRot, -0.5);

  textFont(arialFont);
  textSize(25);
  textAlign(CENTER, CENTER);

  // Gán sự kiện nút
  document.getElementById('addSphereBtn').onclick = addSphere;
  document.getElementById('addSingleBondBtn').onclick = function () { addBondSphere("single"); }
  document.getElementById('addDoubleBondBtn').onclick = function () { addBondSphere("double"); }
  document.getElementById('addTripleBondBtn').onclick = function () { addBondSphere("triple"); }

  document.getElementById('toggleChargeBtn').onclick = function() {
    chargeEnabled = !chargeEnabled;
  };

  document.getElementById('toggleAngleBtn').onclick = function() {
    if (!showAngle) computeAllRepresentativeAngles();
    showAngle = !showAngle;
  };

  document.getElementById('resetBtn').onclick = resetSystem;

  const sidebar = document.getElementById('sidebar');
  sidebar.addEventListener('mouseenter', () => pointerOnSidebar = true);
  sidebar.addEventListener('mouseleave', () => pointerOnSidebar = false);

  renderObjectList();
  setAttributes('depth', true);
  setAttributes('alpha', false);
}

function createIdentityMatrix() {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ];
}

function resetSystem() {
  spheres = [];
  sphereIdCounter = 1;
  draggingIndex = -1;
  scale3D = 1.1;
  chargeEnabled = true;
  showAngle = false;
  angleRepresentatives = [];
  
  curRot = createIdentityMatrix();
  rotateMatrixX(curRot, 0.5);
  rotateMatrixY(curRot, -0.5);
  
  renderObjectList();
}

function addSphere() {
  let phi = random(0, PI), theta = random(0, TWO_PI);
  let r = CORD_LENGTH;
  let pos = sphericalToCartesian(r, theta, phi);
  spheres.push({
    pos: pos.copy(),
    velocity: createVector(0, 0, 0),
    negative: true,
    dragging: false,
    type: 'blue',
    id: sphereIdCounter++,
  });
  renderObjectList();
  if (showAngle) computeAllRepresentativeAngles();
}

function addBondSphere(bondType) {
  let phi = random(0, PI), theta = random(0, TWO_PI);
  let r = BOND_RADIUS;
  let pos = sphericalToCartesian(r, theta, phi);
  spheres.push({
    pos: pos.copy(),
    velocity: createVector(0, 0, 0),
    negative: true,
    dragging: false,
    type: "white",
    bondType: bondType,
    id: sphereIdCounter++,
  });
  renderObjectList();
  if (showAngle) computeAllRepresentativeAngles();
}

function draw() {
  background(0); 
  
  // Điều chỉnh ánh sáng môi trường xuống một chút để tăng độ tương phản
  ambientLight(150, 150, 150); 
  directionalLight(180, 180, 180, 0.5, 0.5, -1);
  directionalLight(80, 80, 100, -0.5, -0.5, 0.5); 

  scale(scale3D);

  push();
  applyMatrix(...curRot);

  drawCentralPoint();

  if (chargeEnabled) {
    balancePhysics(); 
    balancePhysics(); 
  }

  for (let i = 0; i < spheres.length; i++) drawSphere(i);
  for (let i = 0; i < spheres.length; i++) drawBond(i);

  if (chargeEnabled) {
    for (let i = 0; i < spheres.length; i++) {
      if (spheres[i].negative && spheres[i].type === "blue") {
        drawMinusLabel3D(spheres[i].pos);
      }
    }
  }

  if (showAngle) {
    angleRepresentatives.forEach(rep => {
      const [a, b] = rep.indices;
      if (spheres[a] && spheres[b]) drawAngleArc(a, b);
    });
  }

  pop();
}

// --- VẬT LÝ RÀNG BUỘC CỨNG (Hard Constraint) ---
function balancePhysics() {
  let negIdx = spheres.map((s, i) => s.negative ? i : -1).filter(i => i !== -1);
  if (negIdx.length < 2) return;
  
  const kCoulomb = 25000;  
  const damping = 0.92; 
  
  for (let aIdx = 0; aIdx < negIdx.length; aIdx++) {
    let ai = negIdx[aIdx];
    let sA = spheres[ai];
    
    if (sA.dragging) {
      sA.velocity.mult(0);
      continue;
    }

    let force = createVector(0, 0, 0);

    for (let bIdx = 0; bIdx < negIdx.length; bIdx++) {
      if (aIdx === bIdx) continue;
      let bi = negIdx[bIdx];
      let delta = p5.Vector.sub(sA.pos, spheres[bi].pos);
      let distSq = delta.magSq();
      distSq = max(distSq, 50); 
      
      let pushForce = delta.normalize().mult(kCoulomb / distSq);
      force.add(pushForce);
    }
    
    sA.velocity.add(force);       
    sA.velocity.mult(damping);    
    sA.velocity.limit(100);  
    sA.pos.add(sA.velocity);
    
    let targetRad = (sA.type === "white") ? BOND_RADIUS : CORD_LENGTH;
    sA.pos.setMag(targetRad);

    let normal = sA.pos.copy().normalize();
    let radialComp = p5.Vector.mult(normal, p5.Vector.dot(sA.velocity, normal));
    sA.velocity.sub(radialComp);
  }
}

// --- TƯƠNG TÁC CHUỘT ---

function projectOnTrackball(touchX, touchY) {
  let mouseOnBall = createVector(touchX, touchY, 0);
  let r = min(width, height) * 0.8; 
  mouseOnBall.x /= r;
  mouseOnBall.y /= r;
  
  let d = mouseOnBall.magSq();
  if (d <= 1.0) {
    mouseOnBall.z = Math.sqrt(1.0 - d);
  } else {
    mouseOnBall.normalize();
  }
  return mouseOnBall;
}

function getMouseRay() {
  let fov = PI / 3.0; 
  let distToCam = (height/2.0) / tan(fov/2.0); 
  
  let viewX = (mouseX - width/2);
  let viewY = (mouseY - height/2);
  
  viewX /= scale3D;
  viewY /= scale3D;
  let camZ = distToCam / scale3D;
  
  let rayDir = createVector(viewX, viewY, -camZ).normalize();
  let rayOrigin = createVector(0, 0, camZ);
  
  let invRot = [
    curRot[0], curRot[4], curRot[8], 0,
    curRot[1], curRot[5], curRot[9], 0,
    curRot[2], curRot[6], curRot[10], 0,
    0, 0, 0, 1
  ];
  
  let worldDir = matMultVec(invRot, rayDir).normalize();
  let worldOrigin = matMultVec(invRot, rayOrigin);
  
  return { origin: worldOrigin, dir: worldDir };
}

function intersectRayPlane(rayOrigin, rayDir, planePoint, planeNormal) {
  let denom = p5.Vector.dot(planeNormal, rayDir);
  if (abs(denom) > 1e-6) {
    let p0l0 = p5.Vector.sub(planePoint, rayOrigin);
    let t = p5.Vector.dot(p0l0, planeNormal) / denom;
    if (t >= 0) {
      return p5.Vector.add(rayOrigin, p5.Vector.mult(rayDir, t));
    }
  }
  return null;
}

function mousePressed() {
  if (pointerOnSidebar) return;
  prevMouseX = mouseX;
  prevMouseY = mouseY;

  let tmat = new p5.Matrix();
  tmat.scale(scale3D, scale3D, scale3D);
  let rotationM = new p5.Matrix();
  rotationM.mat4 = [...curRot]; 
  tmat.mult(rotationM); 
  let mx = mouseX - width / 2;
  let my = mouseY - height / 2;

  let bestIdx = findHitSphere(mx, my, tmat);
  
  if (bestIdx >= 0) {
    draggingIndex = bestIdx;
    spheres[bestIdx].dragging = true;
    spheres[bestIdx].velocity.mult(0);
    
    let camForward = createVector(curRot[2], curRot[6], curRot[10]); 
    dragPlaneNormal = camForward.copy(); 
    dragPlanePoint = spheres[bestIdx].pos.copy();
    
    let ray = getMouseRay();
    let intersect = intersectRayPlane(ray.origin, ray.dir, dragPlanePoint, dragPlaneNormal);
    
    if (intersect) {
      dragOffset = p5.Vector.sub(spheres[bestIdx].pos, intersect);
    } else {
      dragOffset = createVector(0,0,0);
    }
    dragObjDist = spheres[bestIdx].pos.mag();

  } else {
    draggingIndex = -1;
  }
}

function mouseDragged() {
  if (pointerOnSidebar) return;

  if (draggingIndex >= 0) {
    let ray = getMouseRay();
    let intersect = intersectRayPlane(ray.origin, ray.dir, dragPlanePoint, dragPlaneNormal);
    
    if (intersect) {
      let newPos = p5.Vector.add(intersect, dragOffset);
      let targetDist = (spheres[draggingIndex].type === "white") ? BOND_RADIUS : CORD_LENGTH;
      newPos.setMag(targetDist); 

      spheres[draggingIndex].pos = newPos;
      spheres[draggingIndex].velocity.mult(0); 
      
      if (showAngle) computeAllRepresentativeAngles();
    }
  } else {
    let v1 = projectOnTrackball(prevMouseX - width/2, prevMouseY - height/2);
    let v2 = projectOnTrackball(mouseX - width/2, mouseY - height/2);
    
    let axis = p5.Vector.cross(v1, v2);
    let angle = Math.acos(constrain(p5.Vector.dot(v1, v2), -1, 1));
    angle *= 2.5; 

    if (axis.mag() > 1e-4 && angle > 1e-4) {
      axis.normalize();
      let rotMat = createAxisAngleMatrix(axis, angle);
      curRot = multiplyMatrices(rotMat, curRot);
    }
  }

  prevMouseX = mouseX;
  prevMouseY = mouseY;
}

function mouseReleased() {
  if (pointerOnSidebar) return;
  if (draggingIndex >= 0) {
    spheres[draggingIndex].dragging = false;
    draggingIndex = -1;
    dragOffset = null;
    dragPlaneNormal = null;
  }
}

// --- HELPER MATH ---
function createAxisAngleMatrix(axis, angle) {
  let c = Math.cos(angle);
  let s = Math.sin(angle);
  let t = 1 - c;
  let x = axis.x, y = axis.y, z = axis.z;
  
  return [
    t*x*x + c,   t*x*y - s*z, t*x*z + s*y, 0,
    t*x*y + s*z, t*y*y + c,   t*y*z - s*x, 0,
    t*x*z - s*y, t*y*z + s*x, t*z*z + c,   0,
    0,           0,           0,           1
  ];
}

function multiplyMatrices(a, b) {
  let result = new Array(16).fill(0);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[row * 4 + k] * b[k * 4 + col];
      }
      result[row * 4 + col] = sum;
    }
  }
  return result;
}

function rotateMatrixX(mat, angle) {
  let c = Math.cos(angle);
  let s = Math.sin(angle);
  let temp = [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1];
  let res = multiplyMatrices(mat, temp); 
  for(let i=0; i<16; i++) mat[i] = res[i];
}

function rotateMatrixY(mat, angle) {
  let c = Math.cos(angle);
  let s = Math.sin(angle);
  let temp = [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1];
  let res = multiplyMatrices(mat, temp);
  for(let i=0; i<16; i++) mat[i] = res[i];
}

function rotateVectorAroundAxis(v, axis, angle) {
  let k = axis.copy().normalize();
  let cosA = Math.cos(angle);
  let sinA = Math.sin(angle);
  let term1 = p5.Vector.mult(v, cosA);
  let term2 = p5.Vector.cross(k, v).mult(sinA);
  let term3 = p5.Vector.mult(k, p5.Vector.dot(k, v) * (1 - cosA));
  return p5.Vector.add(p5.Vector.add(term1, term2), term3);
}

function findHitSphere(mx, my, tmat) {
  let bestIdx = -1;
  let minD = 1e9;
  for (let i = 0; i < spheres.length; i++) {
    let s = spheres[i], p = s.pos.copy();
    let s2d = worldToScreen(p, tmat);
    if (s.type === "white") {
      let radius = 27 * scale3D;
      let d = dist(s2d.x, s2d.y, mx, my);
      if (d <= radius && d < minD) {
        bestIdx = i; minD = d;
      }
    } else if (s.type === "blue") {
      let xx = (mx - s2d.x) / scale3D;
      let yy = (my - s2d.y) / scale3D;
      let ovalEq = (xx*xx)/(OVAL_A*OVAL_A) + (yy*yy)/(OVAL_B*OVAL_B);
      if (ovalEq <= 1.02 && dist(0,0,xx,yy) < minD) {
        bestIdx = i; minD = dist(0,0,xx,yy);
      }
    }
  }
  return bestIdx;
}

function computeAllRepresentativeAngles() {
  angleRepresentatives = [];
  const types = [
    {type: "white-white", filter: ["white","white"]},
    {type: "blue-white", filter: ["blue","white"]},
    {type: "blue-blue", filter: ["blue","blue"]}
  ];
  let used = new Set();
  types.forEach(({type,filter}) => {
    let minI = -1, minJ = -1, minD = 1e9;
    for (let i = 0; i < spheres.length; ++i) for (let j = i+1; j < spheres.length; ++j) {
      if (
        spheres[i].type === filter[0] && spheres[j].type === filter[1] &&
        !used.has(`${i},${j}`) && !used.has(`${j},${i}`)
      ) {
        let d = p5.Vector.dist(spheres[i].pos, spheres[j].pos);
        if (d < minD) { minD = d; minI = i; minJ = j; }
      }
    }
    if (minI != -1 && minJ != -1) {
      angleRepresentatives.push({type, indices:[minI,minJ]});
      used.add(`${minI},${minJ}`);
      used.add(`${minJ},${minI}`);
    }
  });
}

function drawCentralPoint() {
  push();
  noStroke();
  ambientMaterial(220, 30, 30);
  specularMaterial(50); 
  shininess(20); 
  sphere(RED_RADIUS, 64, 64);
  pop();
}

function drawSphere(idx) {
  let s = spheres[idx];
  let p = s.pos;
  push();
  translate(p.x, p.y, p.z);
  noStroke();

  if (s.type === 'blue') {
    ambientMaterial(30, 160, 255);
    specularMaterial(40); 
    shininess(30);
    let toCenter = p5.Vector.mult(p, -1).normalize();
    alignVectorToAxis(toCenter, createVector(1, 0, 0));
    ellipsoid(OVAL_A, OVAL_B, OVAL_C, 64, 64);
  } else if (s.type === 'white') {
    // SỬA: Giảm độ sáng Ambient để tạo khối 3D rõ hơn
    ambientMaterial(200, 200, 200);
    // Tăng độ phản chiếu ánh sáng (Specular)
    specularMaterial(150); 
    shininess(60); 
    sphere(27, 64, 64);
  } else {
    ambientMaterial(200);
    sphere(27, 64, 64);
  }
  pop();
}

function drawMinusLabel3D(pos) {
  push();
  translate(pos.x, pos.y, pos.z);
  
  let invRot = [
    curRot[0], curRot[4], curRot[8], 0,
    curRot[1], curRot[5], curRot[9], 0,
    curRot[2], curRot[6], curRot[10], 0,
    0, 0, 0, 1
  ];
  
  applyMatrix(...invRot);
  translate(0, 0, OVAL_A + 4); 
  
  fill(0);
  noStroke();
  textFont(arialFont);
  textSize(45);
  textAlign(CENTER, CENTER);
  text("-", 0, 0);
  
  pop();
}

function alignVectorToAxis(targetDir, fromAxis) {
  let axis = p5.Vector.cross(fromAxis, targetDir);
  let angle = Math.acos(constrain(p5.Vector.dot(fromAxis, targetDir), -1, 1));
  if (axis.mag() > 1e-6 && angle > 1e-4) {
    axis.normalize();
    rotate(angle, axis);
  } else if (angle > 1e-4) {
    let perp = Math.abs(fromAxis.x) < 0.9 ? createVector(1,0,0) : createVector(0,1,0);
    axis = p5.Vector.cross(fromAxis, perp).normalize();
    rotate(angle, axis);
  }
}

function drawBond(idx) {
  let s = spheres[idx];
  if (s.type !== "white") return;
  let color = "#fff"; 
  let A = center;
  let B = s.pos;
  if (s.bondType === "single") {
    drawBondBetweenPoints(A, B, color, 1, 4);
  } else if (s.bondType === "double") {
    drawBondBetweenPoints(A, B, color, 2, 4);
  } else if (s.bondType === "triple") {
    drawBondBetweenPoints(A, B, color, 3, 4);
  }
}
function drawBondBetweenPoints(A, B, color, num, radius = 4) {
  let d = p5.Vector.sub(B, A).mag();
  let bondVec = p5.Vector.sub(B, A).normalize();
  let mid = p5.Vector.add(A, B).mult(0.5);
  let gap = 7;
  let ortho = randomOrthogonal(bondVec);
  for (let i = 0; i < num; i++) {
    let offset = (num === 1) ? 0 : (i - (num-1)/2) * gap;
    let offVec = p5.Vector.mult(ortho, offset);
    push();
    translate(mid.x + offVec.x, mid.y + offVec.y, mid.z + offVec.z);
    orientCylinder(bondVec);
    ambientMaterial(200, 200, 200); 
    specularMaterial(20);
    shininess(10);
    noStroke();
    cylinder(radius, max(d, 2), 32, 1);
    pop();
  }
}

function orientCylinder(vec) {
  let v1 = createVector(0,1,0), v2 = vec.copy().normalize();
  let axis = v1.cross(v2);
  let angle = Math.acos(constrain(v1.dot(v2), -1, 1));
  if (axis.mag() > 1e-6 && angle > 1e-4) {
    axis.normalize();
    rotate(angle, axis);
  } else if (angle > 1e-4) {
    let perp = abs(v1.x) < 0.9 ? createVector(1,0,0) : createVector(0,1,0);
    axis = v1.cross(perp).normalize();
    rotate(angle, axis);
  }
}

function drawAngleArc(idxA, idxB) {
  let va = spheres[idxA].pos.copy();
  let vb = spheres[idxB].pos.copy();
  
  let minR = min(va.mag(), vb.mag());
  let rArc = minR * 1.15; 

  let a1 = p5.Vector.normalize(va);
  let a2 = p5.Vector.normalize(vb);
  
  let angle = acos(constrain(a1.dot(a2),-1,1));
  let steps = 36;
  
  let pts = [];
  for(let i=0; i<=steps; ++i) {
    let t = i/steps;
    let vInter = p5.Vector.slerp(a1, a2, t);
    pts.push(vInter.mult(rArc));
  }

  push();
  noFill();
  stroke(255, 225, 24);
  strokeWeight(5); 
  beginShape();
  for(const pt of pts) vertex(pt.x, pt.y, pt.z);
  endShape();

  strokeWeight(8);
  point(pts[0].x, pts[0].y, pts[0].z);
  point(pts[steps].x, pts[steps].y, pts[steps].z);

  let midVec = p5.Vector.slerp(a1, a2, 0.5);
  let midPt = midVec.copy().mult(rArc * 1.08); 

  fill(255, 225, 24);
  noStroke();
  textFont(arialFont);
  textSize(32);
  textAlign(CENTER, CENTER);
  let deg = degrees(angle);
  let str = nf(deg,1,1) + "°";
  
  push();
  translate(midPt.x, midPt.y, midPt.z);
  
  let invRot = [
    curRot[0], curRot[4], curRot[8], 0,
    curRot[1], curRot[5], curRot[9], 0,
    curRot[2], curRot[6], curRot[10], 0,
    0, 0, 0, 1
  ];
  applyMatrix(...invRot);
  
  text(str, 0, 0);
  pop();
  pop();
}

function windowResized() {
  let cW = windowWidth - document.getElementById('sidebar').offsetWidth;
  let cH = windowHeight;
  resizeCanvas(cW, cH);
}

function mouseWheel(event) {
  if (pointerOnSidebar) return;
  let s = scale3D - event.delta * 0.0007;
  scale3D = constrain(s, 0.18, 4);
}

function sphericalToCartesian(r, theta, phi) {
  let x = r * Math.sin(phi) * Math.cos(theta);
  let y = r * Math.sin(phi) * Math.sin(theta);
  let z = r * Math.cos(phi);
  return createVector(x, y, z);
}

function worldToScreen(pos, tmat) {
  let v = matMultVec(tmat, pos);
  let focal = (height / 2.0) / tan(PI / 6.0);
  let x = v.x * focal / (focal - v.z);
  let y = v.y * focal / (focal - v.z);
  return createVector(x, y);
}

function matMultVec(mat, vec) {
  let v = mat.mat4 || mat; 
  let x = vec.x, y = vec.y, z = vec.z, w = 1.0;
  let nx = v[0] * x + v[4] * y + v[8] * z + v[12] * w;
  let ny = v[1] * x + v[5] * y + v[9] * z + v[13] * w;
  let nz = v[2] * x + v[6] * y + v[10] * z + v[14] * w;
  let nw = v[3] * x + v[7] * y + v[11] * z + v[15] * w;
  if (nw !== 0 && nw !== 1) return createVector(nx / nw, ny / nw, nz / nw);
  return createVector(nx, ny, nz);
}

function randomOrthogonal(vec) {
  let rv = abs(vec.x) < 0.5 ? createVector(1, 0, 0) : createVector(0, 1, 0);
  let ortho = p5.Vector.cross(vec, rv).normalize();
  return ortho;
}

function renderObjectList() {
  const list = document.getElementById('objectList');
  list.innerHTML = "";
  spheres.forEach((s, idx) => {
    const div = document.createElement('div');
    div.className = "object-list-item";
    let label = "";
    if (s.type === "blue") label = "Oval #" + s.id;
    if (s.type === "white") {
      let loai = (s.bondType === "single") ? "LK đơn"
           : (s.bondType === "double") ? "LK đôi"
           : (s.bondType === "triple") ? "LK ba"
           : "Cầu trắng";
      label = loai + " #" + s.id;
    }
    const span = document.createElement('span');
    span.className = "object-list-label";
    span.textContent = label;

    const btn = document.createElement('button');
    btn.className = "object-x";
    btn.type = "button";
    btn.title = "Xóa";
    btn.textContent = "x";
    btn.onclick = () => {
      spheres.splice(idx, 1);
      renderObjectList();
      if (showAngle) computeAllRepresentativeAngles();
    };

    div.appendChild(span);
    div.appendChild(btn);
    list.appendChild(div);
  });
}

document.addEventListener('contextmenu', event => event.preventDefault());