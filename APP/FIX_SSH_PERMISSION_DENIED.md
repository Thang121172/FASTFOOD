# 🔐 Fix Lỗi SSH: Permission Denied

## ❌ Vấn đề
```
Permission denied (publickey,password,keyboard-interactive)
```

---

## 🔍 Giải Pháp 1: Kiểm Tra Password

### Bước 1: Xác nhận password đúng
- Kiểm tra email từ nhà cung cấp VPS (Vultr, DigitalOcean, AWS, v.v.)
- Hoặc vào **Control Panel** của VPS provider để xem/reset password

### Bước 2: Reset password trong Control Panel
1. Đăng nhập vào control panel của VPS provider
2. Tìm VPS `103.75.182.180`
3. Vào **Settings** → **Reset Password** hoặc **Change Root Password**
4. Đặt password mới
5. **Lưu ý:** Một số VPS cần restart sau khi reset password

---

## 🔑 Giải Pháp 2: Dùng SSH Key (Khuyến nghị)

### Bước 1: Tạo SSH Key trên máy local
```powershell
# Trong PowerShell
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# Nhấn Enter để dùng đường dẫn mặc định
# Nhập passphrase (hoặc Enter để bỏ qua)
```

### Bước 2: Copy public key lên VPS
**Cách A: Dùng control panel của VPS provider**
1. Vào control panel
2. Tìm phần **SSH Keys** hoặc **Access**
3. Thêm SSH public key (nội dung file `C:\Users\<YourUsername>\.ssh\id_rsa.pub`)

**Cách B: Dùng password một lần (nếu có quyền truy cập khác)**
- Nếu bạn có quyền truy cập qua web console hoặc control panel terminal

### Bước 3: Cấu hình VS Code để dùng SSH key
1. Mở SSH config: `F1` → `Remote-SSH: Open SSH Configuration File`
2. Sửa config:
```
Host fastfood-vps
    HostName 103.75.182.180
    User root
    Port 22
    IdentityFile C:\Users\<YourUsername>\.ssh\id_rsa
    IdentitiesOnly yes
```
3. Lưu và kết nối lại

---

## 🖥️ Giải Pháp 3: Dùng Web Console (Nếu có)

Nhiều VPS provider có **Web Console** hoặc **VNC Console**:

1. Vào control panel của VPS provider
2. Tìm VPS `103.75.182.180`
3. Click **Console** hoặc **Web Terminal**
4. Đăng nhập trực tiếp qua web console
5. Chạy script fix từ đó

---

## 🚀 Giải Pháp 4: Fix Database Từ Máy Local (Nếu Database Cho Phép Remote)

Nếu PostgreSQL trên VPS cho phép kết nối từ xa, bạn có thể fix từ máy local:

### Bước 1: Kiểm tra PostgreSQL có cho phép remote không
Thường thì PostgreSQL mặc định **KHÔNG** cho phép remote connection vì lý do bảo mật.

### Bước 2: Nếu cần, cấu hình PostgreSQL trên VPS (qua web console)
1. SSH vào VPS qua web console
2. Sửa file `postgresql.conf`:
   ```bash
   sudo nano /etc/postgresql/*/main/postgresql.conf
   # Tìm và sửa:
   listen_addresses = '*'
   ```
3. Sửa file `pg_hba.conf`:
   ```bash
   sudo nano /etc/postgresql/*/main/pg_hba.conf
   # Thêm dòng:
   host    all    all    0.0.0.0/0    md5
   ```
4. Restart PostgreSQL:
   ```bash
   sudo systemctl restart postgresql
   ```
5. Mở firewall port 5432:
   ```bash
   sudo ufw allow 5432/tcp
   ```

### Bước 3: Chạy script từ máy local
```powershell
# Trong PowerShell (máy local)
.\fix_constraint_from_local.ps1
```

---

## 🎯 Giải Pháp 5: Nhờ Người Có Quyền Truy Cập

Nếu bạn không thể truy cập VPS:
1. Liên hệ người quản trị VPS
2. Gửi file `backend/fix_username_constraint.js`
3. Nhờ họ chạy script trên VPS

---

## 📋 Checklist Khắc Phục

- [ ] Đã kiểm tra password trong email/control panel
- [ ] Đã thử reset password trong control panel
- [ ] Đã thử dùng web console/VNC console
- [ ] Đã tạo SSH key và thêm vào VPS
- [ ] Đã kiểm tra firewall/security groups
- [ ] Đã liên hệ nhà cung cấp VPS nếu cần

---

## 🔧 Kiểm Tra Thông Tin VPS

### Xác định nhà cung cấp VPS:
- **Vultr:** https://my.vultr.com
- **DigitalOcean:** https://cloud.digitalocean.com
- **AWS:** https://console.aws.amazon.com
- **Linode:** https://cloud.linode.com
- **Hetzner:** https://console.hetzner.cloud

### Thông tin cần có:
- ✅ Email đăng ký VPS
- ✅ Password tài khoản control panel
- ✅ IP VPS: `103.75.182.180`

---

## 💡 Mẹo

1. **Kiểm tra email:** Thông tin đăng nhập VPS thường được gửi qua email khi tạo VPS
2. **Dùng web console:** Nếu SSH không được, web console là cách tốt nhất
3. **SSH key an toàn hơn:** Sau khi fix xong, nên setup SSH key để không cần password

---

## ⚠️ Lưu Ý Bảo Mật

- **KHÔNG** chia sẻ password VPS
- **KHÔNG** commit SSH key vào git
- **NÊN** dùng SSH key thay vì password
- **NÊN** đổi password định kỳ

