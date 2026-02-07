let spheres = [];
let draggingIndex = -1;
let prevMouseX, prevMouseY;
let scale3D = 1.1;

// Ma trận xoay tích lũy
let curRot; 

let center;
const CORD_LENGTH = 80; 

// --- CẤU HÌNH BÁN KÍNH ---
const RADIUS_BLUE = 80;   // Bán kính hiển thị của Oval
const RADIUS_WHITE = 115; // Bán kính hiển thị của Cầu trắng (xa hơn)
const PHYSICS_RADIUS = 80; // Bán kính dùng để tính toán vật lý

let arialFont;

const OVAL_A = 36;
const OVAL_B = 27;
const OVAL_C = 27;
const RED_RADIUS = 36; 
const WHITE_SPHERE_RADIUS = 27; 

let pointerOnSidebar = false;
let sphereIdCounter = 1;

let showAngle = false;
let showBondOvals = false; 
let ovalTransparent = true; // Biến mới: true = trong suốt (mặc định), false = đặc

let angleRepresentatives = []; 

// Biến hỗ trợ kéo thả chính xác
let dragOffset = null;      
let dragPlaneNormal = null; 
let dragPlanePoint = null;  

let realRepulsionEnabled = false;

// Biến cho chức năng lưu ảnh
let savingImage = false;

function preload() {
  arialFont = loadFont('Arial.ttf');
}

function setup() {
  let cW = windowWidth - document.getElementById('sidebar').offsetWidth;
  let cH = windowHeight;
  let cnv = createCanvas(cW, cH, WEBGL);
  cnv.parent('canvas-container');
  
  // Cài đặt cho độ mịn cao
  setAttributes('antialias', true);
  setAttributes('alpha', true);
  smooth(); // Bật làm mịn
  
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

  // --- Xử lý sự kiện và đổi nhãn nút ---
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

  // Nút bật/tắt trong suốt oval
  const btnOvalTransparency = document.getElementById('toggleOvalTransparencyBtn');
  btnOvalTransparency.onclick = function() {
    ovalTransparent = !ovalTransparent;
    this.innerText = ovalTransparent ? "Tắt trong suốt oval" : "Bật trong suốt oval";
  };

  document.getElementById('saveImageBtn').onclick = saveImage4K;
  document.getElementById('resetBtn').onclick = resetSystem;

  const sidebar = document.getElementById('sidebar');
  sidebar.addEventListener('mouseenter', () => pointerOnSidebar = true);
  sidebar.addEventListener('mouseleave', () => pointerOnSidebar = false);

  renderObjectList();
  setAttributes('depth', true);
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
  ovalTransparent = true; // Reset về mặc định trong suốt
  angleRepresentatives = [];
  
  curRot = createIdentityMatrix();
  rotateMatrixX(curRot, 0.5);
  rotateMatrixY(curRot, -0.5);
  
  document.getElementById('toggleRealRepulsionBtn').innerText = "Bật lực đẩy thật";
  document.getElementById('toggleAngleBtn').innerText = "Hiện giá trị góc";
  document.getElementById('toggleBondOvalBtn').innerText = "Bật oval liên kết";
  document.getElementById('toggleOvalTransparencyBtn').innerText = "Tắt trong suốt oval";
  
  renderObjectList();
}

function addSphere() {
  let phi = random(0, PI), theta = random(0, TWO_PI);
  let r = RADIUS_BLUE; 
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
  // Nếu đang lưu ảnh, dùng nền trong suốt, nếu không thì dùng nền đen
  if (savingImage) {
    clear(); // Nền trong suốt
  } else {
    background(0); // Nền đen
  }
  
  ambientLight(150, 150, 150); 
  directionalLight(180, 180, 180, 0.5, 0.5, -1);
  directionalLight(80, 80, 100, -0.5, -0.5, 0.5); 

  scale(scale3D);

  push();
  applyMatrix(...curRot);

  drawCentralPoint();

  balancePhysics(); 
  
  for (let i = 0; i < spheres.length; i++) drawBond(i);
  for (let i = 0; i < spheres.length; i++) drawSphere(i);

  if (showAngle) {
    angleRepresentatives.forEach(rep => {
      const [a, b] = rep.indices;
      if (spheres[a] && spheres[b]) drawAngleArc(a, b);
    });
  }

  pop();

  // Nếu đang trong quá trình lưu ảnh
  if (savingImage) {
    // Tạo tên file với timestamp
    let timestamp = year() + nf(month(), 2) + nf(day(), 2) + '_' + 
                    nf(hour(), 2) + nf(minute(), 2) + nf(second(), 2);
    saveCanvas('molecule_4K_' + timestamp, 'png');
    
    // Restore pixelDensity về 1
    pixelDensity(1);
    savingImage = false;
  }
}

function saveImage4K() {
  // Tính toán pixelDensity cần thiết để đạt độ phân giải 4K
  // Giả sử muốn chiều rộng đạt khoảng 3840 pixels
  let targetWidth = 3840;
  let currentWidth = width;
  
  // Tính pixelDensity ratio (tối đa 4 để không quá tải)
  let densityRatio = min(targetWidth / currentWidth, 4);
  
  // Set pixelDensity cao hơn để tăng độ phân giải
  pixelDensity(densityRatio);
  
  // Canvas sẽ tự động render với độ phân giải cao hơn
  // mà KHÔNG thay đổi kích thước logic
  
  // Set flag để frame tiếp theo sẽ có nền trong suốt và lưu ảnh
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
    
    let targetRad = (sA.type === 'white') ? RADIUS_WHITE : RADIUS_BLUE;
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
      
      let targetR = (spheres[draggingIndex].type === 'white') ? RADIUS_WHITE : RADIUS_BLUE;
      dest.setMag(targetR); 

      // Dùng lerp để di chuyển mượt mà
      spheres[draggingIndex].pos.lerp(dest, 0.2); 
      spheres[draggingIndex].velocity.mult(0); 
      
      if (showAngle) computeAllRepresentativeAngles();
    }
  } else {
    // --- CẢI TIẾN: XOAY TRACKBALL - ĐÃ ĐẢO NGƯỢC HƯỚNG ---
    let dx = mouseX - prevMouseX;
    let dy = mouseY - prevMouseY;
    
    if (dx !== 0 || dy !== 0) {
      let sensitivity = 0.01; // Độ nhạy xoay
      
      // Tính khoảng cách di chuyển của chuột
      let distance = Math.sqrt(dx * dx + dy * dy);
      
      // Tạo trục xoay vuông góc với hướng di chuyển của chuột
      // ĐẢO NGƯỢC: Thay đổi từ (-dy, dx, 0) thành (dy, -dx, 0)
      let rotationAxisScreen = createVector(dy, -dx, 0).normalize();
      
      // Chuyển trục xoay từ không gian camera sang không gian world
      let rotationAxisWorld = createVector(
        curRot[0] * rotationAxisScreen.x + curRot[1] * rotationAxisScreen.y + curRot[2] * rotationAxisScreen.z,
        curRot[4] * rotationAxisScreen.x + curRot[5] * rotationAxisScreen.y + curRot[6] * rotationAxisScreen.z,
        curRot[8] * rotationAxisScreen.x + curRot[9] * rotationAxisScreen.y + curRot[10] * rotationAxisScreen.z
      ).normalize();
      
      // Góc xoay tỷ lệ với khoảng cách di chuyển
      let angle = distance * sensitivity;
      
      // Tạo ma trận xoay quanh trục
      let rotMatrix = createAxisAngleMatrix(rotationAxisWorld, angle);
      
      // Áp dụng xoay vào ma trận hiện tại
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
        let dirI = spheres[i].pos.copy().normalize();
        let dirJ = spheres[j].pos.copy().normalize();
        let d = p5.Vector.dist(dirI, dirJ);
        
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
  sphere(RED_RADIUS, 64, 64); // TĂNG từ 32 lên 64 segments
  pop();
}

// Hàm vẽ electron - KÍCH THƯỚC BAN ĐẦU, MÀU ĐỎ SÁNG
function drawElectron3D(x, y, z) {
  push();
  translate(x, y, z);
  noStroke();
  
  // Màu đỏ sáng
  let c = color(255, 80, 80); 
  ambientMaterial(c); 
  emissiveMaterial(255, 60, 60); // Tự phát sáng đỏ
  specularMaterial(255, 220, 220); // Highlight sáng
  shininess(180); // Độ bóng cao
  
  fill(c); 
  sphere(5, 64, 64); // TĂNG từ 32 lên 64 segments
  pop();
}

function drawSphere(idx) {
  let s = spheres[idx];
  let p = s.pos;
  push();
  translate(p.x, p.y, p.z);
  noStroke();

  if (s.type === 'blue') {
    let expandFactor = realRepulsionEnabled ? 1.2 : 1.0; 
    let toCenter = p5.Vector.mult(p, -1).normalize();
    alignVectorToAxis(toCenter, createVector(1, 0, 0));

    // Vẽ electron trước (nếu trong suốt thì sẽ thấy, nếu đặc thì bị che)
    push();
    let distFromAxis = 8; 
    drawElectron3D(0, distFromAxis, 0);
    drawElectron3D(0, -distFromAxis, 0);
    pop();
    
    // --- VẼ OVAL - KIỂM TRA TRẠNG THÁI TRONG SUỐT ---
    if (ovalTransparent) {
      // Chế độ trong suốt cao - nhìn thấy electron bên trong
      push();
      ambientMaterial(20, 140, 235);
      specularMaterial(80, 180, 255);
      shininess(50);
      fill(20, 140, 235, 50); // Rất trong suốt
      ellipsoid(OVAL_A * expandFactor, OVAL_B * expandFactor, OVAL_C * expandFactor, 64, 64);
      pop();
      
      push();
      ambientMaterial(10, 80, 150);
      noLights();
      fill(10, 80, 150, 30); // Gần như trong suốt hoàn toàn
      ellipsoid(OVAL_A * expandFactor * 0.75, OVAL_B * expandFactor * 0.75, OVAL_C * expandFactor * 0.75, 48, 48);
      pop();
    } else {
      // Chế độ ĐẶC - che khuất hoàn toàn electron bên trong
      push();
      ambientMaterial(20, 140, 235);
      specularMaterial(120, 200, 255);
      shininess(80);
      fill(20, 140, 235, 255); // Hoàn toàn đặc (alpha = 255)
      ellipsoid(OVAL_A * expandFactor, OVAL_B * expandFactor, OVAL_C * expandFactor, 64, 64);
      pop();
    }

  } else if (s.type === 'white') {
    ambientMaterial(200, 200, 200);
    specularMaterial(150); 
    shininess(60); 
    sphere(WHITE_SPHERE_RADIUS, 64, 64); // TĂNG từ 32 lên 64 segments
  } else {
    ambientMaterial(200);
    sphere(27, 64, 64); // TĂNG từ 32 lên 64 segments
  }
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

  if (showBondOvals) {
    push();
    
    let distCenterToWhite = RADIUS_WHITE; 
    let startR = RED_RADIUS; 
    let endR = distCenterToWhite - WHITE_SPHERE_RADIUS; 
    let length = endR - startR; 
    let midR = startR + length / 2; 
    
    let dir = B.copy().normalize();
    let ovalPos = dir.copy().mult(midR);
    
    translate(ovalPos.x, ovalPos.y, ovalPos.z);
    
    let toCenter = dir.copy().mult(-1);
    alignVectorToAxis(toCenter, createVector(1, 0, 0));
    
    let distY = 8;
    let distZ = 8;
    
    // Vẽ electron trước
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

    // --- VẼ OVAL LIÊN KẾT - KIỂM TRA TRẠNG THÁI TRONG SUỐT ---
    if (ovalTransparent) {
      // Chế độ trong suốt cao - nhìn thấy electron
      push();
      ambientMaterial(20, 140, 235);
      specularMaterial(80, 180, 255);
      shininess(50);
      fill(20, 140, 235, 50);
      ellipsoid(OVAL_A, OVAL_B, OVAL_C, 64, 64);
      pop();
      
      push();
      ambientMaterial(10, 80, 150);
      noLights();
      fill(10, 80, 150, 30);
      ellipsoid(OVAL_A * 0.75, OVAL_B * 0.75, OVAL_C * 0.75, 48, 48);
      pop();
    } else {
      // Chế độ ĐẶC - che khuất electron
      push();
      ambientMaterial(20, 140, 235);
      specularMaterial(120, 200, 255);
      shininess(80);
      fill(20, 140, 235, 255); // Hoàn toàn đặc
      ellipsoid(OVAL_A, OVAL_B, OVAL_C, 64, 64);
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
  let gap = 8; // TĂNG từ 7 lên 8 - các liên kết cách xa nhau thêm 1px
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
    cylinder(radius, max(d, 2), 32, 1); // TĂNG từ 16 lên 32 segments
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
  
  stroke(0, 255, 255); 
  strokeWeight(5); 
  beginShape();
  for(const pt of pts) vertex(pt.x, pt.y, pt.z);
  endShape();

  strokeWeight(8);
  point(pts[0].x, pts[0].y, pts[0].z);
  point(pts[steps].x, pts[steps].y, pts[steps].z);

  let midVec = p5.Vector.slerp(a1, a2, 0.5);
  let midPt = midVec.copy().mult(rArc * 1.25); 

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
  
  translate(0, 0, 20); 
  
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