const express = require('express');
const router = express.Router();
const { get, all, run } = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Get all projects for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const projects = await all(
      `SELECT p.*, 
        (SELECT COUNT(*) FROM scans s WHERE s.project_id = p.id) as scan_count,
        (SELECT COUNT(*) FROM assets a WHERE a.project_id = p.id) as asset_count
       FROM projects p WHERE p.user_id = ? ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch projects.' });
  }
});

// Create new project
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, local_path } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Project name is required.' });
    }

    const result = await run(
      `INSERT INTO projects (user_id, name, description, local_path) VALUES (?, ?, ?, ?)`,
      [req.user.id, name, description || '', local_path || '']
    );

    await run(`INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`, [
      req.user.id,
      'PROJECT_CREATE',
      `Created project '${name}' (ID: ${result.lastID})`
    ]);

    const newProject = await get(`SELECT * FROM projects WHERE id = ?`, [result.lastID]);
    res.status(201).json({ project: newProject });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create project.' });
  }
});

// Get project by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const project = await get(`SELECT * FROM projects WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project.' });
  }
});

// Delete project
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const project = await get(`SELECT * FROM projects WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    await run(`DELETE FROM projects WHERE id = ?`, [req.params.id]);

    await run(`INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`, [
      req.user.id,
      'PROJECT_DELETE',
      `Deleted project '${project.name}' (ID: ${project.id})`
    ]);

    res.json({ message: 'Project deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project.' });
  }
});

module.exports = router;
