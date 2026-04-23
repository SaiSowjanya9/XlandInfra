const express = require('express');
const router = express.Router();
const categories = require('../config/categories');
const { pool } = require('../config/database');

// Get all categories (from static config)
router.get('/', (req, res) => {
  try {
    const categoryList = categories.map(cat => ({
      id: cat.id,
      name: cat.name
    }));
    res.json({ success: true, data: categoryList });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching categories', error: error.message });
  }
});

// Get subcategories by category ID
router.get('/:categoryId/subcategories', (req, res) => {
  try {
    const categoryId = parseInt(req.params.categoryId);
    const category = categories.find(cat => cat.id === categoryId);
    
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    
    const subcategoryList = category.subcategories.map((sub, index) => ({
      id: index + 1,
      name: sub,
      categoryId: categoryId
    }));
    
    res.json({ success: true, data: subcategoryList });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching subcategories', error: error.message });
  }
});

// Get all categories with subcategories
router.get('/all', (req, res) => {
  try {
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching categories', error: error.message });
  }
});

module.exports = router;
