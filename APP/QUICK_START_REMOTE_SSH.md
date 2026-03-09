# ⚡ Quick Start: Remote-SSH trong 5 Phút

## 🚀 Các Bước Nhanh

### 1. Cài Extension (1 phút)
```
VS Code → Extensions (Ctrl+Shift+X) → Tìm "Remote-SSH" → Install
```

### 2. Cấu Hình SSH (1 phút)
```
F1 → "Remote-SSH: Open SSH Configuration File" → Thêm:

Host fastfood-vps
    HostName 103.75.182.180
    User your-username
    Port 22
```

### 3. Kết Nối (2 phút)
```
F1 → "Remote-SSH: Connect to Host" → Chọn "fastfood-vps"
→ Nhập password → Đợi VS Code Server cài đặt
```

### 4. Mở Backend Folder (30 giây)
```
F1 → "Open Folder" → Nhập: /path/to/backend
(Hoặc tìm: find / -name "migrate.js")
```

### 5. Chạy Migration (30 giây)
```
Terminal → Chạy:
cd /path/to/backend
node migrate.js
pm2 restart fastfood-backend
```

---

## ✅ Xong! 

Database đã được migration. Test:
```bash
curl http://localhost:8000/api/v1/restaurants
```

---

**Cần chi tiết?** Xem file `HUONG_DAN_REMOTE_SSH.md`

