import sqlite3
import hashlib
import jwt
import os
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Initialize FastAPI app
app = FastAPI(title="Restaurant Management System API", version="1.0.0")

# Add CORS middleware to allow frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()
SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"

# Database setup
DATABASE_PATH = "restaurant_management.db"

def init_database():
    """Initialize the database with all required tables"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'customer',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT 1
        )
    ''')
    
    # Restaurants table
    cursor.execute('''
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Tables table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tables (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            restaurant_id INTEGER,
            number INTEGER NOT NULL,
            capacity INTEGER NOT NULL,
            status TEXT DEFAULT 'available',
            type TEXT DEFAULT 'standard',
            features TEXT,
            image TEXT,
            x INTEGER DEFAULT 0,
            y INTEGER DEFAULT 0,
            FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
        )
    ''')
    
    # Menu items table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS menu_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            restaurant_id INTEGER,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            price REAL NOT NULL,
            description TEXT,
            image TEXT,
            dietary TEXT,
            chef_special BOOLEAN DEFAULT 0,
            available BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
        )
    ''')
    
    # Bookings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            restaurant_id INTEGER,
            table_id INTEGER,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            guests INTEGER NOT NULL,
            special_requests TEXT,
            status TEXT DEFAULT 'confirmed',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (restaurant_id) REFERENCES restaurants (id),
            FOREIGN KEY (table_id) REFERENCES tables (id)
        )
    ''')
    
    # Orders table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            restaurant_id INTEGER,
            order_type TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            total_amount REAL NOT NULL,
            scheduled_time TEXT,
            special_instructions TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
        )
    ''')
    
    # Order items table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER,
            menu_item_id INTEGER,
            quantity INTEGER NOT NULL,
            price REAL NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders (id),
            FOREIGN KEY (menu_item_id) REFERENCES menu_items (id)
        )
    ''')
    
    # AI chat history table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ai_chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            message TEXT NOT NULL,
            response TEXT NOT NULL,
            context TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Insert sample data
    insert_sample_data(cursor)
    
    conn.commit()
    conn.close()

def insert_sample_data(cursor):
    """Insert sample restaurants and menu items"""
    
    # Sample restaurants with admin credentials
    restaurants_data = [
        (1, 'Taj Mahal Palace', 'North Indian', 4.9, 'https://images.pexels.com/photos/5409020/pexels-photo-5409020.jpeg',
         '123 Delhi Street, Indian Quarter', '+91 (555) 123-4567', 'Authentic North Indian cuisine with royal recipes from Mughal era',
         'TM001', hash_password('admin123')),
        (2, 'Spice Garden', 'South Indian', 4.8, 'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg',
         '456 Chennai Avenue, Spice District', '+91 (555) 234-5678', 'Traditional South Indian flavors featuring crispy dosas and fluffy idlis',
         'SG002', hash_password('admin123')),
        (3, 'Mumbai Masala', 'Street Food & Chaat', 4.7, 'https://images.pexels.com/photos/1893556/pexels-photo-1893556.jpeg',
         '789 Mumbai Road, Street Food Plaza', '+91 (555) 345-6789', 'Experience the vibrant street food culture of Mumbai',
         'MM003', hash_password('admin123'))
    ]
    
    cursor.executemany('''
        INSERT OR IGNORE INTO restaurants 
        (id, name, cuisine, rating, image, address, phone, description, admin_id, admin_password_hash) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', restaurants_data)
    
    # Sample tables for each restaurant
    tables_data = []
    for restaurant_id in [1, 2, 3]:
        table_count = 20 if restaurant_id == 1 else (15 if restaurant_id == 2 else 18)
        for i in range(1, table_count + 1):
            capacity = [2, 4, 6, 8][i % 4]
            status = 'available' if i <= table_count * 0.6 else ['reserved', 'occupied', 'cleaning'][i % 3]
            x = (i % 5) * 18 + 10
            y = (i // 5) * 20 + 10
            table_type = ['window', 'corner', 'center', 'private'][i % 4]
            features = 'WiFi,Power Outlet,Premium View,Quiet Zone'
            image = f'https://images.pexels.com/photos/67468/pexels-photo-67468.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop&crop=center'
            
            tables_data.append((restaurant_id, i, capacity, status, table_type, features, image, x, y))
    
    cursor.executemany('''
        INSERT OR IGNORE INTO tables 
        (restaurant_id, number, capacity, status, type, features, image, x, y) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', tables_data)
    
    # Sample menu items
    menu_items_data = [
        # Taj Mahal Palace
        (1, 'Tandoori Chicken', 'Tandoori', 599, 'Succulent chicken marinated in yogurt and spices',
         'https://images.pexels.com/photos/6210747/pexels-photo-6210747.jpeg', 'gluten-free', 1, 1),
        (1, 'Butter Chicken', 'Mains', 499, 'Tender chicken in rich creamy tomato gravy',
         'https://images.pexels.com/photos/2474661/pexels-photo-2474661.jpeg', 'gluten-free', 1, 1),
        (1, 'Paneer Tikka', 'Starters', 349, 'Grilled cottage cheese with aromatic spices',
         'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg', 'vegetarian,gluten-free', 0, 1),
        (1, 'Biryani', 'Rice', 449, 'Fragrant basmati rice with spiced chicken',
         'https://images.pexels.com/photos/16743486/pexels-photo-16743486.jpeg', 'gluten-free', 1, 1),
        (1, 'Gulab Jamun', 'Desserts', 129, 'Soft milk dumplings in rose syrup',
         'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg', 'vegetarian', 0, 1),

        # Spice Garden
        (2, 'Masala Dosa', 'Dosas', 199, 'Crispy rice crepe with spiced potato filling',
         'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg', 'vegetarian,healthy', 1, 1),
        (2, 'Idli Sambar', 'Breakfast', 149, 'Steamed rice cakes with lentil soup',
         'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg', 'vegetarian,healthy', 0, 1),
        (2, 'Uttapam', 'Dosas', 179, 'Thick rice pancake with vegetables',
         'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg', 'vegetarian', 0, 1),

        # Mumbai Masala
        (3, 'Pav Bhaji', 'Street Food', 169, 'Spicy mashed vegetables with buttered bread',
         'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg', 'vegetarian', 1, 1),
        (3, 'Vada Pav', 'Street Food', 79, 'Mumbai\'s iconic potato fritter sandwich',
         'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg', 'vegetarian', 0, 1),
        (3, 'Pani Puri', 'Chaat', 99, 'Crispy puris with spicy tamarind water',
         'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg', 'vegetarian', 0, 1)
    ]
    
    cursor.executemany('''
        INSERT OR IGNORE INTO menu_items 
        (restaurant_id, name, category, price, description, image, dietary, chef_special, available) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', menu_items_data)
    
    # Sample super admin user
    cursor.execute('''
        INSERT OR IGNORE INTO users (name, email, password_hash, role) 
        VALUES (?, ?, ?, ?)
    ''', ('Platform Owner', 'owner@restaurantai.com', hash_password('superadmin2025'), 'superadmin'))

def get_db_connection():
    """Get database connection"""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password: str) -> str:
    """Hash password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    return hash_password(password) == hashed

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=24)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

# Pydantic models
class UserSignup(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class AdminLogin(BaseModel):
    email: str
    password: str

class SuperAdminLogin(BaseModel):
    email: str
    password: str
    securityCode: str

class BookingCreate(BaseModel):
    restaurant_id: int
    table_id: int
    date: str
    time: str
    guests: int
    special_requests: Optional[str] = None

class OrderCreate(BaseModel):
    restaurant_id: int
    order_type: str
    items: List[dict]
    total_amount: float
    scheduled_time: Optional[str] = None
    special_instructions: Optional[str] = None

class MenuItemCreate(BaseModel):
    name: str
    category: str
    price: float
    description: str
    image: str
    dietary: Optional[str] = None
    chef_special: bool = False

class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    description: Optional[str] = None
    image: Optional[str] = None
    dietary: Optional[str] = None
    chef_special: Optional[bool] = None
    available: Optional[bool] = None

# API Routes

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    init_database()

@app.get("/")
async def root():
    return {"message": "Restaurant Management System API"}

# Authentication endpoints
@app.post("/api/auth/signup")
async def signup(user_data: UserSignup):
    """User signup endpoint"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Check if user already exists
        cursor.execute("SELECT id FROM users WHERE email = ?", (user_data.email,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Create new user
        hashed_password = hash_password(user_data.password)
        cursor.execute('''
            INSERT INTO users (name, email, phone, password_hash, role) 
            VALUES (?, ?, ?, ?, ?)
        ''', (user_data.name, user_data.email, user_data.phone, hashed_password, 'customer'))
        
        user_id = cursor.lastrowid
        conn.commit()
        
        # Create access token
        access_token = create_access_token(
            data={"sub": str(user_id), "email": user_data.email, "role": "customer"}
        )
        
        return {
            "message": "User created successfully",
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user_id,
                "name": user_data.name,
                "email": user_data.email,
                "phone": user_data.phone,
                "role": "customer"
            }
        }
    
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.post("/api/auth/login")
async def login(login_data: UserLogin):
    """User login endpoint"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            SELECT id, name, email, phone, password_hash, role 
            FROM users WHERE email = ? AND is_active = 1
        ''', (login_data.email,))
        
        user = cursor.fetchone()
        if not user or not verify_password(login_data.password, user['password_hash']):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Create access token
        access_token = create_access_token(
            data={"sub": str(user['id']), "email": user['email'], "role": user['role']}
        )
        
        return {
            "message": "Login successful",
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user['id'],
                "name": user['name'],
                "email": user['email'],
                "phone": user['phone'],
                "role": user['role']
            }
        }
    
    finally:
        conn.close()

@app.post("/api/auth/admin-login")
async def admin_login(login_data: AdminLogin):
    """Admin login endpoint"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            SELECT id, name, cuisine, admin_id, admin_password_hash 
            FROM restaurants WHERE admin_id = ? AND is_active = 1
        ''', (login_data.email,))
        
        restaurant = cursor.fetchone()
        if not restaurant or not verify_password(login_data.password, restaurant['admin_password_hash']):
            raise HTTPException(status_code=401, detail="Invalid admin credentials")
        
        # Create access token
        access_token = create_access_token(
            data={
                "sub": restaurant['admin_id'], 
                "restaurant_id": restaurant['id'],
                "role": "admin"
            }
        )
        
        return {
            "message": "Admin login successful",
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "name": f"Admin - {restaurant['name']}",
                "email": restaurant['admin_id'],
                "role": "admin",
                "restaurant_id": restaurant['id'],
                "restaurant_name": restaurant['name']
            }
        }
    
    finally:
        conn.close()

@app.post("/api/auth/super-admin-login")
async def super_admin_login(login_data: SuperAdminLogin):
    """Super admin login endpoint"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            SELECT id, name, email, password_hash, role 
            FROM users WHERE email = ? AND role = 'superadmin' AND is_active = 1
        ''', (login_data.email,))
        
        user = cursor.fetchone()
        if (not user or 
            not verify_password(login_data.password, user['password_hash']) or 
            login_data.securityCode != '777888'):
            raise HTTPException(status_code=401, detail="Invalid super admin credentials or security code")
        
        # Create access token
        access_token = create_access_token(
            data={"sub": str(user['id']), "email": user['email'], "role": "superadmin"}
        )
        
        return {
            "message": "Super admin login successful",
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user['id'],
                "name": user['name'],
                "email": user['email'],
                "role": user['role']
            }
        }
    
    finally:
        conn.close()

# Restaurant endpoints
@app.get("/api/restaurants")
async def get_restaurants():
    """Get all active restaurants"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            SELECT id, name, cuisine, rating, image, address, phone, description 
            FROM restaurants WHERE is_active = 1
        ''')
        restaurants = cursor.fetchall()
        
        # Get table counts for each restaurant
        restaurant_list = []
        for restaurant in restaurants:
            cursor.execute('''
                SELECT COUNT(*) as total_tables,
                       SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available_tables
                FROM tables WHERE restaurant_id = ?
            ''', (restaurant['id'],))
            table_info = cursor.fetchone()
            
            restaurant_dict = dict(restaurant)
            restaurant_dict['tables'] = []
            restaurant_dict['total_tables'] = table_info['total_tables'] or 0
            restaurant_dict['available_tables'] = table_info['available_tables'] or 0
            restaurant_list.append(restaurant_dict)
        
        return restaurant_list
    
    finally:
        conn.close()

@app.get("/api/restaurants/{restaurant_id}")
async def get_restaurant(restaurant_id: int):
    """Get specific restaurant details"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            SELECT id, name, cuisine, rating, image, address, phone, description 
            FROM restaurants WHERE id = ? AND is_active = 1
        ''', (restaurant_id,))
        restaurant = cursor.fetchone()
        
        if not restaurant:
            raise HTTPException(status_code=404, detail="Restaurant not found")
        
        # Get tables for this restaurant
        cursor.execute('''
            SELECT id, number, capacity, status, type, features, image, x, y
            FROM tables WHERE restaurant_id = ?
        ''', (restaurant_id,))
        tables = cursor.fetchall()
        
        restaurant_dict = dict(restaurant)
        restaurant_dict['tables'] = [dict(table) for table in tables]
        
        return restaurant_dict
    
    finally:
        conn.close()

@app.get("/api/restaurants/{restaurant_id}/menu")
async def get_restaurant_menu(restaurant_id: int):
    """Get menu items for a restaurant"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            SELECT id, name, category, price, description, image, dietary, chef_special, available
            FROM menu_items WHERE restaurant_id = ? AND available = 1
            ORDER BY category, name
        ''', (restaurant_id,))
        menu_items = cursor.fetchall()
        
        return [dict(item) for item in menu_items]
    
    finally:
        conn.close()

# Booking endpoints
@app.post("/api/bookings")
async def create_booking(booking_data: BookingCreate, token_data: dict = Depends(verify_token)):
    """Create a new booking"""
    if token_data.get('role') != 'customer':
        raise HTTPException(status_code=403, detail="Only customers can make bookings")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        user_id = int(token_data['sub'])
        
        # Check if table is available
        cursor.execute('''
            SELECT status FROM tables 
            WHERE id = ? AND restaurant_id = ?
        ''', (booking_data.table_id, booking_data.restaurant_id))
        
        table = cursor.fetchone()
        if not table or table['status'] != 'available':
            raise HTTPException(status_code=400, detail="Table is not available")
        
        # Create booking
        cursor.execute('''
            INSERT INTO bookings (user_id, restaurant_id, table_id, date, time, guests, special_requests)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, booking_data.restaurant_id, booking_data.table_id, 
              booking_data.date, booking_data.time, booking_data.guests, 
              booking_data.special_requests))
        
        booking_id = cursor.lastrowid
        
        # Update table status
        cursor.execute('''
            UPDATE tables SET status = 'reserved' WHERE id = ?
        ''', (booking_data.table_id,))
        
        conn.commit()
        
        return {
            "message": "Booking created successfully",
            "booking_id": booking_id,
            "status": "confirmed"
        }
    
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# Order endpoints
@app.post("/api/orders")
async def create_order(order_data: OrderCreate, token_data: dict = Depends(verify_token)):
    """Create a new order"""
    if token_data.get('role') != 'customer':
        raise HTTPException(status_code=403, detail="Only customers can place orders")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        user_id = int(token_data['sub'])
        
        # Create order
        cursor.execute('''
            INSERT INTO orders (user_id, restaurant_id, order_type, total_amount, scheduled_time, special_instructions)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, order_data.restaurant_id, order_data.order_type, 
              order_data.total_amount, order_data.scheduled_time, order_data.special_instructions))
        
        order_id = cursor.lastrowid
        
        # Add order items
        for item in order_data.items:
            cursor.execute('''
                INSERT INTO order_items (order_id, menu_item_id, quantity, price)
                VALUES (?, ?, ?, ?)
            ''', (order_id, item['id'], item['quantity'], item['price']))
        
        conn.commit()
        
        return {
            "message": "Order created successfully",
            "order_id": order_id,
            "status": "pending"
        }
    
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# Admin endpoints
@app.get("/api/admin/restaurant")
async def get_admin_restaurant(token_data: dict = Depends(verify_token)):
    """Get restaurant data for logged-in admin"""
    if token_data.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    restaurant_id = token_data.get('restaurant_id')
    if not restaurant_id:
        raise HTTPException(status_code=400, detail="Invalid admin token")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            SELECT id, name, cuisine, rating, image, address, phone, description 
            FROM restaurants WHERE id = ?
        ''', (restaurant_id,))
        restaurant = cursor.fetchone()
        
        if not restaurant:
            raise HTTPException(status_code=404, detail="Restaurant not found")
        
        return dict(restaurant)
    
    finally:
        conn.close()

@app.get("/api/admin/menu")
async def get_admin_menu(token_data: dict = Depends(verify_token)):
    """Get menu items for admin's restaurant"""
    if token_data.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    restaurant_id = token_data.get('restaurant_id')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            SELECT id, name, category, price, description, image, dietary, chef_special, available
            FROM menu_items WHERE restaurant_id = ?
            ORDER BY category, name
        ''', (restaurant_id,))
        menu_items = cursor.fetchall()
        
        return [dict(item) for item in menu_items]
    
    finally:
        conn.close()

@app.post("/api/admin/menu")
async def create_menu_item(item_data: MenuItemCreate, token_data: dict = Depends(verify_token)):
    """Create new menu item"""
    if token_data.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    restaurant_id = token_data.get('restaurant_id')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            INSERT INTO menu_items (restaurant_id, name, category, price, description, image, dietary, chef_special)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (restaurant_id, item_data.name, item_data.category, item_data.price, 
              item_data.description, item_data.image, item_data.dietary, item_data.chef_special))
        
        item_id = cursor.lastrowid
        conn.commit()
        
        return {
            "message": "Menu item created successfully",
            "item_id": item_id
        }
    
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.put("/api/admin/menu/{item_id}")
async def update_menu_item(item_id: int, item_data: MenuItemUpdate, token_data: dict = Depends(verify_token)):
    """Update menu item"""
    if token_data.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    restaurant_id = token_data.get('restaurant_id')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Check if item belongs to admin's restaurant
        cursor.execute('''
            SELECT id FROM menu_items WHERE id = ? AND restaurant_id = ?
        ''', (item_id, restaurant_id))
        
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Menu item not found")
        
        # Build update query dynamically
        update_fields = []
        update_values = []
        
        for field, value in item_data.dict(exclude_unset=True).items():
            update_fields.append(f"{field} = ?")
            update_values.append(value)
        
        if update_fields:
            update_values.append(item_id)
            cursor.execute(f'''
                UPDATE menu_items SET {", ".join(update_fields)} WHERE id = ?
            ''', update_values)
            
            conn.commit()
        
        return {"message": "Menu item updated successfully"}
    
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.delete("/api/admin/menu/{item_id}")
async def delete_menu_item(item_id: int, token_data: dict = Depends(verify_token)):
    """Delete menu item"""
    if token_data.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    restaurant_id = token_data.get('restaurant_id')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            DELETE FROM menu_items WHERE id = ? AND restaurant_id = ?
        ''', (item_id, restaurant_id))
        
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Menu item not found")
        
        conn.commit()
        return {"message": "Menu item deleted successfully"}
    
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/api/admin/orders")
async def get_admin_orders(token_data: dict = Depends(verify_token)):
    """Get orders for admin's restaurant"""
    if token_data.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    restaurant_id = token_data.get('restaurant_id')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            SELECT o.id, o.order_type, o.status, o.total_amount, o.scheduled_time, 
                   o.special_instructions, o.created_at, u.name as customer_name, u.email as customer_email
            FROM orders o
            JOIN users u ON o.user_id = u.id
            WHERE o.restaurant_id = ?
            ORDER BY o.created_at DESC
        ''', (restaurant_id,))
        orders = cursor.fetchall()
        
        # Get order items for each order
        order_list = []
        for order in orders:
            cursor.execute('''
                SELECT oi.quantity, oi.price, mi.name as item_name
                FROM order_items oi
                JOIN menu_items mi ON oi.menu_item_id = mi.id
                WHERE oi.order_id = ?
            ''', (order['id'],))
            items = cursor.fetchall()
            
            order_dict = dict(order)
            order_dict['items'] = [dict(item) for item in items]
            order_list.append(order_dict)
        
        return order_list
    
    finally:
        conn.close()

@app.put("/api/admin/orders/{order_id}/status")
async def update_order_status(order_id: int, status_data: dict, token_data: dict = Depends(verify_token)):
    """Update order status"""
    if token_data.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    restaurant_id = token_data.get('restaurant_id')
    new_status = status_data.get('status')
    
    if new_status not in ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled']:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            UPDATE orders SET status = ? 
            WHERE id = ? AND restaurant_id = ?
        ''', (new_status, order_id, restaurant_id))
        
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Order not found")
        
        conn.commit()
        return {"message": "Order status updated successfully"}
    
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/api/admin/bookings")
async def get_admin_bookings(token_data: dict = Depends(verify_token)):
    """Get bookings for admin's restaurant"""
    if token_data.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    restaurant_id = token_data.get('restaurant_id')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            SELECT b.id, b.date, b.time, b.guests, b.special_requests, b.status, b.created_at,
                   u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
                   t.number as table_number, t.capacity as table_capacity
            FROM bookings b
            JOIN users u ON b.user_id = u.id
            JOIN tables t ON b.table_id = t.id
            WHERE b.restaurant_id = ?
            ORDER BY b.date DESC, b.time DESC
        ''', (restaurant_id,))
        bookings = cursor.fetchall()
        
        return [dict(booking) for booking in bookings]
    
    finally:
        conn.close()

# Super Admin endpoints
@app.get("/api/super-admin/restaurants")
async def get_all_restaurants_super_admin(token_data: dict = Depends(verify_token)):
    """Get all restaurants for super admin"""
    if token_data.get('role') != 'superadmin':
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            SELECT id, name, cuisine, rating, image, address, phone, description, admin_id, is_active, created_at
            FROM restaurants
            ORDER BY created_at DESC
        ''')
        restaurants = cursor.fetchall()
        
        return [dict(restaurant) for restaurant in restaurants]
    
    finally:
        conn.close()

@app.get("/api/super-admin/users")
async def get_all_users_super_admin(token_data: dict = Depends(verify_token)):
    """Get all users for super admin"""
    if token_data.get('role') != 'superadmin':
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            SELECT id, name, email, phone, role, is_active, created_at
            FROM users
            ORDER BY created_at DESC
        ''')
        users = cursor.fetchall()
        
        return [dict(user) for user in users]
    
    finally:
        conn.close()

@app.get("/api/super-admin/analytics")
async def get_analytics_super_admin(token_data: dict = Depends(verify_token)):
    """Get platform analytics for super admin"""
    if token_data.get('role') != 'superadmin':
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Get total counts
        cursor.execute("SELECT COUNT(*) as total_restaurants FROM restaurants WHERE is_active = 1")
        total_restaurants = cursor.fetchone()['total_restaurants']
        
        cursor.execute("SELECT COUNT(*) as total_users FROM users WHERE role = 'customer' AND is_active = 1")
        total_users = cursor.fetchone()['total_users']
        
        cursor.execute("SELECT COUNT(*) as total_orders FROM orders")
        total_orders = cursor.fetchone()['total_orders']
        
        cursor.execute("SELECT COUNT(*) as total_bookings FROM bookings")
        total_bookings = cursor.fetchone()['total_bookings']
        
        cursor.execute("SELECT SUM(total_amount) as total_revenue FROM orders WHERE status = 'completed'")
        total_revenue = cursor.fetchone()['total_revenue'] or 0
        
        return {
            "total_restaurants": total_restaurants,
            "total_users": total_users,
            "total_orders": total_orders,
            "total_bookings": total_bookings,
            "total_revenue": total_revenue
        }
    
    finally:
        conn.close()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)