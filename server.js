const express = require('express');
const cors = require('cors');
const path = require('path');
const LunarBaseDB = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Inicializar banco de dados
const db = new LunarBaseDB();

// ==================== ROTAS DA API ====================

// GET - Listar todos os módulos
app.get('/api/modules', (req, res) => {
    try {
        const modules = db.getAllModules();
        res.json({ success: true, data: modules });
    } catch (error) {
        console.error('Error fetching modules:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET - Buscar módulo por ID
app.get('/api/modules/:id', (req, res) => {
    try {
        const module = db.getModule(req.params.id);
        if (!module) {
            return res.status(404).json({ success: false, error: 'Módulo não encontrado' });
        }
        res.json({ success: true, data: module });
    } catch (error) {
        console.error('Error fetching module:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST - Criar novo módulo
app.post('/api/modules', (req, res) => {
    try {
        const newModule = db.createModule(req.body);
        res.status(201).json({ success: true, data: newModule });
    } catch (error) {
        console.error('Error creating module:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT - Atualizar módulo
app.put('/api/modules/:id', (req, res) => {
    try {
        const updatedModule = db.updateModule(req.params.id, req.body);
        if (!updatedModule) {
            return res.status(404).json({ success: false, error: 'Módulo não encontrado' });
        }
        res.json({ success: true, data: updatedModule });
    } catch (error) {
        console.error('Error updating module:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE - Deletar módulo
app.delete('/api/modules/:id', (req, res) => {
    try {
        const deleted = db.deleteModule(req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'Módulo não encontrado' });
        }
        res.json({ success: true, message: 'Módulo removido com sucesso' });
    } catch (error) {
        console.error('Error deleting module:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE - Limpar todos os módulos
app.delete('/api/modules', (req, res) => {
    try {
        const count = db.clearAllModules();
        res.json({ success: true, message: `${count} módulos removidos`, count });
    } catch (error) {
        console.error('Error clearing modules:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📊 Base de dados: lunar_base.db`);
});

// Fechar banco de dados ao encerrar
process.on('SIGINT', () => {
    db.close();
    console.log('\n👋 Servidor encerrado');
    process.exit(0);
});
