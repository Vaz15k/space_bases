const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class LunarBaseDB {
    constructor() {
        this.dbPath = path.join(__dirname, 'lunar_base.json');
        this.initDatabase();
    }

    initDatabase() {
        if (!fs.existsSync(this.dbPath)) {
            fs.writeFileSync(this.dbPath, JSON.stringify({ modules: [] }, null, 2));
        }
        console.log('✅ Database initialized');
    }

    // Ler dados do arquivo
    readData() {
        try {
            const data = fs.readFileSync(this.dbPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading database:', error);
            return { modules: [] };
        }
    }

    // Escrever dados no arquivo
    writeData(data) {
        try {
            fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error writing database:', error);
        }
    }

    // Criar novo módulo
    createModule(moduleData) {
        const data = this.readData();
        const id = uuidv4();
        
        const newModule = {
            id,
            name: moduleData.name || 'Módulo Sem Nome',
            type: moduleData.type || 'cylinder',
            radius: moduleData.radius || 4.0,
            height: moduleData.height || 8.0,
            length: moduleData.length || 8.0,
            pos_x: moduleData.pos_x || 0.0,
            pos_y: moduleData.pos_y || 0.0,
            pos_z: moduleData.pos_z || 4.0,
            rot_x: moduleData.rot_x || 0.0,
            rot_y: moduleData.rot_y || 0.0,
            rot_z: moduleData.rot_z || 0.0,
            color: moduleData.color || '#FFFFFF',
            created_at: new Date().toISOString()
        };
        
        data.modules.push(newModule);
        this.writeData(data);
        
        return newModule;
    }

    // Buscar todos os módulos
    getAllModules() {
        const data = this.readData();
        return data.modules;
    }

    // Buscar módulo por ID
    getModule(id) {
        const data = this.readData();
        return data.modules.find(m => m.id === id);
    }

    // Atualizar módulo
    updateModule(id, moduleData) {
        const data = this.readData();
        const moduleIndex = data.modules.findIndex(m => m.id === id);
        
        if (moduleIndex === -1) return null;
        
        const allowedFields = ['name', 'type', 'radius', 'height', 'length', 'pos_x', 'pos_y', 'pos_z', 'rot_x', 'rot_y', 'rot_z', 'color'];
        
        for (const field of allowedFields) {
            if (moduleData[field] !== undefined) {
                data.modules[moduleIndex][field] = moduleData[field];
            }
        }
        
        this.writeData(data);
        return data.modules[moduleIndex];
    }

    // Deletar módulo
    deleteModule(id) {
        const data = this.readData();
        const initialLength = data.modules.length;
        data.modules = data.modules.filter(m => m.id !== id);
        
        if (data.modules.length < initialLength) {
            this.writeData(data);
            return true;
        }
        return false;
    }

    // Limpar toda a base
    clearAllModules() {
        const data = this.readData();
        const count = data.modules.length;
        data.modules = [];
        this.writeData(data);
        return count;
    }

    // Fechar conexão (não necessário para JSON, mas mantém compatibilidade)
    close() {
        console.log('Database connection closed');
    }
}

module.exports = LunarBaseDB;
