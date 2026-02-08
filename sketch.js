// sketch.js — Geometry tuned: Oval sizes, Touch points & Expansion logic

let spheres = [];
let draggingIndex = -1;
let prevMouseX, prevMouseY;
let scale3D = 1.1;

// Ma trận xoay tích lũy
let curRot; 

let center;
const CORD_LENGTH = 80; 

// --- CẤU HÌNH BÁN KÍNH VÀ KÍCH THƯỚC ---
const RADIUS_WHITE = 115; // Khoảng cách từ tâm đến tâm cầu trắng
const RED_RADIUS = 36;    // Bán kính cầu đỏ (trung tâm)
const WHITE_SPHERE_RADIUS = 27; // Bán kính cầu trắng

// Tính toán kích thước Oval liên kết để vừa khít
// Gap = 115 - 36 - 27 = 52. => 2*A = 52 => A = 26.
const OVAL_A_STD = 26; 
const OVAL_B_STD = 21; // Tỉ lệ thẩm mỹ (khoảng 0.8 của A)
const OVAL_C_STD = 21;

// Vị trí tâm của Oval để đầu nhọn chạm mặt cầu đỏ: 36 + 26 = 62
const DIST_VISUAL_STD = RED_RADIUS + OVAL_A_STD; 

const PHYSICS_RADIUS = 80; // Bán kính dùng để tính toán vật lý (ẩn)

let arialFont;
let pointerOnSidebar = false;
let sphereIdCounter = 1;

let showAngle = false;
let showBondOvals = false; 
let ovalTransparent = true; 

let angleRepresentatives = []; 

// Biến hỗ trợ kéo thả
let dragOffset = null;      
let dragPlaneNormal = null; 
let dragPlanePoint = null;  

let realRepulsionEnabled = false;
let savingImage = false;
let showLabels = false;

function preload() {
  arialFont = loadFont('Arial.ttf');
}

function setup() {
  let cW = windowWidth - document.getElementById('sidebar').offsetWidth;
  let cH = windowHeight;
  let cnv = createCanvas(cW, cH, WEBGL);
  cnv.parent('canvas-container');
  
  setAttributes('antialias', true);
  setAttributes('alpha', true);
  setAttributes('depth', true);
  smooth();
  
  center = createVector(0, 0, 0);
  
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

  const btnRepulsion = document.getElementById('toggleRealRepulsionBtn');
  btnRepulsion.onclick = function() {
    realRepulsionEnabled = !realRepulsionEnabled;
    spheres.forEach(s => s.velocity.mult(0));
    this.innerText = realRepulsionEnabled ? "Tắt lực đẩy thật" : "Bật lực đẩy thật";
  };

  const btnAngle = document.getElementById('toggleAngleBtn');
  btnAngle.onclick = function() {
    if (!showAngle) computeAllRepresentativeAngles();
    showAngle = !showAngle;
    this.innerText = showAngle ? "Ẩn giá trị góc" : "Hiện giá trị góc";
  };
  
  const btnBondOval = document.getElementById('toggleBondOvalBtn');
  btnBondOval.onclick = function() {
    showBondOvals = !showBondOvals;
    this.innerText = showBondOvals ? "Tắt oval liên kết" : "Bật oval liên kết";
  };

  const btnOvalTransparency = document.getElementById('toggleOvalTransparencyBtn');
  btnOvalTransparency.onclick = function() {
    ovalTransparent = !ovalTransparent;
    this.innerText = ovalTransparent ? "Tắt trong suốt oval" : "Bật trong suốt oval";
  };

  const btnLabels = document.getElementById('toggleLabelsBtn');
  btnLabels.onclick = function() {
    showLabels = !showLabels;
    this.innerText = showLabels ? "Tắt nhãn" : "Bật nhãn";
  };

  document.getElementById('saveImageBtn').onclick = saveImage4K;
  document.getElementById('resetBtn').onclick = resetSystem;

  const sidebar = document.getElementById('sidebar');
  sidebar.addEventListener('mouseenter', () => pointerOnSidebar = true);
  sidebar.addEventListener('mouseleave', () => pointerOnSidebar = false);

  renderObjectList();
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
  realRepulsionEnabled = false;
  showAngle = false;
  showBondOvals = false; 
  ovalTransparent = true;
  angleRepresentatives = [];
  showLabels = false;
  
  curRot = createIdentityMatrix();
  rotateMatrixX(curRot, 0.5);
  rotateMatrixY(curRot, -0.5);
  
  document.getElementById('toggleRealRepulsionBtn').innerText = "Bật lực đẩy thật";
  document.getElementById('toggleAngleBtn').innerText = "Hiện giá trị góc";
  document.getElementById('toggleBondOvalBtn').innerText = "Bật oval liên kết";
  document.getElementById('toggleOvalTransparencyBtn').innerText = "Tắt trong suốt oval";
  document.getElementById('toggleLabelsBtn').innerText = "Bật nhãn";
  
  renderObjectList();
}

function addSphere() {
  let phi = random(0, PI), theta = random(0, TWO_PI);
  // Dùng RADIUS_WHITE làm bán kính sinh ra để tránh va chạm ngay lập tức
  let r = 90; 
  let pos = sphericalToCartesian(r, theta, phi);
  spheres.push({
    pos: pos.copy(),
    velocity: createVector(0, 0, 0),
    negative: true,
    dragging: false,
    type: 'blue', // LP
    id: sphereIdCounter++,
  });
  renderObjectList();
  if (showAngle) computeAllRepresentativeAngles();
}

function addBondSphere(bondType) {
  let phi = random(0, PI), theta = random(0, TWO_PI);
  let r = RADIUS_WHITE; 
  let pos = sphericalToCartesian(r, theta, phi);
  spheres.push({
    pos: pos.copy(),
    velocity: createVector(0, 0, 0),
    negative: true,
    dragging: false,
    type: "white", // BP
    bondType: bondType,
    id: sphereIdCounter++,
  });
  renderObjectList();
  if (showAngle) computeAllRepresentativeAngles();
}

function draw() {
  if (savingImage) {
    clear(); 
  } else {
    background(0); 
  }
  
  ambientLight(150, 150, 150); 
  directionalLight(180, 180, 180, 0.5, 0.5, -1);
  directionalLight(80, 80, 100, -0.5, -0.5, 0.5); 

  scale(scale3D);

  push();
  applyMatrix(...curRot);

  drawCentralPoint();
  if (showLabels) {
    draw3DLabel(center, 'A', RED_RADIUS);
  }

  balancePhysics(); 
  
  for (let i = 0; i < spheres.length; i++) drawBond(i);
  
  for (let i = 0; i < spheres.length; i++) {
    drawSphere(i);
    if (showLabels && spheres[i].type === 'white') {
      draw3DLabel(spheres[i].pos, 'X', WHITE_SPHERE_RADIUS);
    }
  }

  // Luôn cập nhật danh sách góc khi đang hiển thị để phản hồi theo thời gian thực
  if (showAngle) {
    computeAllRepresentativeAngles();
    angleRepresentatives.forEach(rep => {
      const [a, b] = rep.indices;
      if (spheres[a] && spheres[b]) drawAngleArc(a, b);
    });
  }

  pop();

  if (savingImage) {
    let timestamp = year() + nf(month(), 2) + nf(day(), 2) + '_' + 
                    nf(hour(), 2) + nf(minute(), 2) + nf(second(), 2);
    saveCanvas('molecule_4K_' + timestamp, 'png');
    pixelDensity(1);
    savingImage = false;
  }
}

function draw3DLabel(pos, str, objRadius) {
  push();
  translate(pos.x, pos.y, pos.z);

  let invRot = [
    curRot[0], curRot[4], curRot[8], 0,
    curRot[1], curRot[5], curRot[9], 0,
    curRot[2], curRot[6], curRot[10], 0,
    0, 0, 0, 1
  ];
  applyMatrix(...invRot);

  translate(0, 0, objRadius + 25); 

  fill(0);          
  stroke(255);      
  strokeWeight(2);  
  
  emissiveMaterial(0); 
  
  textSize(28);
  textAlign(CENTER, CENTER);
  text(str, 0, 0);

  pop();
}

function saveImage4K() {
  let targetWidth = 3840;
  let currentWidth = width;
  let densityRatio = min(targetWidth / currentWidth, 4);
  pixelDensity(densityRatio);
  savingImage = true;
}

// --- VẬT LÝ ---
function balancePhysics() {
  let negIdx = spheres.map((s, i) => s.negative ? i : -1).filter(i => i !== -1);
  if (negIdx.length < 2) return;
  
  const BASE_K = realRepulsionEnabled ? 45000 : 25000;
  let currentDamping = (draggingIndex >= 0) ? 0.88 : (realRepulsionEnabled ? 0.91 : 0.94); 
  
  for (let aIdx = 0; aIdx < negIdx.length; aIdx++) {
    let ai = negIdx[aIdx];
    let sA = spheres[ai];
    
    if (sA.dragging) {
      sA.velocity.mult(0);
      continue;
    }

    let force = createVector(0, 0, 0);

    let dirA = sA.pos.copy().normalize(); 
    let virtualPosA = dirA.copy().mult(PHYSICS_RADIUS);

    for (let bIdx = 0; bIdx < negIdx.length; bIdx++) {
      if (aIdx === bIdx) continue;
      let bi = negIdx[bIdx];
      let sB = spheres[bi];

      let dirB = sB.pos.copy().normalize();
      let virtualPosB = dirB.copy().mult(PHYSICS_RADIUS);

      let delta = p5.Vector.sub(virtualPosA, virtualPosB);
      let distSq = delta.magSq();
      
      let minD = (draggingIndex >= 0) ? 100 : (realRepulsionEnabled ? 25 : 40);
      distSq = max(distSq, minD); 
      
      let kFactor = 1.0;
      if (realRepulsionEnabled) {
        let typeA = sA.type; 
        let typeB = sB.type; 
        if (typeA === 'blue' && typeB === 'blue') kFactor = 2.5; 
        else if ((typeA === 'blue' && typeB === 'white') || (typeA === 'white' && typeB === 'blue')) kFactor = 1.7; 
        else kFactor = 1.0; 
      } else {
        kFactor = 1.0; 
      }

      let interactionFactor = (draggingIndex >= 0) ? 0.5 : 1.0;
      let magnitude = (BASE_K * kFactor * interactionFactor) / distSq;
      magnitude = min(magnitude, 600); 

      let pushDir = delta.normalize();
      let pushForce = pushDir.mult(magnitude);
      force.add(pushForce);
    }
    
    sA.velocity.add(force);       
    sA.velocity.mult(currentDamping);    
    sA.velocity.limit(realRepulsionEnabled ? 80 : 60);  
    sA.pos.add(sA.velocity);
    
    // Ràng buộc khoảng cách vật lý (ẩn)
    let targetRad = (sA.type === 'white') ? RADIUS_WHITE : PHYSICS_RADIUS;
    sA.pos.setMag(targetRad);

    let normal = sA.pos.copy().normalize();
    let radialComp = p5.Vector.mult(normal, p5.Vector.dot(sA.velocity, normal));
    sA.velocity.sub(radialComp);
  }
}

// --- TƯƠNG TÁC CHUỘT ---
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
      let dest = p5.Vector.add(intersect, dragOffset);
      
      let targetR = (spheres[draggingIndex].type === 'white') ? RADIUS_WHITE : PHYSICS_RADIUS;
      dest.setMag(targetR); 

      // Dùng lerp để di chuyển mượt mà
      spheres[draggingIndex].pos.lerp(dest, 0.2); 
      spheres[draggingIndex].velocity.mult(0); 
      
      if (showAngle) computeAllRepresentativeAngles();
    }
  } else {
    let dx = mouseX - prevMouseX;
    let dy = mouseY - prevMouseY;
    
    if (dx !== 0 || dy !== 0) {
      let sensitivity = 0.01; // Độ nhạy xoay
      let distance = Math.sqrt(dx * dx + dy * dy);
      let rotationAxisScreen = createVector(dy, -dx, 0).normalize();
      let rotationAxisWorld = createVector(
        curRot[0] * rotationAxisScreen.x + curRot[1] * rotationAxisScreen.y + curRot[2] * rotationAxisScreen.z,
        curRot[4] * rotationAxisScreen.x + curRot[5] * rotationAxisScreen.y + curRot[6] * rotationAxisScreen.z,
        curRot[8] * rotationAxisScreen.x + curRot[9] * rotationAxisScreen.y + curRot[10] * rotationAxisScreen.z
      ).normalize();
      let angle = distance * sensitivity;
      let rotMatrix = createAxisAngleMatrix(rotationAxisWorld, angle);
      curRot = multiplyMatrices(rotMatrix, curRot);
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

// helper math (unchanged)
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
      // Vùng hit đơn giản hóa cho oval
      let ovalEq = (xx*xx)/(OVAL_A_STD*OVAL_A_STD) + (yy*yy)/(OVAL_B_STD*OVAL_B_STD);
      if (ovalEq <= 1.2 && dist(0,0,xx,yy) < minD) {
        bestIdx = i; minD = dist(0,0,xx,yy);
      }
    }
  }
  return bestIdx;
}

// LOGIC MỚI: Nhóm các góc và loại bỏ góc tổng hợp (Composite Angles)
// Ví dụ: Nếu có góc A-B = 90 và B-C = 90, thì góc A-C = 180 sẽ bị ẩn đi.
function computeAllRepresentativeAngles() {
  angleRepresentatives = [];
  let allPairs = [];
  
  // 1. Tính toán tất cả các cặp góc thô
  for (let i = 0; i < spheres.length; i++) {
    for (let j = i + 1; j < spheres.length; j++) {
      let v1 = spheres[i].pos.copy().normalize();
      let v2 = spheres[j].pos.copy().normalize();
      let dot = constrain(v1.dot(v2), -1, 1);
      let angleDeg = degrees(Math.acos(dot));

      let t1 = spheres[i].type;
      let t2 = spheres[j].type;
      let typeStr = (t1 < t2) ? `${t1}-${t2}` : `${t2}-${t1}`;

      allPairs.push({
        indices: [i, j],
        angle: angleDeg,
        type: typeStr,
        visible: true // Mặc định hiển thị
      });
    }
  }

  // Helper: Tìm cặp góc giữa 2 index
  const getPair = (idx1, idx2) => {
    return allPairs.find(p => 
      (p.indices[0] === idx1 && p.indices[1] === idx2) || 
      (p.indices[0] === idx2 && p.indices[1] === idx1)
    );
  };

  // 2. Lọc bỏ góc tổng hợp (Composite Check)
  // Duyệt qua tất cả các bộ 3 điểm (i, j, k). 
  // Nếu góc(i,k) xấp xỉ góc(i,j) + góc(j,k) thì ẩn góc(i,k).
  for (let i = 0; i < spheres.length; i++) {
    for (let k = i + 1; k < spheres.length; k++) {
      let pairIK = getPair(i, k);
      if (!pairIK) continue;
      
      // Thử tìm một vector trung gian 'j'
      for (let j = 0; j < spheres.length; j++) {
        if (j === i || j === k) continue;
        
        let pairIJ = getPair(i, j);
        let pairJK = getPair(j, k);
        
        if (pairIJ && pairJK) {
          let sumAngles = pairIJ.angle + pairJK.angle;
          // Cho phép sai số khoảng 3.5 độ
          if (Math.abs(pairIK.angle - sumAngles) < 3.5) {
            pairIK.visible = false;
            break; // Đã tìm thấy thành phần con, ẩn góc lớn này đi
          }
        }
      }
    }
  }

  // 3. Gom nhóm (Grouping) các góc còn lại (visible) theo Type + Value
  let foundGroups = []; 
  for (let p of allPairs) {
    if (!p.visible) continue;

    // Kiểm tra xem đã có nhóm nào cùng Type và cùng Angle (xấp xỉ) chưa
    let exists = foundGroups.find(g => 
      g.type === p.type && Math.abs(g.angle - p.angle) < 3.0
    );

    if (!exists) {
      let newGroup = {
        type: p.type,
        angle: p.angle,
        indices: p.indices
      };
      foundGroups.push(newGroup);
      angleRepresentatives.push(newGroup);
    }
    // Nếu đã exists thì chỉ là bản sao (ví dụ 120 độ thứ 2, thứ 3...), không cần thêm.
  }
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

function drawElectron3D(x, y, z) {
  push();
  translate(x, y, z);
  noStroke();
  let c = color(255, 80, 80); 
  ambientMaterial(c); 
  emissiveMaterial(255, 60, 60);
  specularMaterial(255, 220, 220);
  shininess(180);
  fill(c); 
  sphere(5, 64, 64);
  pop();
}

function drawSphere(idx) {
  let s = spheres[idx];
  
  if (s.type === 'blue') {
    // Tách biệt vị trí vật lý và vị trí hiển thị
    // Vị trí vật lý: s.pos (để tính toán góc đẩy)
    // Vị trí hiển thị: dir * visualDist (để đảm bảo tiếp xúc hình học)
    let dir = s.pos.copy().normalize();
    
    let currentA = realRepulsionEnabled ? OVAL_A_STD * 1.3 : OVAL_A_STD;
    let currentB = realRepulsionEnabled ? OVAL_B_STD * 1.3 : OVAL_B_STD;
    let currentC = realRepulsionEnabled ? OVAL_C_STD * 1.3 : OVAL_C_STD;
    
    // Tính khoảng cách để đầu nhọn chạm vào bề mặt cầu đỏ (bán kính 36)
    let visualDist = RED_RADIUS + currentA; 
    let visualPos = dir.copy().mult(visualDist);

    push();
    translate(visualPos.x, visualPos.y, visualPos.z);
    noStroke();

    let toCenter = dir.copy().mult(-1);
    alignVectorToAxis(toCenter, createVector(1, 0, 0));

    push();
    let distFromAxis = 8; 
    drawElectron3D(0, distFromAxis, 0);
    drawElectron3D(0, -distFromAxis, 0);
    pop();
    
    if (ovalTransparent) {
      push();
      ambientMaterial(20, 140, 235);
      specularMaterial(80, 180, 255);
      shininess(50);
      fill(20, 140, 235, 50);
      ellipsoid(currentA, currentB, currentC, 64, 64);
      pop();
      
      push();
      ambientMaterial(10, 80, 150);
      noLights();
      fill(10, 80, 150, 30);
      ellipsoid(currentA * 0.75, currentB * 0.75, currentC * 0.75, 48, 48);
      pop();
    } else {
      push();
      ambientMaterial(20, 140, 235);
      specularMaterial(120, 200, 255);
      shininess(80);
      fill(20, 140, 235, 255);
      ellipsoid(currentA, currentB, currentC, 64, 64);
      pop();
    }
    pop();

  } else if (s.type === 'white') {
    push();
    translate(s.pos.x, s.pos.y, s.pos.z);
    noStroke();
    ambientMaterial(200, 200, 200);
    specularMaterial(150); 
    shininess(60); 
    sphere(WHITE_SPHERE_RADIUS, 64, 64);
    pop();
  }
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

  if (showBondOvals) {
    push();
    
    let dir = B.copy().normalize();
    
    // Tính toán vị trí oval liên kết
    // Tâm cầu đỏ (0) -> Bán kính đỏ (36) -> Oval A=26 (Chiều dài 52) -> Mặt trắng
    // Tâm Oval nằm ở 36 + 26 = 62.
    let ovalPos = dir.copy().mult(DIST_VISUAL_STD);
    
    translate(ovalPos.x, ovalPos.y, ovalPos.z);
    
    let toCenter = dir.copy().mult(-1);
    alignVectorToAxis(toCenter, createVector(1, 0, 0));
    
    let distY = 8;
    let distZ = 8;
    
    if (s.bondType === "single") {
      drawElectron3D(0, distY, 0);
      drawElectron3D(0, -distY, 0);
    } 
    else if (s.bondType === "double") {
      drawElectron3D(0, distY, 0);
      drawElectron3D(0, -distY, 0);
      drawElectron3D(0, 0, distZ);
      drawElectron3D(0, 0, -distZ);
    } 
    else if (s.bondType === "triple") {
      for(let k=0; k<3; k++) {
        let ang = TWO_PI/3 * k;
        let ey = cos(ang) * distY * 1.6;
        let ez = sin(ang) * distZ * 1.6;
        drawElectron3D(6, ey, ez);  
        drawElectron3D(-6, ey, ez); 
      }
    }

    if (ovalTransparent) {
      push();
      ambientMaterial(20, 140, 235);
      specularMaterial(80, 180, 255);
      shininess(50);
      fill(20, 140, 235, 50);
      ellipsoid(OVAL_A_STD, OVAL_B_STD, OVAL_C_STD, 64, 64);
      pop();
      
      push();
      ambientMaterial(10, 80, 150);
      noLights();
      fill(10, 80, 150, 30);
      ellipsoid(OVAL_A_STD * 0.75, OVAL_B_STD * 0.75, OVAL_C_STD * 0.75, 48, 48);
      pop();
    } else {
      push();
      ambientMaterial(20, 140, 235);
      specularMaterial(120, 200, 255);
      shininess(80);
      fill(20, 140, 235, 255);
      ellipsoid(OVAL_A_STD, OVAL_B_STD, OVAL_C_STD, 64, 64);
      pop();
    }
    
    pop();
    
  } else {
    if (s.bondType === "single") {
      drawBondBetweenPoints(A, B, color, 1, 4);
    } else if (s.bondType === "double") {
      drawBondBetweenPoints(A, B, color, 2, 4);
    } else if (s.bondType === "triple") {
      drawBondBetweenPoints(A, B, color, 3, 4);
    }
  }
}

function drawBondBetweenPoints(A, B, color, num, radius = 4) {
  let d = p5.Vector.sub(B, A).mag();
  let bondVec = p5.Vector.sub(B, A).normalize();
  let mid = p5.Vector.add(A, B).mult(0.5);
  let gap = 8;
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
  
  // LOGIC MỚI: Dựa vào bán kính cầu đỏ trung tâm + khoảng đệm
  // RED_RADIUS = 36. 36 + 35 = 71 (khoảng hợp lý ở giữa tâm và liên kết)
  let rArc = RED_RADIUS + 35; 

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
  
  stroke(0, 255, 255); 
  strokeWeight(3); 
  beginShape();
  for(const pt of pts) vertex(pt.x, pt.y, pt.z);
  endShape();

  strokeWeight(6); 
  point(pts[0].x, pts[0].y, pts[0].z);
  point(pts[steps].x, pts[steps].y, pts[steps].z);

  let midVec = p5.Vector.slerp(a1, a2, 0.5);
  // Đẩy chữ ra xa một chút so với cung
  let midPt = midVec.copy().mult(rArc * 1.35); 

  fill(255, 225, 24); 
  noStroke();
  
  textFont(arialFont);
  textSize(26); 
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
  
  translate(0, 0, 5); 
  
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