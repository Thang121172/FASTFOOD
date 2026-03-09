# ❌ BACKEND KHÔNG KẾT NỐI ĐƯỢC - CÁCH XỬ LÝ

## 🔍 Vấn Đề Hiện Tại

Backend đang **TIMEOUT** - Không thể kết nối đến `http://103.75.182.180:8000`

## ✅ Các Bước Kiểm Tra Và Xử Lý

### 1. Kiểm Tra Backend Có Đang Chạy Trên VPS Không?

**SSH vào VPS và kiểm tra:**

```bash
# Kiểm tra process Node.js
ps aux | grep node

# Hoặc nếu dùng PM2
pm2 status
pm2 logs

# Hoặc nếu dùng Docker
docker ps
docker logs <container-name>
```

**Nếu backend KHÔNG chạy:**
```bash
# Vào thư mục backend
cd /path/to/backend

# Chạy backend (tạm thời)
node index.js

# HOẶC chạy với PM2 (khuyến nghị)
pm2 start index.js --name fastfood-backend
pm2 save
pm2 startup
```

---

### 2. Kiểm Tra Port 8000 Có Đang Mở Không?

**Trên VPS:**

```bash
# Kiểm tra port đang listen
netstat -tuln | grep 8000
# HOẶC
ss -tuln | grep 8000

# Kiểm tra firewall
sudo ufw status
# Nếu port 8000 chưa mở:
sudo ufw allow 8000/tcp
sudo ufw reload
```

**Kiểm tra từ máy của bạn:**
```powershell
# PowerShell
Test-NetConnection -ComputerName 103.75.182.180 -Port 8000
```

---

### 3. Kiểm Tra Firewall Trên Cloud Provider

**AWS:**
- Vào EC2 → Security Groups
- Tìm security group của VPS
- Thêm rule: Port 8000, TCP, Source: 0.0.0.0/0

**Google Cloud:**
- Vào VPC Network → Firewall Rules
- Tạo rule: Allow TCP:8000 from 0.0.0.0/0

**DigitalOcean:**
- Vào Networking → Firewalls
- Thêm rule: Inbound TCP:8000

---

### 4. Kiểm Tra VPS Có Đang Online Không?

**Ping VPS:**
```powershell
# Windows
ping 103.75.182.180

# Hoặc
Test-Connection -ComputerName 103.75.182.180
```

**Nếu không ping được:**
- VPS có thể đã tắt
- IP có thể đã thay đổi
- Network có vấn đề

---

### 5. Kiểm Tra Database Connection

Backend cần kết nối được đến PostgreSQL:

```bash
# SSH vào VPS, kiểm tra database
psql -h localhost -U app -d fastfood -c "SELECT 1;"

# Nếu lỗi, kiểm tra .env file
cat .env | grep DB_
```

---

## 🚀 Cách Khởi Động Backend Trên VPS

### Option 1: Dùng PM2 (Khuyến nghị - Tự động restart)

```bash
# Cài PM2
npm install -g pm2

# Vào thư mục backend
cd /path/to/backend

# Chạy với PM2
pm2 start index.js --name fastfood-backend

# Lưu cấu hình
pm2 save

# Tự động khởi động khi VPS reboot
pm2 startup
# (Chạy lệnh mà PM2 output ra)

# Xem logs
pm2 logs fastfood-backend

# Kiểm tra status
pm2 status
```

### Option 2: Dùng systemd Service

```bash
# Tạo service file
sudo nano /etc/systemd/system/fastfood-backend.service
```

Nội dung:
```ini
[Unit]
Description=FastFood Backend API
After=network.target postgresql.service

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/backend
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=8000

[Install]
WantedBy=multi-user.target
```

Sau đó:
```bash
sudo systemctl daemon-reload
sudo systemctl enable fastfood-backend
sudo systemctl start fastfood-backend
sudo systemctl status fastfood-backend
```

### Option 3: Dùng Docker

```bash
cd /path/to/backend
docker-compose up -d

# Hoặc
docker run -d -p 8000:8000 --name fastfood-backend your-image
```

---

## 🔧 Kiểm Tra Nhanh Từ Máy Của Bạn

**Test từ trình duyệt:**
```
http://103.75.182.180:8000/api/v1/restaurants
```

**Test từ PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://103.75.182.180:8000/api/v1/restaurants" -UseBasicParsing
```

**Nếu thành công:** Backend đang chạy ✅
**Nếu timeout:** Backend không chạy hoặc port bị chặn ❌

---

## 📋 Checklist Trước Khi Chia Sẻ APK

- [ ] Backend đang chạy trên VPS (pm2 status hoặc systemctl status)
- [ ] Port 8000 đã mở (netstat hoặc ss)
- [ ] Firewall đã cho phép port 8000
- [ ] Test kết nối từ trình duyệt thành công
- [ ] Database đang kết nối được
- [ ] Test từ máy khác (không cùng mạng) cũng kết nối được

---

## 🆘 Nếu Vẫn Không Được

1. **Kiểm tra log backend:**
   ```bash
   pm2 logs
   # hoặc
   journalctl -u fastfood-backend -f
   # hoặc
   docker logs fastfood-backend
   ```

2. **Kiểm tra IP có đúng không:**
   - Có thể IP VPS đã thay đổi
   - Cập nhật BASE_URL trong `app/build.gradle.kts` và rebuild APK

3. **Kiểm tra .env file:**
   ```bash
   cat .env
   # Đảm bảo DB_HOST, DB_PORT, DB_NAME đúng
   ```

---

## ⚠️ QUAN TRỌNG

**Nếu backend không chạy:**
- ❌ Người dùng KHÔNG THỂ dùng APK được
- ❌ App sẽ báo lỗi "Không thể kết nối đến server"
- ✅ Phải khởi động backend trên VPS trước khi chia sẻ APK

**Sau khi khởi động backend:**
- Test lại bằng script hoặc trình duyệt
- Đợi 1-2 phút để backend khởi động hoàn toàn
- Sau đó mới chia sẻ APK cho người khác

---

**Ngày cập nhật:** 26/11/2025

