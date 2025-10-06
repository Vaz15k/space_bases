import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

// ==================== ESTADO GLOBAL ====================
let scene, camera, renderer, controls, transformControls;
let modules = [];
let currentEditingModule = null;
let selectedMesh = null;
let raycaster, mouse;
let isTransforming = false;

// ==================== API HELPERS ====================
const API_URL = '/api/modules';

async function fetchModules() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        if (data.success) {
            modules = data.data;
            updateModulesList();
            renderScene();
            updateStats();
        }
    } catch (error) {
        console.error('Erro ao buscar módulos:', error);
    }
}

async function createModule(moduleData) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(moduleData)
        });
        const data = await response.json();
        if (data.success) {
            await fetchModules();
            showNotification('✅ Módulo adicionado com sucesso!', 'success');
        }
    } catch (error) {
        console.error('Erro ao criar módulo:', error);
        showNotification('❌ Erro ao adicionar módulo', 'error');
    }
}

async function updateModule(id, moduleData) {
    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(moduleData)
        });
        const data = await response.json();
        if (data.success) {
            await fetchModules();
            showNotification('✅ Módulo atualizado!', 'success');
        }
    } catch (error) {
        console.error('Erro ao atualizar módulo:', error);
        showNotification('❌ Erro ao atualizar módulo', 'error');
    }
}

async function deleteModule(id) {
    if (!confirm('Tem certeza que deseja remover este módulo?')) return;
    
    try {
        const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
        const data = await response.json();
        if (data.success) {
            await fetchModules();
            showNotification('🗑️ Módulo removido', 'success');
        }
    } catch (error) {
        console.error('Erro ao deletar módulo:', error);
        showNotification('❌ Erro ao remover módulo', 'error');
    }
}

async function clearAllModules() {
    if (!confirm('⚠️ Tem certeza que deseja limpar TODA a base? Esta ação não pode ser desfeita!')) return;
    
    try {
        const response = await fetch(API_URL, { method: 'DELETE' });
        const data = await response.json();
        if (data.success) {
            await fetchModules();
            showNotification('🗑️ Base limpa completamente', 'success');
        }
    } catch (error) {
        console.error('Erro ao limpar módulos:', error);
        showNotification('❌ Erro ao limpar base', 'error');
    }
}

// ==================== THREE.JS SETUP ====================
function initThreeJS() {
    const container = document.getElementById('canvas-container');
    
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x00001a);
    scene.fog = new THREE.Fog(0x00001a, 50, 200);
    
    // Camera
    camera = new THREE.PerspectiveCamera(
        60,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
    );
    camera.position.set(40, 40, 30);
    
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = false;
    container.appendChild(renderer.domElement);
    
    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 10;
    controls.maxDistance = 150;
    controls.maxPolarAngle = Math.PI / 2;
    
    // Transform Controls para arrastar e redimensionar
    transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.addEventListener('dragging-changed', (event) => {
        controls.enabled = !event.value;
        isTransforming = event.value;
    });
    
    transformControls.addEventListener('objectChange', () => {
        if (selectedMesh && selectedMesh.userData.moduleId) {
            // Atualizar posição do módulo em tempo real
            updateModulePosition(selectedMesh);
        }
    });
    
    scene.add(transformControls);
    
    // Raycaster para detecção de cliques
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    
    // Event listeners para interação
    renderer.domElement.addEventListener('click', onMouseClick);
    window.addEventListener('keydown', onKeyDown);
    
    // Lights
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(50, 50, 25);
    directionalLight.castShadow = false;
    scene.add(directionalLight);
    
    const pointLight = new THREE.PointLight(0x4a90e2, 0.5);
    pointLight.position.set(-30, 20, 30);
    scene.add(pointLight);
    
    // Ground
    createGround();
    
    // Stars
    createStars();
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
    
    // Animation loop
    animate();
}

function createGround() {
    const geometry = new THREE.PlaneGeometry(200, 200, 100, 100);
    const material = new THREE.MeshStandardMaterial({
        color: 0x505050,
        roughness: 0.8,
        metalness: 0.2
    });
    
    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = false;
    
    // Add random displacement for terrain effect
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const z = Math.random() * 0.5 - 0.25;
        positions.setZ(i, z);
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    
    scene.add(ground);
}

function createStars() {
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.7,
        transparent: true
    });
    
    const starsVertices = [];
    for (let i = 0; i < 1000; i++) {
        const x = (Math.random() - 0.5) * 600;
        const y = Math.random() * 300 + 50;
        const z = (Math.random() - 0.5) * 600;
        starsVertices.push(x, y, z);
    }
    
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);
}

function onWindowResize() {
    const container = document.getElementById('canvas-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// ==================== GEOMETRY CREATION ====================
function createCylinderGeometry(radius, height) {
    return new THREE.CylinderGeometry(radius, radius, height, 32);
}

function createDomeGeometry(radius) {
    return new THREE.SphereGeometry(radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
}

function createBoxGeometry(size) {
    return new THREE.BoxGeometry(size, size, size);
}

function createSphereGeometry(radius) {
    return new THREE.SphereGeometry(radius, 32, 32);
}

function createCapsuleGeometry(radius, length) {
    return new THREE.CapsuleGeometry(radius, length, 16, 32);
}

function createTorusGeometry(radius) {
    const geometry = new THREE.TorusGeometry(radius, radius * 0.3, 16, 32);
    // Rotacionar 90 graus para ficar deitado (horizontal)
    geometry.rotateX(Math.PI / 2);
    return geometry;
}

function createOctahedronGeometry(radius) {
    return new THREE.OctahedronGeometry(radius, 0);
}

function createModuleMesh(module) {
    let geometry;
    
    switch (module.type) {
        case 'cylinder':
            geometry = createCylinderGeometry(module.radius, module.height);
            break;
        case 'dome':
            geometry = createDomeGeometry(module.radius);
            break;
        case 'box':
            geometry = createBoxGeometry(module.radius * 2);
            break;
        case 'sphere':
            geometry = createSphereGeometry(module.radius);
            break;
        case 'capsule':
            geometry = createCapsuleGeometry(module.radius, module.height);
            break;
        case 'torus':
            geometry = createTorusGeometry(module.radius);
            break;
        case 'octahedron':
            geometry = createOctahedronGeometry(module.radius);
            break;
        default:
            geometry = new THREE.BoxGeometry(4, 4, 4);
    }
    
    const material = new THREE.MeshStandardMaterial({
        color: module.color,
        roughness: 0.5,
        metalness: 0.3
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(module.pos_x, module.pos_z, -module.pos_y);
    
    // Aplicar rotação se existir
    if (module.rot_x !== undefined) mesh.rotation.x = module.rot_x * Math.PI / 180;
    if (module.rot_y !== undefined) mesh.rotation.y = module.rot_y * Math.PI / 180;
    if (module.rot_z !== undefined) mesh.rotation.z = module.rot_z * Math.PI / 180;
    
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.userData.moduleId = module.id;
    
    return mesh;
}

function renderScene() {
    // Remove all existing module meshes
    scene.children.filter(child => child.userData.moduleId).forEach(child => {
        scene.remove(child);
    });
    
    // Desanexar TransformControls se houver
    if (transformControls.object) {
        transformControls.detach();
    }
    selectedMesh = null;
    
    // Add all modules
    modules.forEach(module => {
        const mesh = createModuleMesh(module);
        scene.add(mesh);
    });
}

// ==================== INTERAÇÃO COM OBJETOS ====================
function onMouseClick(event) {
    if (isTransforming) return;
    
    const container = document.getElementById('canvas-container');
    const rect = container.getBoundingClientRect();
    
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    
    const moduleMeshes = scene.children.filter(child => child.userData.moduleId);
    const intersects = raycaster.intersectObjects(moduleMeshes);
    
    if (intersects.length > 0) {
        const clickedMesh = intersects[0].object;
        selectModule(clickedMesh);
    } else {
        deselectModule();
    }
}

function selectModule(mesh) {
    // Destacar módulo selecionado
    if (selectedMesh) {
        selectedMesh.material.emissive.setHex(0x000000);
    }
    
    selectedMesh = mesh;
    selectedMesh.material.emissive.setHex(0x555555);
    
    // Anexar TransformControls
    transformControls.attach(selectedMesh);
    transformControls.setMode('translate'); // Modo de arrastar
    
    // Mostrar info do módulo
    const module = modules.find(m => m.id === selectedMesh.userData.moduleId);
    if (module) {
        showModuleInfo(module);
    }
}

function deselectModule() {
    if (selectedMesh) {
        selectedMesh.material.emissive.setHex(0x000000);
        selectedMesh = null;
    }
    transformControls.detach();
    hideModuleInfo();
}

function onKeyDown(event) {
    if (!selectedMesh) return;
    
    switch (event.key) {
        case 't':
        case 'T':
            transformControls.setMode('translate');
            break;
        case 'r':
        case 'R':
            transformControls.setMode('rotate');
            break;
        case 's':
        case 'S':
            transformControls.setMode('scale');
            break;
        case 'Escape':
            deselectModule();
            break;
        case 'Delete':
        case 'Backspace':
            if (selectedMesh && selectedMesh.userData.moduleId) {
                deleteModule(selectedMesh.userData.moduleId);
                deselectModule();
            }
            break;
    }
}

function updateModulePosition(mesh) {
    const moduleId = mesh.userData.moduleId;
    const module = modules.find(m => m.id === moduleId);
    
    if (!module) return;
    
    // Converter posição Three.js para coordenadas do banco
    const pos_x = Math.round(mesh.position.x * 10) / 10;
    const pos_y = Math.round(-mesh.position.z * 10) / 10;
    const pos_z = Math.round(mesh.position.y * 10) / 10;
    
    // Atualizar módulo local
    module.pos_x = pos_x;
    module.pos_y = pos_y;
    module.pos_z = pos_z;
    
    // Debounce para não fazer muitas chamadas à API
    if (mesh.userData.updateTimer) {
        clearTimeout(mesh.userData.updateTimer);
    }
    
    mesh.userData.updateTimer = setTimeout(() => {
        updateModule(moduleId, {
            pos_x,
            pos_y,
            pos_z
        });
    }, 500);
}

function showModuleInfo(module) {
    const infoDiv = document.getElementById('selectedModuleInfo');
    if (!infoDiv) {
        const newDiv = document.createElement('div');
        newDiv.id = 'selectedModuleInfo';
        newDiv.className = 'selected-module-info';
        document.body.appendChild(newDiv);
    }
    
    const info = document.getElementById('selectedModuleInfo');
    info.innerHTML = `
        <div class="info-header">
            <strong>${module.name}</strong>
            <span class="info-badge">${getTypeLabel(module.type)}</span>
        </div>
        <div class="info-content">
            <p>Posição: (${module.pos_x.toFixed(1)}, ${module.pos_y.toFixed(1)}, ${module.pos_z.toFixed(1)})</p>
            <p><strong>Controles:</strong></p>
            <ul>
                <li><kbd>T</kbd> - Mover (Translate)</li>
                <li><kbd>R</kbd> - Rotacionar (Rotate)</li>
                <li><kbd>S</kbd> - Redimensionar (Scale)</li>
                <li><kbd>ESC</kbd> - Desselecionar</li>
                <li><kbd>Del</kbd> - Deletar</li>
            </ul>
        </div>
    `;
    info.style.display = 'block';
}

function hideModuleInfo() {
    const info = document.getElementById('selectedModuleInfo');
    if (info) {
        info.style.display = 'none';
    }
}

// ==================== UI UPDATES ====================
function updateModulesList() {
    const listContainer = document.getElementById('modulesList');
    
    if (modules.length === 0) {
        listContainer.innerHTML = '<p class="empty-state">Nenhum módulo adicionado ainda. Comece criando seu primeiro módulo!</p>';
        return;
    }
    
    listContainer.innerHTML = modules.map(module => `
        <div class="module-item">
            <div class="module-header">
                <div class="module-color-indicator" style="background-color: ${module.color}"></div>
                <div class="module-title">${module.name}</div>
                <span class="module-type-badge">${getTypeLabel(module.type)}</span>
            </div>
            <div class="module-info">
                Posição: (${module.pos_x.toFixed(1)}, ${module.pos_y.toFixed(1)}, ${module.pos_z.toFixed(1)})
            </div>
            <div class="module-actions">
                <button class="btn btn-primary" onclick="editModule('${module.id}')">Editar</button>
                <button class="btn btn-danger" onclick="removeModule('${module.id}')">Remover</button>
            </div>
        </div>
    `).join('');
}

function getTypeLabel(type) {
    const labels = {
        'cylinder': 'Cilindro',
        'dome': 'Domo',
        'box': 'Cubo',
        'sphere': 'Esfera',
        'capsule': 'Cápsula',
        'torus': 'Toroide',
        'octahedron': 'Octaedro'
    };
    return labels[type] || type;
}

function updateStats() {
    document.getElementById('moduleCount').textContent = modules.length;
    
    const totalArea = modules.reduce((sum, module) => {
        let area = 0;
        if (module.type === 'cylinder') {
            area = 2 * Math.PI * module.radius * module.height + 2 * Math.PI * module.radius * module.radius;
        } else if (module.type === 'dome') {
            area = 2 * Math.PI * module.radius * module.radius;
        } else if (module.type === 'connector') {
            area = 2 * Math.PI * module.radius * module.length;
        }
        return sum + area;
    }, 0);
    
    document.getElementById('totalArea').textContent = totalArea.toFixed(1) + ' m²';
}

function showNotification(message, type = 'info') {
    // Simple alert for now, can be enhanced with toast notifications
    console.log(`[${type}] ${message}`);
}

// ==================== EVENT HANDLERS ====================
document.getElementById('addModuleBtn').addEventListener('click', () => {
    const name = document.getElementById('moduleName').value || 'Módulo Sem Nome';
    const type = document.getElementById('moduleType').value;
    const color = document.getElementById('moduleColor').value;
    
    const moduleData = {
        name,
        type,
        color,
        radius: 4.0,
        height: 8.0,
        length: 8.0,
        pos_x: 0.0,
        pos_y: 0.0,
        pos_z: type === 'dome' ? 4.0 : type === 'torus' ? 5.0 : 4.0
    };
    
    createModule(moduleData);
});

document.getElementById('clearAllBtn').addEventListener('click', clearAllModules);

document.getElementById('resetCameraBtn').addEventListener('click', () => {
    camera.position.set(40, 40, 30);
    controls.target.set(0, 0, 0);
    controls.update();
});

// ==================== MODAL FUNCTIONS ====================
window.editModule = function(id) {
    const module = modules.find(m => m.id === id);
    if (!module) return;
    
    currentEditingModule = module;
    
    // Fill form
    document.getElementById('editName').value = module.name;
    document.getElementById('editColor').value = module.color;
    document.getElementById('editPosX').value = module.pos_x;
    document.getElementById('editPosY').value = module.pos_y;
    document.getElementById('editPosZ').value = module.pos_z;
    
    // Rotação (padrão 0 se não existir)
    document.getElementById('editRotX').value = module.rot_x || 0;
    document.getElementById('editRotY').value = module.rot_y || 0;
    document.getElementById('editRotZ').value = module.rot_z || 0;
    
    updatePositionDisplays();
    updateRotationDisplays();
    updateDimensionControls(module);
    
    // Show modal
    document.getElementById('editModal').classList.add('active');
};

window.closeEditModal = function() {
    document.getElementById('editModal').classList.remove('active');
    currentEditingModule = null;
};

window.saveModule = function() {
    if (!currentEditingModule) return;
    
    const updatedData = {
        name: document.getElementById('editName').value,
        color: document.getElementById('editColor').value,
        pos_x: parseFloat(document.getElementById('editPosX').value),
        pos_y: parseFloat(document.getElementById('editPosY').value),
        pos_z: parseFloat(document.getElementById('editPosZ').value),
        rot_x: parseFloat(document.getElementById('editRotX').value),
        rot_y: parseFloat(document.getElementById('editRotY').value),
        rot_z: parseFloat(document.getElementById('editRotZ').value)
    };
    
    // Get dimension values based on type
    if (currentEditingModule.type === 'cylinder' || currentEditingModule.type === 'capsule') {
        updatedData.radius = parseFloat(document.getElementById('editRadius').value);
        updatedData.height = parseFloat(document.getElementById('editHeight').value);
    } else if (currentEditingModule.type === 'dome' || currentEditingModule.type === 'sphere' || 
               currentEditingModule.type === 'torus' || currentEditingModule.type === 'octahedron' ||
               currentEditingModule.type === 'box') {
        updatedData.radius = parseFloat(document.getElementById('editRadius').value);
    }
    
    updateModule(currentEditingModule.id, updatedData);
    closeEditModal();
};

window.removeModule = function(id) {
    deleteModule(id);
};

window.adjustPosition = function(axis, delta) {
    const input = document.getElementById(`editPos${axis.toUpperCase()}`);
    const newValue = parseFloat(input.value) + delta;
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    
    input.value = Math.max(min, Math.min(max, newValue));
    updatePositionDisplays();
    
    // Live preview
    if (currentEditingModule) {
        const mesh = scene.children.find(child => child.userData.moduleId === currentEditingModule.id);
        if (mesh) {
            if (axis === 'x') mesh.position.x = newValue;
            if (axis === 'y') mesh.position.z = -newValue;
            if (axis === 'z') mesh.position.y = newValue;
        }
    }
};

function updatePositionDisplays() {
    document.getElementById('posXValue').textContent = document.getElementById('editPosX').value;
    document.getElementById('posYValue').textContent = document.getElementById('editPosY').value;
    document.getElementById('posZValue').textContent = document.getElementById('editPosZ').value;
}

function updateRotationDisplays() {
    document.getElementById('rotXValue').textContent = document.getElementById('editRotX').value + '°';
    document.getElementById('rotYValue').textContent = document.getElementById('editRotY').value + '°';
    document.getElementById('rotZValue').textContent = document.getElementById('editRotZ').value + '°';
}

window.adjustRotation = function(axis, delta) {
    const input = document.getElementById(`editRot${axis.toUpperCase()}`);
    let newValue = parseFloat(input.value) + delta;
    
    // Manter entre 0 e 360
    while (newValue < 0) newValue += 360;
    while (newValue >= 360) newValue -= 360;
    
    input.value = newValue;
    updateRotationDisplays();
    
    // Live preview
    if (currentEditingModule) {
        const mesh = scene.children.find(child => child.userData.moduleId === currentEditingModule.id);
        if (mesh) {
            if (axis === 'x') mesh.rotation.x = newValue * Math.PI / 180;
            if (axis === 'y') mesh.rotation.y = newValue * Math.PI / 180;
            if (axis === 'z') mesh.rotation.z = newValue * Math.PI / 180;
        }
    }
};

function updateDimensionControls(module) {
    const container = document.getElementById('dimensionControls');
    let html = '';
    
    if (module.type === 'cylinder' || module.type === 'capsule') {
        html = `
            <div class="form-group">
                <label for="editRadius">Raio: <span class="dimension-value" id="radiusValue">${module.radius.toFixed(1)} m</span></label>
                <input type="range" id="editRadius" min="1" max="15" step="0.5" value="${module.radius}" oninput="updateDimensionDisplay('radius', this.value)">
            </div>
            <div class="form-group">
                <label for="editHeight">Altura: <span class="dimension-value" id="heightValue">${module.height.toFixed(1)} m</span></label>
                <input type="range" id="editHeight" min="2" max="20" step="0.5" value="${module.height}" oninput="updateDimensionDisplay('height', this.value)">
            </div>
        `;
    } else if (module.type === 'dome' || module.type === 'sphere' || module.type === 'torus' || module.type === 'octahedron') {
        html = `
            <div class="form-group">
                <label for="editRadius">Raio: <span class="dimension-value" id="radiusValue">${module.radius.toFixed(1)} m</span></label>
                <input type="range" id="editRadius" min="1" max="15" step="0.5" value="${module.radius}" oninput="updateDimensionDisplay('radius', this.value)">
            </div>
        `;
    } else if (module.type === 'box') {
        html = `
            <div class="form-group">
                <label for="editRadius">Tamanho: <span class="dimension-value" id="radiusValue">${module.radius.toFixed(1)} m</span></label>
                <input type="range" id="editRadius" min="1" max="15" step="0.5" value="${module.radius}" oninput="updateDimensionDisplay('radius', this.value)">
            </div>
        `;
    }
    
    container.innerHTML = html;
}

window.updateDimensionDisplay = function(dimension, value) {
    document.getElementById(`${dimension}Value`).textContent = `${parseFloat(value).toFixed(1)} m`;
};

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.querySelector(`.tab-content[data-tab="${tabName}"]`).classList.add('active');
    });
});

// Position sliders live update
['editPosX', 'editPosY', 'editPosZ'].forEach(id => {
    document.getElementById(id).addEventListener('input', function() {
        updatePositionDisplays();
        
        // Live preview
        if (currentEditingModule) {
            const mesh = scene.children.find(child => child.userData.moduleId === currentEditingModule.id);
            if (mesh) {
                const x = parseFloat(document.getElementById('editPosX').value);
                const y = parseFloat(document.getElementById('editPosY').value);
                const z = parseFloat(document.getElementById('editPosZ').value);
                
                mesh.position.set(x, z, -y);
            }
        }
    });
});

// Rotation sliders live update
['editRotX', 'editRotY', 'editRotZ'].forEach(id => {
    document.getElementById(id).addEventListener('input', function() {
        updateRotationDisplays();
        
        // Live preview
        if (currentEditingModule) {
            const mesh = scene.children.find(child => child.userData.moduleId === currentEditingModule.id);
            if (mesh) {
                const rotX = parseFloat(document.getElementById('editRotX').value) * Math.PI / 180;
                const rotY = parseFloat(document.getElementById('editRotY').value) * Math.PI / 180;
                const rotZ = parseFloat(document.getElementById('editRotZ').value) * Math.PI / 180;
                
                mesh.rotation.set(rotX, rotY, rotZ);
            }
        }
    });
});

// ==================== INITIALIZATION ====================
initThreeJS();
fetchModules();
