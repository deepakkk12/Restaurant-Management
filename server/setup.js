const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// Ensure database directory exists
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(__dirname, 'database', 'restaurant.db');

// Remove existing database to ensure clean setup
if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('Removed existing database for clean setup');
}

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
    console.log('Connected to SQLite database');
});

// Hash password function
const hashPassword = async (password) => {
    return await bcrypt.hash(password, 12);
};

// Promisify database operations
const runQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this);
            }
        });
    });
};

const prepareStatement = (sql) => {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(sql, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(stmt);
            }
        });
    });
};

// Database setup function
async function setupDatabase() {
    try {
        console.log('Setting up database tables...');

        // Enable foreign keys
        await runQuery('PRAGMA foreign_keys = ON');

        // Create signup_users table (temporary storage for signup process)
        await runQuery(`
            CREATE TABLE IF NOT EXISTS signup_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT,
                phone TEXT,
                password_hash TEXT NOT NULL,
                otp TEXT,
                otp_expires DATETIME,
                is_verified BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create login_users table (verified users who can login)
        await runQuery(`
            CREATE TABLE IF NOT EXISTS login_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE,
                phone TEXT UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'customer',
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create restaurants table first (referenced by other tables)
        await runQuery(`
            CREATE TABLE IF NOT EXISTS restaurants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                cuisine TEXT NOT NULL,
                rating REAL DEFAULT 4.5,
                image TEXT,
                address TEXT,
                phone TEXT,
                description TEXT,
                admin_id TEXT UNIQUE NOT NULL,
                admin_password_hash TEXT NOT NULL,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create users table (includes admins and superadmins)
        await runQuery(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE,
                phone TEXT,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'customer',
                restaurant_id INTEGER,
                admin_id TEXT UNIQUE,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
            )
        `);

        // Create restaurant_tables table
        await runQuery(`
            CREATE TABLE IF NOT EXISTS restaurant_tables (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                restaurant_id INTEGER NOT NULL,
                table_number INTEGER NOT NULL,
                capacity INTEGER NOT NULL,
                status TEXT DEFAULT 'available',
                type TEXT DEFAULT 'standard',
                features TEXT,
                image TEXT,
                x_position INTEGER DEFAULT 0,
                y_position INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
            )
        `);

        // Create menu_items table WITH cuisine column
        await runQuery(`
            CREATE TABLE IF NOT EXISTS menu_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                restaurant_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                cuisine TEXT NOT NULL,
                price REAL NOT NULL,
                description TEXT,
                image TEXT,
                dietary TEXT,
                chef_special BOOLEAN DEFAULT 0,
                available BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
            )
        `);

        // Create bookings table
        await runQuery(`
            CREATE TABLE IF NOT EXISTS bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                restaurant_id INTEGER NOT NULL,
                table_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                time TEXT NOT NULL,
                guests INTEGER NOT NULL,
                special_requests TEXT,
                status TEXT DEFAULT 'confirmed',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES login_users (id),
                FOREIGN KEY (restaurant_id) REFERENCES restaurants (id),
                FOREIGN KEY (table_id) REFERENCES restaurant_tables (id)
            )
        `);

        // Create orders table
        await runQuery(`
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                restaurant_id INTEGER NOT NULL,
                order_type TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                total_amount REAL NOT NULL,
                scheduled_time TEXT,
                special_instructions TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES login_users (id),
                FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
            )
        `);

        // Create order_items table
        await runQuery(`
            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                menu_item_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                price REAL NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders (id),
                FOREIGN KEY (menu_item_id) REFERENCES menu_items (id)
            )
        `);

        // Create order_status_history table
        await runQuery(`
            CREATE TABLE IF NOT EXISTS order_status_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                status TEXT NOT NULL,
                changed_by INTEGER,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders (id),
                FOREIGN KEY (changed_by) REFERENCES users (id)
            )
        `);

        // Create otp_logs table
        await runQuery(`
            CREATE TABLE IF NOT EXISTS otp_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mobile TEXT NOT NULL,
                otp TEXT NOT NULL,
                expires_at DATETIME NOT NULL,
                status TEXT DEFAULT 'unused',
                user_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES login_users (id)
            )
        `);

        // Create table_images table
        await runQuery(`
            CREATE TABLE IF NOT EXISTS table_images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                table_id INTEGER NOT NULL,
                image_path TEXT NOT NULL,
                description TEXT,
                is_primary BOOLEAN DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (table_id) REFERENCES restaurant_tables (id)
            )
        `);

        // Create notifications table
        await runQuery(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                restaurant_id INTEGER,
                booking_id INTEGER,
                order_id INTEGER,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                type TEXT DEFAULT 'info',
                is_read BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES login_users (id),
                FOREIGN KEY (restaurant_id) REFERENCES restaurants (id),
                FOREIGN KEY (booking_id) REFERENCES bookings (id),
                FOREIGN KEY (order_id) REFERENCES orders (id)
            )
        `);

        console.log('All tables created successfully');
        console.log('Inserting sample data...');

        // Insert sample restaurants with hashed passwords
        const adminPassword = await hashPassword('admin123');
        const restaurants = [
            [1, 'Taj Mahal Palace', 'North Indian', 4.9, 'https://images.pexels.com/photos/5409020/pexels-photo-5409020.jpeg', '123 Delhi Street, Indian Quarter', '+91 (555) 123-4567', 'Authentic North Indian cuisine with royal recipes from Mughal era. Experience the rich flavors of tandoori delicacies, aromatic biryanis, and creamy curries', 'TM001', adminPassword],
            [2, 'Spice Garden', 'South Indian', 4.8, 'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg', '456 Chennai Avenue, Spice District', '+91 (555) 234-5678', 'Traditional South Indian flavors featuring crispy dosas, fluffy idlis, and aromatic sambar. Taste the authentic spices of Kerala and Tamil Nadu', 'SG002', adminPassword],
            [3, 'Mumbai Masala', 'Street Food & Chaat', 4.7, 'https://images.pexels.com/photos/1893556/pexels-photo-1893556.jpeg', '789 Mumbai Road, Street Food Plaza', '+91 (555) 345-6789', 'Experience the vibrant street food culture of Mumbai with delicious chaats, pav bhaji, vada pav, and authentic Indian snacks', 'MM003', adminPassword]
        ];

        const restaurantStmt = await prepareStatement(`
            INSERT OR IGNORE INTO restaurants 
            (id, name, cuisine, rating, image, address, phone, description, admin_id, admin_password_hash) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const restaurant of restaurants) {
            await new Promise((resolve, reject) => {
                restaurantStmt.run(restaurant, function(err) {
                    if (err) reject(err);
                    else resolve(this);
                });
            });
        }
        restaurantStmt.finalize();

        // Insert admin users
        const superAdminPassword = await hashPassword('superadmin2025');
        const adminUsers = [
            ['Taj Mahal Admin', 'admin@tajmahalpalace.com', null, adminPassword, 'admin', 1, 'TM001'],
            ['Spice Garden Admin', 'admin@spicegarden.com', null, adminPassword, 'admin', 2, 'SG002'],
            ['Mumbai Masala Admin', 'admin@mumbaimasala.com', null, adminPassword, 'admin', 3, 'MM003'],
            ['Platform Owner', 'owner@restaurantai.com', null, superAdminPassword, 'superadmin', null, null]
        ];

        const userStmt = await prepareStatement(`
            INSERT OR IGNORE INTO users 
            (name, email, phone, password_hash, role, restaurant_id, admin_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const user of adminUsers) {
            await new Promise((resolve, reject) => {
                userStmt.run(user, function(err) {
                    if (err) reject(err);
                    else resolve(this);
                });
            });
        }
        userStmt.finalize();

        // Insert sample menu items WITH cuisine column
        const menuItems = [
            // Taj Mahal Palace - North Indian
            [1, 'Tandoori Chicken', 'Tandoori Specials', 'North Indian', 599, 'Succulent chicken marinated in yogurt and spices, cooked to perfection in clay oven', 'https://images.pexels.com/photos/6210747/pexels-photo-6210747.jpeg', 'gluten-free', 1, 1],
            [1, 'Butter Chicken', 'Mains', 'North Indian', 499, 'Tender chicken pieces in rich creamy tomato gravy with aromatic spices', 'https://images.pexels.com/photos/2474661/pexels-photo-2474661.jpeg', 'gluten-free', 1, 1],
            [1, 'Paneer Tikka', 'Starters', 'North Indian', 349, 'Cottage cheese cubes marinated in spices and grilled in tandoor', 'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg', 'vegetarian,gluten-free', 0, 1],
            [1, 'Dal Makhani', 'Mains', 'North Indian', 299, 'Slow-cooked black lentils with cream and butter, a Punjabi specialty', 'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg', 'vegetarian,healthy', 0, 1],
            [1, 'Biryani (Chicken)', 'Rice & Biryani', 'North Indian', 449, 'Fragrant basmati rice layered with spiced chicken and aromatic herbs', 'https://images.pexels.com/photos/16743486/pexels-photo-16743486.jpeg', 'gluten-free', 1, 1],
            [1, 'Naan Basket', 'Breads', 'North Indian', 149, 'Assorted Indian breads - plain naan, butter naan, and garlic naan', 'https://images.pexels.com/photos/8753876/pexels-photo-8753876.jpeg', 'vegetarian', 0, 1],
            [1, 'Gulab Jamun', 'Desserts', 'North Indian', 129, 'Soft milk dumplings soaked in rose-flavored sugar syrup', 'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg', 'vegetarian', 0, 1],
            [1, 'Rogan Josh', 'Mains', 'North Indian', 549, 'Kashmiri lamb curry with aromatic spices in rich gravy', 'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg', 'gluten-free', 0, 1],

            // Spice Garden - South Indian
            [2, 'Masala Dosa', 'Dosas', 'South Indian', 199, 'Crispy rice crepe filled with spiced potato masala, served with sambar and chutney', 'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg', 'vegetarian,healthy', 1, 1],
            [2, 'Idli Sambar', 'Breakfast', 'South Indian', 149, 'Steamed rice cakes served with lentil soup and coconut chutney', 'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg', 'vegetarian,healthy,gluten-free', 0, 1],
            [2, 'Medu Vada', 'Starters', 'South Indian', 129, 'Crispy lentil donuts served with sambar and chutney', 'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg', 'vegetarian,gluten-free', 0, 1],
            [2, 'Hyderabadi Biryani', 'Rice & Biryani', 'South Indian', 399, 'Authentic Hyderabadi style biryani with tender meat and fragrant spices', 'https://images.pexels.com/photos/16743486/pexels-photo-16743486.jpeg', 'gluten-free', 1, 1],
            [2, 'Rasam', 'Soups', 'South Indian', 99, 'Tangy tamarind soup with tomatoes and aromatic spices', 'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg', 'vegetarian,healthy,gluten-free', 0, 1],
            [2, 'Uttapam', 'Dosas', 'South Indian', 179, 'Thick rice pancake topped with onions, tomatoes, and chilies', 'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg', 'vegetarian', 0, 1],
            [2, 'Payasam', 'Desserts', 'South Indian', 119, 'Traditional South Indian rice pudding with cardamom and cashews', 'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg', 'vegetarian', 0, 1],

            // Mumbai Masala - Street Food
            [3, 'Pav Bhaji', 'Street Food', 'Street Food', 169, 'Spicy mashed vegetable curry served with buttered bread rolls', 'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg', 'vegetarian', 1, 1],
            [3, 'Vada Pav', 'Street Food', 'Street Food', 79, 'Mumbai\'s iconic potato fritter sandwich with spicy chutneys', 'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg', 'vegetarian', 0, 1],
            [3, 'Pani Puri', 'Chaat', 'Street Food', 99, 'Crispy hollow puris filled with spicy tamarind water and potato', 'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg', 'vegetarian', 0, 1],
            [3, 'Bhel Puri', 'Chaat', 'Street Food', 89, 'Puffed rice mixed with vegetables, tamarind, and spicy chutneys', 'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg', 'vegetarian,healthy', 0, 1],
            [3, 'Dahi Puri', 'Chaat', 'Street Food', 109, 'Crispy puris topped with yogurt, chutneys, and sev', 'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg', 'vegetarian', 0, 1],
            [3, 'Samosa Chaat', 'Chaat', 'Street Food', 129, 'Crispy samosas topped with chickpea curry, yogurt, and chutneys', 'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg', 'vegetarian', 1, 1],
            [3, 'Misal Pav', 'Street Food', 'Street Food', 149, 'Spicy sprouts curry topped with farsan, served with pav', 'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg', 'vegetarian,healthy', 0, 1],
            [3, 'Kulfi Falooda', 'Desserts', 'Street Food', 99, 'Traditional Indian ice cream with vermicelli, rose syrup, and nuts', 'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg', 'vegetarian', 0, 1]
        ];

        const menuStmt = await prepareStatement(`
            INSERT OR IGNORE INTO menu_items 
            (restaurant_id, name, category, cuisine, price, description, image, dietary, chef_special, available) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const item of menuItems) {
            await new Promise((resolve, reject) => {
                menuStmt.run(item, function(err) {
                    if (err) reject(err);
                    else resolve(this);
                });
            });
        }
        menuStmt.finalize();

        // Insert sample restaurant tables
        const restaurantTables = [
            // The Golden Spoon tables
            [1, 1, 2, 'available', 'standard', 'Window view', null, 100, 100],
            [1, 2, 4, 'available', 'standard', 'Center dining', null, 200, 100],
            [1, 3, 6, 'available', 'premium', 'Private booth', null, 300, 100],
            [1, 4, 8, 'available', 'premium', 'VIP section', null, 400, 100],
            [1, 5, 2, 'available', 'standard', 'Quiet corner', null, 150, 200],
            
            // Sakura Sushi tables
            [2, 1, 2, 'available', 'standard', 'Sushi bar view', null, 100, 150],
            [2, 2, 4, 'available', 'standard', 'Traditional seating', null, 200, 150],
            [2, 3, 6, 'available', 'premium', 'Tatami room', null, 300, 150],
            [2, 4, 8, 'available', 'premium', 'Private dining', null, 400, 150],
            
            // Mama's Italian tables
            [3, 1, 4, 'available', 'standard', 'Family style', null, 100, 200],
            [3, 2, 2, 'available', 'standard', 'Romantic corner', null, 200, 200],
            [3, 3, 8, 'available', 'premium', 'Large family table', null, 300, 200],
            [3, 4, 6, 'available', 'standard', 'Garden view', null, 250, 250]
        ];

        const tableStmt = await prepareStatement(`
            INSERT OR IGNORE INTO restaurant_tables 
            (restaurant_id, table_number, capacity, status, type, features, image, x_position, y_position) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const table of restaurantTables) {
            await new Promise((resolve, reject) => {
                tableStmt.run(table, function(err) {
                    if (err) reject(err);
                    else resolve(this);
                });
            });
        }
        tableStmt.finalize();

        console.log('✅ Database setup completed successfully!');
        console.log('\n📊 Sample Data Inserted:');
        console.log('- 3 Indian Restaurants with admin accounts');
        console.log('- 1 Super admin account');
        console.log('- Restaurant tables for each location');
        console.log('- Authentic Indian menu items');
        console.log('\n🔐 Demo Credentials:');
        console.log('Restaurant Admins: TM001/admin123, SG002/admin123, MM003/admin123');
        console.log('Super Admin: owner@restaurantai.com/superadmin2025');
        console.log('\n🚀 Run "npm start" to start the server');
        console.log('\n🍛 Indian Restaurants:');
        console.log('1. Taj Mahal Palace - North Indian Cuisine');
        console.log('2. Spice Garden - South Indian Cuisine');
        console.log('3. Mumbai Masala - Street Food & Chaat');

    } catch (error) {
        console.error('Error setting up database:', error);
        process.exit(1);
    } finally {
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err.message);
            } else {
                console.log('Database connection closed.');
            }
            process.exit(0);
        });
    }
}

// Run setup
setupDatabase();