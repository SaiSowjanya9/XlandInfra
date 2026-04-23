-- Create database
CREATE DATABASE IF NOT EXISTS customer_portal;
USE customer_portal;

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  unit_number VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subcategories table
CREATE TABLE IF NOT EXISTS subcategories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Work Orders table
CREATE TABLE IF NOT EXISTS work_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id INT,
  category_id INT NOT NULL,
  subcategory_id INT NOT NULL,
  description TEXT,
  permission_to_enter ENUM('yes', 'no') NOT NULL DEFAULT 'no',
  entry_notes TEXT,
  has_pet ENUM('yes', 'no') NOT NULL DEFAULT 'no',
  status ENUM('pending', 'assigned', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
  priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  scheduled_date DATETIME,
  completed_date DATETIME,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (subcategory_id) REFERENCES subcategories(id)
);

-- Attachments table
CREATE TABLE IF NOT EXISTS attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  work_order_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  file_size INT NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE
);

-- Insert default categories
INSERT INTO categories (name) VALUES
('Lifts'),
('Drainage'),
('Septic Cleaning'),
('Generator'),
('Water Tank Cleaning'),
('AC'),
('Electrical'),
('Plumbing'),
('Appliances'),
('Building Exterior'),
('Building Interior'),
('Flooring'),
('Locks / Keys'),
('Painting'),
('Pest Control'),
('Water Purification'),
('Hot Water Geyser'),
('Other');

-- Insert subcategories for Lifts (category_id: 1)
INSERT INTO subcategories (category_id, name) VALUES
(1, 'Elevator Maintenance'),
(1, 'Lift Motor Repair'),
(1, 'Door Mechanism'),
(1, 'Control Panel'),
(1, 'Safety Sensors'),
(1, 'Lift Cables'),
(1, 'Emergency Phone'),
(1, 'Other');

-- Insert subcategories for Drainage (category_id: 2)
INSERT INTO subcategories (category_id, name) VALUES
(2, 'Blocked Drain'),
(2, 'Slow Drainage'),
(2, 'Drain Cleaning'),
(2, 'Pipe Repair'),
(2, 'Drain Inspection'),
(2, 'Storm Drain'),
(2, 'Floor Drain'),
(2, 'Other');

-- Insert subcategories for Septic Cleaning (category_id: 3)
INSERT INTO subcategories (category_id, name) VALUES
(3, 'Septic Tank Pumping'),
(3, 'Tank Inspection'),
(3, 'Drain Field Repair'),
(3, 'Septic System Maintenance'),
(3, 'Odor Issues'),
(3, 'Backup Problems'),
(3, 'Other');

-- Insert subcategories for Generator (category_id: 4)
INSERT INTO subcategories (category_id, name) VALUES
(4, 'Generator Maintenance'),
(4, 'Fuel System'),
(4, 'Battery Replacement'),
(4, 'Electrical Connections'),
(4, 'Noise Issues'),
(4, 'Start-up Problems'),
(4, 'Transfer Switch'),
(4, 'Other');

-- Insert subcategories for Water Tank Cleaning (category_id: 5)
INSERT INTO subcategories (category_id, name) VALUES
(5, 'Tank Sanitization'),
(5, 'Sediment Removal'),
(5, 'Tank Inspection'),
(5, 'Leak Repair'),
(5, 'Valve Replacement'),
(5, 'Float Adjustment'),
(5, 'Other');

-- Insert subcategories for AC (category_id: 6)
INSERT INTO subcategories (category_id, name) VALUES
(6, 'AC Not Cooling'),
(6, 'AC Not Turning On'),
(6, 'Strange Noises'),
(6, 'Water Leakage'),
(6, 'Gas Refilling'),
(6, 'Filter Cleaning'),
(6, 'Compressor Issues'),
(6, 'Thermostat Problems'),
(6, 'Duct Cleaning'),
(6, 'Installation'),
(6, 'Other');

-- Insert subcategories for Electrical (category_id: 7)
INSERT INTO subcategories (category_id, name) VALUES
(7, 'Power Outage'),
(7, 'Circuit Breaker'),
(7, 'Wiring Issues'),
(7, 'Switch Replacement'),
(7, 'Outlet Installation'),
(7, 'Light Fixture'),
(7, 'Fan Installation'),
(7, 'Electrical Panel'),
(7, 'Grounding Issues'),
(7, 'Other');

-- Insert subcategories for Plumbing (category_id: 8)
INSERT INTO subcategories (category_id, name) VALUES
(8, 'Leaky Faucet'),
(8, 'Clogged Toilet'),
(8, 'Pipe Leak'),
(8, 'Water Heater'),
(8, 'Low Water Pressure'),
(8, 'Running Toilet'),
(8, 'Garbage Disposal'),
(8, 'Sump Pump'),
(8, 'Water Line'),
(8, 'Other');

-- Insert subcategories for Appliances (category_id: 9)
INSERT INTO subcategories (category_id, name) VALUES
(9, 'Oven'),
(9, 'Refrigerator'),
(9, 'Washer'),
(9, 'Dryer'),
(9, 'Dishwasher'),
(9, 'Microwave'),
(9, 'Garbage Disposal'),
(9, 'Range Hood'),
(9, 'Ice Maker'),
(9, 'Freezer'),
(9, 'Other');

-- Insert subcategories for Building Exterior (category_id: 10)
INSERT INTO subcategories (category_id, name) VALUES
(10, 'Roof Repair'),
(10, 'Gutter Cleaning'),
(10, 'Siding Repair'),
(10, 'Window Repair'),
(10, 'Door Repair'),
(10, 'Deck/Patio'),
(10, 'Fence Repair'),
(10, 'Driveway'),
(10, 'Landscaping'),
(10, 'Other');

-- Insert subcategories for Building Interior (category_id: 11)
INSERT INTO subcategories (category_id, name) VALUES
(11, 'Wall Repair'),
(11, 'Ceiling Repair'),
(11, 'Door Adjustment'),
(11, 'Window Treatment'),
(11, 'Cabinet Repair'),
(11, 'Countertop'),
(11, 'Staircase'),
(11, 'Handrail'),
(11, 'Other');

-- Insert subcategories for Flooring (category_id: 12)
INSERT INTO subcategories (category_id, name) VALUES
(12, 'Tile Repair'),
(12, 'Hardwood Repair'),
(12, 'Carpet Repair'),
(12, 'Laminate Flooring'),
(12, 'Vinyl Flooring'),
(12, 'Grout Repair'),
(12, 'Floor Polishing'),
(12, 'Subfloor Issues'),
(12, 'Other');

-- Insert subcategories for Locks / Keys (category_id: 13)
INSERT INTO subcategories (category_id, name) VALUES
(13, 'Lock Replacement'),
(13, 'Key Duplication'),
(13, 'Lock Repair'),
(13, 'Deadbolt Installation'),
(13, 'Smart Lock'),
(13, 'Lockout Service'),
(13, 'Rekeying'),
(13, 'Safe Opening'),
(13, 'Other');

-- Insert subcategories for Painting (category_id: 14)
INSERT INTO subcategories (category_id, name) VALUES
(14, 'Interior Painting'),
(14, 'Exterior Painting'),
(14, 'Touch-up Work'),
(14, 'Wallpaper Removal'),
(14, 'Wallpaper Installation'),
(14, 'Staining'),
(14, 'Primer Application'),
(14, 'Other');

-- Insert subcategories for Pest Control (category_id: 15)
INSERT INTO subcategories (category_id, name) VALUES
(15, 'Ants'),
(15, 'Cockroaches'),
(15, 'Termites'),
(15, 'Rodents'),
(15, 'Bed Bugs'),
(15, 'Mosquitoes'),
(15, 'Flies'),
(15, 'Spiders'),
(15, 'Wasps/Bees'),
(15, 'General Inspection'),
(15, 'Other');

-- Insert subcategories for Water Purification (category_id: 16)
INSERT INTO subcategories (category_id, name) VALUES
(16, 'Filter Replacement'),
(16, 'RO System Maintenance'),
(16, 'UV Purifier'),
(16, 'Water Softener'),
(16, 'Installation'),
(16, 'Water Testing'),
(16, 'Membrane Replacement'),
(16, 'Other');

-- Insert subcategories for Hot Water Geyser (category_id: 17)
INSERT INTO subcategories (category_id, name) VALUES
(17, 'No Hot Water'),
(17, 'Water Too Hot'),
(17, 'Leaking'),
(17, 'Strange Noises'),
(17, 'Thermostat Issues'),
(17, 'Element Replacement'),
(17, 'Tank Replacement'),
(17, 'Installation'),
(17, 'Other');

-- Insert subcategories for Other (category_id: 18)
INSERT INTO subcategories (category_id, name) VALUES
(18, 'General Maintenance'),
(18, 'Inspection Request'),
(18, 'Custom Request'),
(18, 'Other');
