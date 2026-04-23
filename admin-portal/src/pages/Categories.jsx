import { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  ChevronDown, 
  ChevronRight, 
  Save, 
  X, 
  FolderPlus,
  Search,
  AlertCircle
} from 'lucide-react';

const initialCategories = [
  { id: 1, name: 'Lifts', subcategories: ['Stopped', 'Not moving', 'Door stuck', 'Unusual noise', 'Emergency alarm issue', 'Lift shaking / jerking', 'Other'] },
  { id: 2, name: 'Drainage', subcategories: ['Drain blocked', 'Slow drainage', 'Drain overflow', 'Backflow issue', 'Rainwater not clearing', 'Pipe damage', 'Other'] },
  { id: 3, name: 'Septic Cleaning', subcategories: ['Septic tank full', 'Bad smell', 'Overflow', 'Blockage', 'Slow outflow', 'Leakage around tank', 'Cleaning required', 'Inspection required', 'Lid damage', 'Emergency service needed', 'Other'] },
  { id: 4, name: 'Generator', subcategories: ['Not starting', 'Low power output', 'Fuel leakage', 'Battery problem', 'Unusual noise', 'Smoke issue', 'Auto start not working', 'Overheating', 'Service due', 'Electrical trip issue', 'Other'] },
  { id: 5, name: 'Water Tank Cleaning', subcategories: ['Cleaning required', 'Dirty water', 'Bad smell', 'Algae formation', 'Tank leakage', 'Inlet problem', 'Outlet problem', 'Lid damage', 'Overflow issue', 'Other'] },
  { id: 6, name: 'AC', subcategories: ['Not cooling', 'Low cooling', 'Water leakage', 'Not turning on', 'Unusual noise', 'Bad smell', 'Remote not working', 'Gas refill needed', 'Airflow issue', 'Service / maintenance required', 'Other'] },
  { id: 7, name: 'Electrical', subcategories: ['Power outage', 'Switch not working', 'Socket not working', 'MCB tripping', 'Light not working', 'Fan not working', 'Wiring issue', 'Burning smell', 'Short circuit issue', 'New electrical work needed', 'Other'] },
  { id: 8, name: 'Plumbing', subcategories: ['Water leakage', 'Tap issue', 'Pipe burst', 'Low water pressure', 'Drain blockage', 'Flush not working', 'Sink problem', 'Toilet problem', 'Valve issue', 'New plumbing work needed', 'Other'] },
  { id: 9, name: 'Appliances', applianceTypes: ['Refrigerator', 'Washing Machine', 'Dishwasher', 'Microwave / Oven', 'Chimney / Exhaust', 'TV', 'Water Dispenser', 'Dryer'], subcategories: ['Not working', 'Not turning on', 'Unusual noise', 'Button / control issue', 'Installation needed', 'Service required', 'Other'] },
  { id: 10, name: 'Building Exterior', subcategories: ['Other'] },
  { id: 11, name: 'Locks / Keys', subcategories: ['Lock not working', 'Key lost', 'Key broken', 'Door jammed', 'Lock replacement needed', 'Smart lock issue', 'Handle issue', 'Latch issue', 'Emergency lock opening', 'Other'] },
  { id: 12, name: 'Painting', subcategories: ['Repainting needed', 'Paint peeling', 'Wall stains', 'Color fading', 'Crack filling needed', 'Exterior painting needed', 'Interior painting needed', 'Touch-up required', 'Ceiling paint issue', 'Other'] },
  { id: 13, name: 'Pest Control', subcategories: ['Cockroach issue', 'Mosquito issue', 'Termite issue', 'Bed bug issue', 'General pest treatment needed', 'Repeat treatment needed', 'Outdoor pest issue', 'Emergency infestation complaint', 'Other'] },
  { id: 14, name: 'Water Purification', subcategories: ['Purifier not working', 'No water output', 'Low water flow', 'Water taste issue', 'Filter replacement needed', 'Leakage issue', 'Power issue', 'Service required', 'Installation needed', 'Other'] },
  { id: 15, name: 'Hot Water Geyser', subcategories: ['Not heating', 'Low hot water', 'Water leakage', 'Not turning on', 'Thermostat issue', 'Pressure issue', 'Unusual noise', 'Power issue', 'Service required', 'Replacement needed', 'Other'] },
];

const Categories = ({ admin }) => {
  const [categories, setCategories] = useState(initialCategories);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [addingSubcategoryTo, setAddingSubcategoryTo] = useState(null);
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [editingSubcategory, setEditingSubcategory] = useState(null);
  const [editingSubcategoryName, setEditingSubcategoryName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cat.subcategories.some(sub => sub.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    
    const newId = Math.max(...categories.map(c => c.id)) + 1;
    setCategories([...categories, {
      id: newId,
      name: newCategoryName.trim(),
      subcategories: ['Other']
    }]);
    setNewCategoryName('');
    setShowAddCategory(false);
  };

  const handleEditCategory = (categoryId) => {
    if (!editingCategoryName.trim()) return;
    
    setCategories(categories.map(cat =>
      cat.id === categoryId ? { ...cat, name: editingCategoryName.trim() } : cat
    ));
    setEditingCategory(null);
    setEditingCategoryName('');
  };

  const handleDeleteCategory = (categoryId) => {
    setCategories(categories.filter(cat => cat.id !== categoryId));
    setDeleteConfirm(null);
  };

  const handleAddSubcategory = (categoryId) => {
    if (!newSubcategoryName.trim()) return;
    
    setCategories(categories.map(cat =>
      cat.id === categoryId
        ? { ...cat, subcategories: [...cat.subcategories.filter(s => s !== 'Other'), newSubcategoryName.trim(), 'Other'] }
        : cat
    ));
    setNewSubcategoryName('');
    setAddingSubcategoryTo(null);
  };

  const handleEditSubcategory = (categoryId, oldName) => {
    if (!editingSubcategoryName.trim()) return;
    
    setCategories(categories.map(cat =>
      cat.id === categoryId
        ? { ...cat, subcategories: cat.subcategories.map(sub => sub === oldName ? editingSubcategoryName.trim() : sub) }
        : cat
    ));
    setEditingSubcategory(null);
    setEditingSubcategoryName('');
  };

  const handleDeleteSubcategory = (categoryId, subName) => {
    setCategories(categories.map(cat =>
      cat.id === categoryId
        ? { ...cat, subcategories: cat.subcategories.filter(sub => sub !== subName) }
        : cat
    ));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories Management</h1>
          <p className="text-gray-600 mt-1">Manage work order categories and subcategories</p>
        </div>
        <button
          onClick={() => setShowAddCategory(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Add Category</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search categories or subcategories..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      {/* Add Category Modal */}
      {showAddCategory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Category</h3>
            <input
              type="text"
              placeholder="Category name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 mb-4"
              autoFocus
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => { setShowAddCategory(false); setNewCategoryName(''); }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCategory}
                disabled={!newCategoryName.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center space-x-3 text-red-600 mb-4">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-lg font-semibold">Delete Category</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete "{categories.find(c => c.id === deleteConfirm)?.name}"? 
              This will also delete all subcategories and cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteCategory(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total Categories</p>
          <p className="text-2xl font-bold text-gray-900">{categories.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total Subcategories</p>
          <p className="text-2xl font-bold text-gray-900">
            {categories.reduce((acc, cat) => acc + cat.subcategories.length, 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Avg. Subcategories</p>
          <p className="text-2xl font-bold text-gray-900">
            {(categories.reduce((acc, cat) => acc + cat.subcategories.length, 0) / categories.length).toFixed(1)}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Most Subcategories</p>
          <p className="text-2xl font-bold text-gray-900">
            {Math.max(...categories.map(c => c.subcategories.length))}
          </p>
        </div>
      </div>

      {/* Categories List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-900">All Categories ({filteredCategories.length})</h2>
        </div>
        
        <div className="divide-y divide-gray-200">
          {filteredCategories.map((category) => (
            <div key={category.id} className="bg-white">
              {/* Category Row */}
              <div className="flex items-center justify-between px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center space-x-3 flex-1">
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                  >
                    {expandedCategories[category.id] ? (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-500" />
                    )}
                  </button>
                  
                  {editingCategory === category.id ? (
                    <div className="flex items-center space-x-2 flex-1">
                      <input
                        type="text"
                        value={editingCategoryName}
                        onChange={(e) => setEditingCategoryName(e.target.value)}
                        className="flex-1 px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        autoFocus
                      />
                      <button
                        onClick={() => handleEditCategory(category.id)}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                      >
                        <Save className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => { setEditingCategory(null); setEditingCategoryName(''); }}
                        className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium text-gray-900">{category.name}</span>
                      <span className="text-sm text-gray-500">
                        ({category.subcategories.length} subcategories)
                      </span>
                    </>
                  )}
                </div>
                
                {editingCategory !== category.id && (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setAddingSubcategoryTo(category.id)}
                      className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      title="Add Subcategory"
                    >
                      <FolderPlus className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => { setEditingCategory(category.id); setEditingCategoryName(category.name); }}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit Category"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(category.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Category"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
              
              {/* Subcategories */}
              {expandedCategories[category.id] && (
                <div className="px-6 pb-4 bg-gray-50">
                  <div className="ml-8 space-y-2">
                    {/* Add Subcategory Input */}
                    {addingSubcategoryTo === category.id && (
                      <div className="flex items-center space-x-2 py-2">
                        <input
                          type="text"
                          placeholder="New subcategory name"
                          value={newSubcategoryName}
                          onChange={(e) => setNewSubcategoryName(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleAddSubcategory(category.id)}
                          disabled={!newSubcategoryName.trim()}
                          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => { setAddingSubcategoryTo(null); setNewSubcategoryName(''); }}
                          className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    
                    {/* Subcategories List */}
                    {category.subcategories.map((sub, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-2 px-3 bg-white rounded-lg border border-gray-200"
                      >
                        {editingSubcategory === `${category.id}-${sub}` ? (
                          <div className="flex items-center space-x-2 flex-1">
                            <input
                              type="text"
                              value={editingSubcategoryName}
                              onChange={(e) => setEditingSubcategoryName(e.target.value)}
                              className="flex-1 px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                              autoFocus
                            />
                            <button
                              onClick={() => handleEditSubcategory(category.id, sub)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => { setEditingSubcategory(null); setEditingSubcategoryName(''); }}
                              className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="text-gray-700">{sub}</span>
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => { setEditingSubcategory(`${category.id}-${sub}`); setEditingSubcategoryName(sub); }}
                                className="p-1 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {sub !== 'Other' && (
                                <button
                                  onClick={() => handleDeleteSubcategory(category.id, sub)}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Categories;
