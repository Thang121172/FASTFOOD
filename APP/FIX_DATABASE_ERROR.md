# ❌ LỖI: relation "users" does not exist - CÁCH XỬ LÝ

## 🔍 Vấn Đề

Lỗi `relation "users" does not exist` có nghĩa là:
- ❌ Database chưa được khởi tạo (chưa có bảng)
- ❌ Chưa chạy migration để tạo các bảng cần thiết

## ✅ Giải Pháp: Chạy Migration

### Cách 1: Chạy Migration Script (Khuyến nghị)

**Trên Windows (PowerShell):**
```powershell
cd backend
.\run_migration.ps1
```

**Trên Linux/Mac:**
```bash
cd backend
npm run migrate
# hoặc
node migrate.js
```

### Cách 2: Chạy Migration Thủ Công

**Bước 1: Kiểm tra file .env**
Đảm bảo file `backend/.env` có đúng thông tin database:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fastfood
DB_USER=app
DB_PASSWORD=123456
```

**Bước 2: Đảm bảo PostgreSQL đang chạy**
```bash
# Windows (Services)
# Kiểm tra service "postgresql-x64-XX" đang chạy

# Linux
sudo systemctl status postgresql
# Nếu không chạy:
sudo systemctl start postgresql
```

**Bước 3: Tạo database (nếu chưa có)**
```bash
# Kết nối PostgreSQL
psql -U postgres

# Tạo database
CREATE DATABASE fastfood;

# Tạo user (nếu chưa có)
CREATE USER app WITH PASSWORD '123456';
GRANT ALL PRIVILEGES ON DATABASE fastfood TO app;

# Thoát
\q
```

**Bước 4: Chạy migration**
```bash
cd backend
node migrate.js
```

---

## 📋 Kiểm Tra Migration Đã Thành Công

Sau khi chạy migration, kiểm tra các bảng đã được tạo:

**Cách 1: Dùng script kiểm tra**
```bash
cd backend
node check_users.js
```

**Cách 2: Kiểm tra trực tiếp trong PostgreSQL**
```sql
-- Kết nối database
psql -U app -d fastfood

-- Kiểm tra bảng users
SELECT * FROM information_schema.tables WHERE table_name = 'users';

-- Kiểm tra các bảng đã tạo
\dt

-- Thoát
\q
```

---

## 🌱 Tạo Dữ Liệu Mẫu (Seed Data) - Tùy chọn

Sau khi migration thành công, có thể tạo dữ liệu mẫu:

```bash
cd backend
node seed_data.js
```

Script này sẽ tạo:
- ✅ Admin user (username: `admin`, password: `admin123`)
- ✅ Customer users
- ✅ Merchant users
- ✅ Shipper users
- ✅ Sample restaurants và products

---

## 🔄 Nếu Vẫn Gặp Lỗi

### Lỗi: "database does not exist"

**Giải pháp:** Tạo database trước
```sql
CREATE DATABASE fastfood;
```

### Lỗi: "password authentication failed"

**Giải pháp:** Kiểm tra lại thông tin trong `.env`:
- `DB_USER` và `DB_PASSWORD` phải đúng
- Hoặc tạo user mới:
  ```sql
  CREATE USER app WITH PASSWORD '123456';
  GRANT ALL PRIVILEGES ON DATABASE fastfood TO app;
  ```

### Lỗi: "connection refused"

**Giải pháp:**
- Kiểm tra PostgreSQL có đang chạy không
- Kiểm tra `DB_HOST` và `DB_PORT` trong `.env`
- Kiểm tra firewall

### Lỗi: "permission denied"

**Giải pháp:**
```sql
-- Cấp quyền cho user
GRANT ALL PRIVILEGES ON DATABASE fastfood TO app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app;
```

---

## ✅ Checklist Sau Khi Migration

Sau khi migration thành công, đảm bảo:

- [ ] Bảng `users` đã được tạo
- [ ] Bảng `restaurants` đã được tạo (nếu có)
- [ ] Bảng `products` đã được tạo (nếu có)
- [ ] Bảng `orders` đã được tạo (nếu có)
- [ ] Có thể query: `SELECT * FROM users LIMIT 1;`
- [ ] Backend có thể khởi động không báo lỗi

---

## 🚀 Bước Tiếp Theo

1. ✅ **Migration thành công**
2. 🔄 **Seed data (tùy chọn):** `node seed_data.js`
3. 🚀 **Khởi động backend:** `npm start` hoặc `node index.js`
4. ✅ **Test API:** `http://localhost:8000/api/v1/restaurants`

---

## 📝 Lưu Ý Quan Trọng

⚠️ **Migration chỉ cần chạy 1 lần** khi setup database lần đầu
⚠️ **Không chạy migration lại** nếu database đã có dữ liệu (trừ khi muốn reset)
⚠️ **Backup database** trước khi migration nếu đã có dữ liệu quan trọng

---

**Ngày cập nhật:** 26/11/2025

