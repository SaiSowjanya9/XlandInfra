/**
 * Pricing Routes
 * RBAC: Admin - full access (create/edit/delete), Manager - view only
 * Supervisor/Executive - NO ACCESS
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { 
  adminOnly,
  canSeePricing,
  requireMasterDataAccess,
  ROLES
} = require('../middleware/rbac');

// Get all pricing (Admin full access, Manager view only)
router.get('/', authenticate, canSeePricing, async (req, res) => {
  try {
    const { categoryId, isActive } = req.query;
    
    let query = `
      SELECT pr.*, 
             c.name as category_name,
             sc.name as subcategory_name,
             p.name as package_name,
             CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM pricing pr
      LEFT JOIN categories c ON pr.category_id = c.id
      LEFT JOIN subcategories sc ON pr.subcategory_id = sc.id
      LEFT JOIN packages p ON pr.package_id = p.id
      LEFT JOIN users u ON pr.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (categoryId) {
      query += ` AND pr.category_id = ?`;
      params.push(categoryId);
    }

    if (isActive !== undefined) {
      query += ` AND pr.is_active = ?`;
      params.push(isActive === 'true');
    }

    query += ` ORDER BY c.name, pr.name`;

    const [pricing] = await pool.execute(query, params);

    res.json({
      success: true,
      data: pricing.map(p => ({
        id: p.id,
        categoryId: p.category_id,
        categoryName: p.category_name,
        subcategoryId: p.subcategory_id,
        subcategoryName: p.subcategory_name,
        packageId: p.package_id,
        packageName: p.package_name,
        name: p.name,
        description: p.description,
        unit: p.unit,
        basePrice: p.base_price,
        minPrice: p.min_price,
        maxPrice: p.max_price,
        isActive: p.is_active,
        createdBy: p.created_by_name,
        createdAt: p.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pricing',
      error: error.message
    });
  }
});

// Get single pricing item (Admin, Manager can view)
router.get('/:id', authenticate, canSeePricing, async (req, res) => {
  try {
    const { id } = req.params;

    const [pricing] = await pool.execute(
      `SELECT pr.*, 
              c.name as category_name,
              sc.name as subcategory_name,
              p.name as package_name
       FROM pricing pr
       LEFT JOIN categories c ON pr.category_id = c.id
       LEFT JOIN subcategories sc ON pr.subcategory_id = sc.id
       LEFT JOIN packages p ON pr.package_id = p.id
       WHERE pr.id = ?`,
      [id]
    );

    if (pricing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pricing not found'
      });
    }

    const p = pricing[0];
    res.json({
      success: true,
      data: {
        id: p.id,
        categoryId: p.category_id,
        categoryName: p.category_name,
        subcategoryId: p.subcategory_id,
        subcategoryName: p.subcategory_name,
        packageId: p.package_id,
        packageName: p.package_name,
        name: p.name,
        description: p.description,
        unit: p.unit,
        basePrice: p.base_price,
        minPrice: p.min_price,
        maxPrice: p.max_price,
        isActive: p.is_active
      }
    });
  } catch (error) {
    console.error('Error fetching pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pricing',
      error: error.message
    });
  }
});

// Create pricing (Admin only - Master Data)
router.post('/', authenticate, adminOnly, async (req, res) => {
  try {
    const { 
      categoryId, subcategoryId, packageId, name, description,
      unit, basePrice, minPrice, maxPrice
    } = req.body;

    if (!name || !basePrice) {
      return res.status(400).json({
        success: false,
        message: 'Name and base price are required'
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO pricing (
        category_id, subcategory_id, package_id, name, description,
        unit, base_price, min_price, max_price, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        categoryId || null, subcategoryId || null, packageId || null,
        name, description || null, unit || 'per_job',
        basePrice, minPrice || null, maxPrice || null, req.user.id
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Pricing created successfully',
      data: {
        id: result.insertId
      }
    });
  } catch (error) {
    console.error('Error creating pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating pricing',
      error: error.message
    });
  }
});

// Update pricing (Admin only - Master Data)
router.put('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      categoryId, subcategoryId, packageId, name, description,
      unit, basePrice, minPrice, maxPrice, isActive
    } = req.body;

    const [result] = await pool.execute(
      `UPDATE pricing SET 
        category_id = ?,
        subcategory_id = ?,
        package_id = ?,
        name = COALESCE(?, name),
        description = ?,
        unit = COALESCE(?, unit),
        base_price = COALESCE(?, base_price),
        min_price = ?,
        max_price = ?,
        is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [
        categoryId, subcategoryId, packageId, name, description,
        unit, basePrice, minPrice, maxPrice, isActive, id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pricing not found'
      });
    }

    res.json({
      success: true,
      message: 'Pricing updated successfully'
    });
  } catch (error) {
    console.error('Error updating pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating pricing',
      error: error.message
    });
  }
});

// Delete pricing (Admin only)
router.delete('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    // Soft delete
    const [result] = await pool.execute(
      `UPDATE pricing SET is_active = FALSE WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pricing not found'
      });
    }

    res.json({
      success: true,
      message: 'Pricing deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting pricing',
      error: error.message
    });
  }
});

// Get pricing by category (for dropdowns - Admin, Manager)
router.get('/category/:categoryId', authenticate, canSeePricing, async (req, res) => {
  try {
    const { categoryId } = req.params;

    const [pricing] = await pool.execute(
      `SELECT id, name, base_price, unit 
       FROM pricing 
       WHERE category_id = ? AND is_active = TRUE
       ORDER BY name`,
      [categoryId]
    );

    res.json({
      success: true,
      data: pricing
    });
  } catch (error) {
    console.error('Error fetching category pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pricing',
      error: error.message
    });
  }
});

module.exports = router;
