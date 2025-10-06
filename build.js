import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, 'dist');

if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

function copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

console.log('Building for GitHub Pages...');

copyDirectory(path.join(__dirname, 'public'), distDir);

// Create a modified version of app.js for static deployment
const appJsPath = path.join(distDir, 'js', 'app.js');
const appJsContent = `import * as THREE from 'three';
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
const USE_LOCAL_STORAGE = true;

async function fetchModules() {
    try {
        const stored = localStorage.getItem('spaceBaseModules');
        modules = stored ? JSON.parse(stored) : [];
        updateModulesList();
        renderScene();
        updateStats();
    } catch (error) {
        console.error('Error fetching modules:', error);
    }
}

async function createModule(moduleData) {
    try {
        const newModule = {
            id: Date.now().toString(),
            ...moduleData,
            created_at: new Date().toISOString()
        };
        modules.push(newModule);
        localStorage.setItem('spaceBaseModules', JSON.stringify(modules));
        await fetchModules();
        showNotification('✅ Módulo adicionado com sucesso!', 'success');
    } catch (error) {
        console.error('Error creating module:', error);
        showNotification('❌ Erro ao adicionar módulo', 'error');
    }
}

async function updateModule(id, moduleData) {
    try {
        const index = modules.findIndex(m => m.id === id);
        if (index !== -1) {
            modules[index] = { ...modules[index], ...moduleData };
            localStorage.setItem('spaceBaseModules', JSON.stringify(modules));
            await fetchModules();
            showNotification('✅ Módulo atualizado!', 'success');
        }
    } catch (error) {
        console.error('Error updating module:', error);
        showNotification('❌ Erro ao atualizar módulo', 'error');
    }
}

async function deleteModule(id) {
    if (!confirm('Tem certeza que deseja remover este módulo?')) return;
    
    try {
        modules = modules.filter(m => m.id !== id);
        localStorage.setItem('spaceBaseModules', JSON.stringify(modules));
        await fetchModules();
        showNotification('🗑️ Módulo removido', 'success');
    } catch (error) {
        console.error('Error deleting module:', error);
        showNotification('❌ Erro ao remover módulo', 'error');
    }
}

async function clearAllModules() {
    if (!confirm('⚠️ Tem certeza que deseja limpar TODA a base? Esta ação não pode ser desfeita!')) return;
    
    try {
        modules = [];
        localStorage.setItem('spaceBaseModules', JSON.stringify(modules));
        await fetchModules();
        showNotification('🗑️ Base limpa completamente', 'success');
    } catch (error) {
        console.error('Error clearing modules:', error);
        showNotification('❌ Erro ao limpar base', 'error');
    }
}
`;

// Read the rest of the original app.js (starting from THREE.JS SETUP)
const originalAppJs = fs.readFileSync(path.join(__dirname, 'public', 'js', 'app.js'), 'utf8');
const threeJsSetupIndex = originalAppJs.indexOf('// ==================== THREE.JS SETUP ====================');

if (threeJsSetupIndex !== -1) {
    const restOfCode = originalAppJs.substring(threeJsSetupIndex);
    fs.writeFileSync(appJsPath, appJsContent + '\n' + restOfCode);
} else {
    console.error('Could not find THREE.JS SETUP section');
    process.exit(1);
}

console.log('✅ Build complete! Output in dist/ folder');
console.log('📦 Static site ready for GitHub Pages deployment');
