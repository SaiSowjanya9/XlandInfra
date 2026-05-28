const express = require('express');
const router = express.Router();
const configCategories = require('../config/categories');
const { pool, isDbConnected } = require('../config/database');

// Get all categories (from database, fallback to config)
router.get('/', async (req, res) => {
  try {
    if (isDbConnected && pool) {
      const [rows] = await pool.execute('SELECT id, name FROM categories WHERE is_active = 1 ORDER BY name');
      if (rows.length > 0) {
        return res.json({ success: true, data: rows });
      }
    }
    // Fallback to config
    const categoryList = configCategories.map(cat => ({ id: cat.id, name: cat.name }));
    res.json({ success: true, data: categoryList });
  } catch (error) {
    // Fallback to config on error
    const categoryList = configCategories.map(cat => ({ id: cat.id, name: cat.name }));
    res.json({ success: true, data: categoryList });
  }
});

// Add new category
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }
    
    // Check if already exists
    const [existing] = await pool.execute('SELECT id FROM categories WHERE name = ?', [name]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Category already exists' });
    }
    
    const [result] = await pool.execute(
      'INSERT INTO categories (name, description, is_active) VALUES (?, ?, 1)',
      [name, description || `${name} services`]
    );
    
    res.json({ success: true, data: { id: result.insertId, name }, message: 'Category added successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error adding category', error: error.message });
  }
});

// Get subcategories by category ID (from database, fallback to config)
router.get('/:categoryId/subcategories', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.categoryId);
    
    if (isDbConnected && pool) {
      const [rows] = await pool.execute(
        'SELECT id, name, category_id as categoryId FROM subcategories WHERE category_id = ? AND is_active = 1',
        [categoryId]
      );
      if (rows.length > 0) {
        return res.json({ success: true, data: rows });
      }
    }
    
    // Fallback to config
    const category = configCategories.find(cat => cat.id === categoryId);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    const subcategoryList = category.subcategories.map((sub) => ({
      id: sub.id, name: sub.name, categoryId: categoryId
    }));
    res.json({ success: true, data: subcategoryList });
  } catch (error) {
    const category = configCategories.find(cat => cat.id === parseInt(req.params.categoryId));
    if (category) {
      const subcategoryList = category.subcategories.map((sub) => ({
        id: sub.id, name: sub.name, categoryId: category.id
      }));
      return res.json({ success: true, data: subcategoryList });
    }
    res.status(500).json({ success: false, message: 'Error fetching subcategories', error: error.message });
  }
});

// Add new subcategory
router.post('/:categoryId/subcategories', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.categoryId);
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: 'Subcategory name is required' });
    }
    
    // Check if already exists
    const [existing] = await pool.execute(
      'SELECT id FROM subcategories WHERE category_id = ? AND name = ?',
      [categoryId, name]
    );
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Subcategory already exists' });
    }
    
    // Generate ID based on category (categoryId * 100 + sequence)
    const [maxId] = await pool.execute(
      'SELECT MAX(id) as maxId FROM subcategories WHERE category_id = ?',
      [categoryId]
    );
    const newId = maxId[0].maxId ? maxId[0].maxId + 1 : categoryId * 100 + 1;
    
    await pool.execute(
      'INSERT INTO subcategories (id, category_id, name, is_active) VALUES (?, ?, ?, 1)',
      [newId, categoryId, name]
    );
    
    res.json({ success: true, data: { id: newId, name, categoryId }, message: 'Subcategory added successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error adding subcategory', error: error.message });
  }
});

// Get all categories with subcategories
router.get('/all', async (req, res) => {
  try {
    if (isDbConnected && pool) {
      const [categories] = await pool.execute('SELECT * FROM categories WHERE is_active = 1 ORDER BY name');
      const [subcategories] = await pool.execute('SELECT * FROM subcategories WHERE is_active = 1');
      
      if (categories.length > 0) {
        const result = categories.map(cat => ({
          ...cat,
          subcategories: subcategories.filter(sub => sub.category_id === cat.id)
        }));
        return res.json({ success: true, data: result });
      }
    }
    // Fallback to config
    res.json({ success: true, data: configCategories });
  } catch (error) {
    res.json({ success: true, data: configCategories });
  }
});

module.exports = router;
