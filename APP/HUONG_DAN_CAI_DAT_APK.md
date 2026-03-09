# 📱 Hướng Dẫn Cài Đặt APK FastFood App

## Thông tin APK
- **Tên file**: `FastFood-App-v1.0.apk`
- **Phiên bản**: 1.0
- **Package**: com.example.app
- **Minimum Android**: 8.0 (API 26)

## Cách cài đặt APK trên Android

### Bước 1: Cho phép cài đặt từ nguồn không xác định

1. Vào **Cài đặt** (Settings) trên điện thoại
2. Tìm mục **Bảo mật** (Security) hoặc **Ứng dụng** (Apps)
3. Bật tùy chọn **Cho phép cài đặt từ nguồn không xác định** hoặc **Cài đặt ứng dụng không xác định**
   - Trên Android 8.0+: Vào **Cài đặt** → **Ứng dụng** → **Cài đặt ứng dụng không xác định** → Chọn trình duyệt/file manager bạn dùng

### Bước 2: Chuyển file APK vào điện thoại

**Cách 1: Qua USB**
- Kết nối điện thoại với máy tính qua USB
- Copy file `FastFood-App-v1.0.apk` vào thư mục Download trên điện thoại
- Ngắt kết nối USB

**Cách 2: Qua Email/Cloud**
- Gửi file APK qua email hoặc upload lên Google Drive/Dropbox
- Mở email/cloud trên điện thoại và tải file về

**Cách 3: Qua Bluetooth/AirDrop**
- Gửi file APK qua Bluetooth hoặc AirDrop (nếu dùng iPhone/iPad)

### Bước 3: Cài đặt APK

1. Mở **File Manager** (Quản lý tệp) trên điện thoại
2. Tìm file `FastFood-App-v1.0.apk` trong thư mục **Download**
3. Chạm vào file APK
4. Nếu có cảnh báo, chọn **Cài đặt** (Install)
5. Chờ quá trình cài đặt hoàn tất
6. Chọn **Mở** (Open) để khởi chạy app hoặc tìm icon app trên màn hình chính

## Lưu ý quan trọng

⚠️ **Cảnh báo bảo mật**: 
- Android có thể hiển thị cảnh báo "Cài đặt bị chặn" vì APK không từ Google Play Store
- Đây là bình thường với APK tự build, chọn **Cài đặt vẫn tiếp tục** hoặc **Cho phép từ nguồn này**

✅ **Sau khi cài đặt**:
- App đã được ký (signed) với keystore, an toàn để cài đặt
- App sẽ kết nối với server: `http://103.75.182.180:8000/`
- Đảm bảo điện thoại có kết nối internet

## Gỡ cài đặt

Nếu muốn gỡ app:
1. Vào **Cài đặt** → **Ứng dụng**
2. Tìm **FastFood App** hoặc **com.example.app**
3. Chọn **Gỡ cài đặt** (Uninstall)

## Khắc phục sự cố

**Lỗi "Cài đặt bị chặn"**:
- Kiểm tra lại đã bật "Cài đặt từ nguồn không xác định" chưa
- Thử cài đặt lại

**Lỗi "Không thể cài đặt"**:
- Kiểm tra dung lượng còn trống trên điện thoại (cần ít nhất 50MB)
- Đảm bảo Android version >= 8.0

**App không kết nối được server**:
- Kiểm tra kết nối internet
- Kiểm tra server có đang chạy không: `http://103.75.182.180:8000/`

---

**Ngày tạo**: $(Get-Date -Format "dd/MM/yyyy HH:mm")
**Build**: Release (Signed)

