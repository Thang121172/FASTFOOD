# 📱 Hướng Dẫn Sử Dụng APK - Câu Hỏi Thường Gặp

## ❓ Người dùng tải APK có xài được không?

### ✅ **CÓ - Nhưng cần đảm bảo các điều kiện sau:**

---

## 🔌 1. Backend Phải Đang Chạy

### Backend đang kết nối đến đâu?
App hiện tại được cấu hình kết nối đến:
```
http://103.75.182.180:8000/
```

Đây là **IP VPS công cộng**, không phải localhost.

### ✅ Người dùng CÓ THỂ dùng được nếu:
- ✅ Backend đang chạy trên VPS `103.75.182.180`
- ✅ Port `8000` đang mở và có thể truy cập từ internet
- ✅ VPS đang online và có kết nối internet

### ❌ Người dùng KHÔNG thể dùng nếu:
- ❌ Backend không chạy (server đã tắt)
- ❌ VPS bị lỗi hoặc mất kết nối
- ❌ Port 8000 bị firewall chặn
- ❌ Backend đang chạy trên máy local của bạn (không phải VPS)

---

## 🌐 2. Có Cần Cùng Mạng Không?

### ✅ **KHÔNG CẦN cùng mạng!**

Vì app đang kết nối đến IP công cộng (`103.75.182.180`), nên:
- ✅ Người dùng có thể dùng app từ **bất kỳ đâu** (có internet)
- ✅ Không cần cùng WiFi
- ✅ Không cần cùng mạng LAN
- ✅ Chỉ cần có **kết nối internet** là được

**Ví dụ:**
- Bạn ở Hà Nội → Backend ở VPS → Người dùng ở TP.HCM → ✅ **Vẫn dùng được!**

---

## ⚙️ 3. Kiểm Tra Backend Có Đang Chạy

### Cách kiểm tra nhanh:
1. Mở trình duyệt
2. Truy cập: `http://103.75.182.180:8000/api/v1/restaurants`
3. Nếu thấy dữ liệu JSON → ✅ Backend đang chạy
4. Nếu lỗi "Không thể kết nối" → ❌ Backend không chạy hoặc port bị chặn

### Kiểm tra bằng PowerShell/CMD:
```powershell
# Test kết nối đến backend
Invoke-WebRequest -Uri "http://103.75.182.180:8000/api/v1/restaurants" -UseBasicParsing
```

Nếu thành công (Status 200) → Backend OK
Nếu lỗi → Backend cần được khởi động

---

## 🚀 4. Cách Đảm Bảo Backend Luôn Chạy

### Trên VPS Linux:

#### **Option 1: Dùng PM2 (Khuyến nghị)**
```bash
# Cài đặt PM2
npm install -g pm2

# Chạy backend với PM2
cd /path/to/backend
pm2 start index.js --name fastfood-backend

# Tự động khởi động lại khi VPS reboot
pm2 startup
pm2 save

# Kiểm tra trạng thái
pm2 status
pm2 logs fastfood-backend
```

#### **Option 2: Dùng systemd service**
```bash
# Tạo service file
sudo nano /etc/systemd/system/fastfood-backend.service
```

Nội dung file:
```ini
[Unit]
Description=FastFood Backend API
After=network.target

[Service]
Type=simple
User=your-user
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

#### **Option 3: Dùng Docker (Nếu backend đã có Dockerfile)**
```bash
cd /path/to/backend
docker-compose up -d
```

---

## 🔥 5. Kiểm Tra Firewall

### Trên VPS, đảm bảo port 8000 đã mở:

#### Ubuntu/Debian (UFW):
```bash
sudo ufw allow 8000/tcp
sudo ufw status
```

#### CentOS/RHEL (firewalld):
```bash
sudo firewall-cmd --permanent --add-port=8000/tcp
sudo firewall-cmd --reload
```

#### Hoặc kiểm tra trên Cloud Provider:
- Nếu dùng AWS: Kiểm tra Security Groups
- Nếu dùng Google Cloud: Kiểm tra Firewall Rules
- Nếu dùng DigitalOcean: Kiểm tra Cloud Firewalls

---

## 📋 6. Checklist Trước Khi Chia Sẻ APK

Trước khi chia sẻ APK cho người khác, đảm bảo:

- [ ] Backend đang chạy trên VPS `103.75.182.180:8000`
- [ ] Kiểm tra backend bằng trình duyệt: `http://103.75.182.180:8000/api/v1/restaurants`
- [ ] Port 8000 đã mở trên firewall
- [ ] Database đang kết nối và có dữ liệu
- [ ] Test thử app trên máy khác (không cùng mạng) để chắc chắn

---

## 🔄 7. Nếu Backend Chạy Ở Máy Local (Không Phải VPS)

Nếu backend đang chạy trên máy tính của bạn (localhost):
- ❌ Người khác **KHÔNG THỂ** dùng app được
- ❌ Chỉ bạn (cùng mạng) mới dùng được

### Giải pháp:
1. **Upload backend lên VPS** (khuyến nghị)
2. Hoặc dùng **ngrok** để tạo tunnel tạm thời:
   ```bash
   ngrok http 8000
   ```
   Sau đó cập nhật BASE_URL trong app thành URL ngrok (cần rebuild APK)

---

## 🆘 8. Khắc Phục Sự Cố

### Lỗi: "Không thể kết nối đến server"

**Nguyên nhân có thể:**
1. Backend không chạy → Khởi động lại backend
2. Port bị chặn → Mở port 8000 trên firewall
3. VPS bị sập → Kiểm tra VPS có đang online không
4. IP đã thay đổi → Cập nhật BASE_URL trong code và rebuild APK

### Lỗi: "Network error" trên Android

**Nguyên nhân:**
- Android 9+ có thể chặn HTTP (chỉ cho HTTPS)
- ✅ App đã được cấu hình cho phép HTTP trong `network_security_config.xml`
- Nhưng nếu vẫn lỗi, kiểm tra lại cấu hình

---

## 📞 9. Liên Hệ Và Hỗ Trợ

Nếu có vấn đề:
1. Kiểm tra backend đang chạy chưa
2. Kiểm tra log backend: `pm2 logs` hoặc `docker logs`
3. Kiểm tra firewall và port 8000
4. Test kết nối từ trình duyệt trước

---

## ✅ Tóm Tắt

| Câu hỏi | Trả lời |
|---------|---------|
| Người dùng tải APK có dùng được không? | ✅ **CÓ** - Nếu backend đang chạy trên VPS |
| Có cần cùng mạng không? | ❌ **KHÔNG** - Chỉ cần internet |
| Có cần chạy backend không? | ✅ **CÓ** - Backend phải đang chạy trên VPS |
| Backend chạy ở đâu? | 🖥️ VPS: `103.75.182.180:8000` |
| Người khác ở xa có dùng được không? | ✅ **CÓ** - Từ bất kỳ đâu có internet |

---

**Ngày cập nhật:** 26/11/2025

