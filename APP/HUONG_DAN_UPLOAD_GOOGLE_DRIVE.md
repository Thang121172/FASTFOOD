# 📤 Hướng Dẫn Upload APK Lên Google Drive

## Cách 1: Upload qua Google Drive Web (Đơn giản nhất) ✅

### Bước 1: Truy cập Google Drive
1. Mở trình duyệt (Chrome, Firefox, Edge...)
2. Truy cập: https://drive.google.com
3. Đăng nhập bằng tài khoản Google của bạn

### Bước 2: Upload file APK
1. **Chọn thư mục** bạn muốn lưu (hoặc để nguyên thư mục "My Drive")
2. Click nút **"+ Mới"** (New) ở góc trái trên
3. Chọn **"Tải tệp lên"** (File upload) hoặc **"Tải thư mục lên"** (Folder upload)
4. Tìm và chọn file `FastFood-App-v1.0.apk` từ máy tính
5. Đợi quá trình upload hoàn tất (sẽ thấy thanh tiến trình)

### Bước 3: Chia sẻ file (Lấy link công khai)
1. **Click chuột phải** vào file APK vừa upload
2. Chọn **"Chia sẻ"** (Share) hoặc click icon **👤** 
3. Trong cửa sổ chia sẻ:
   - **Option 1 - Chia sẻ công khai:**
     - Click **"Thay đổi"** (Change) ở phần "Hạn chế"
     - Chọn **"Bất kỳ ai có liên kết"** (Anyone with the link)
     - Click **"Xong"** (Done)
     - Copy link chia sẻ (sẽ có format: `https://drive.google.com/file/d/.../view?usp=sharing`)
   
   - **Option 2 - Chia sẻ với email cụ thể:**
     - Nhập email của người muốn chia sẻ vào ô
     - Click **"Gửi"** (Send)

### Bước 4: Lấy link trực tiếp để tải về (Tùy chọn)
Nếu muốn link trực tiếp để tải về (không cần vào Drive):

1. Click chuột phải vào file → **"Lấy liên kết"** (Get link)
2. Link sẽ có dạng: `https://drive.google.com/file/d/FILE_ID/view?usp=sharing`
3. **Chuyển đổi link** để tải trực tiếp:
   - Thay `.../view?usp=sharing` thành `.../view?usp=sharing` 
   - Hoặc dùng công thức: `https://drive.google.com/uc?export=download&id=FILE_ID`
   - FILE_ID là đoạn mã giữa `/file/d/` và `/view`

**Ví dụ:**
- Link gốc: `https://drive.google.com/file/d/1ABC123xyz789/view?usp=sharing`
- Link tải trực tiếp: `https://drive.google.com/uc?export=download&id=1ABC123xyz789`

---

## Cách 2: Kéo thả (Drag & Drop)

1. Mở Google Drive trong trình duyệt
2. Mở File Explorer (Windows) hoặc Finder (Mac)
3. Tìm file `FastFood-App-v1.0.apk`
4. **Kéo thả** file vào cửa sổ Google Drive
5. Đợi upload xong và chia sẻ như trên

---

## Cách 3: Sử dụng Google Drive Desktop App

1. **Cài đặt Google Drive cho Desktop:**
   - Tải từ: https://www.google.com/drive/download/
   - Cài đặt và đăng nhập

2. **Upload file:**
   - File APK sẽ xuất hiện trong thư mục Google Drive trên máy tính
   - Copy file `FastFood-App-v1.0.apk` vào thư mục đó
   - File sẽ tự động sync lên Drive

---

## Cách 4: Upload bằng PowerShell (Nâng cao)

Nếu bạn có Google Drive API credentials, có thể dùng script:

```powershell
# Cần cài đặt Google Drive API và xác thực trước
# Hướng dẫn này chỉ dành cho người có kinh nghiệm lập trình
```

**Lưu ý:** Cách này phức tạp, không khuyến nghị cho người dùng thông thường.

---

## ✅ Khuyến nghị

**Sử dụng Cách 1** (Google Drive Web) vì:
- ✅ Đơn giản, không cần cài đặt
- ✅ Dễ chia sẻ và quản lý
- ✅ Hoạt động trên mọi thiết bị (PC, Mac, Mobile)
- ✅ Có thể xem số lượt tải

---

## 📱 Cách người khác tải APK từ Google Drive

1. Mở link chia sẻ bạn gửi
2. Click nút **"Tải xuống"** (Download) hoặc icon **⬇️**
3. Chờ tải về xong
4. Cài đặt như hướng dẫn trong file `HUONG_DAN_CAI_DAT_APK.md`

---

## 🔒 Bảo mật

- ⚠️ **Lưu ý:** Khi chia sẻ link công khai, bất kỳ ai có link đều có thể tải về
- ✅ **An toàn hơn:** Chỉ chia sẻ với email cụ thể nếu muốn kiểm soát người tải
- ✅ **Theo dõi:** Google Drive cho phép xem ai đã tải file (nếu bật tính năng này)

---

## 🆘 Khắc phục sự cố

**Lỗi "File quá lớn":**
- Google Drive miễn phí giới hạn 15GB
- File APK ~6.5MB nên không vấn đề
- Nếu gặp lỗi, kiểm tra dung lượng Drive còn trống

**Upload chậm:**
- Kiểm tra tốc độ internet
- Đóng các tab/ứng dụng khác đang dùng băng thông
- Thử lại vào giờ khác

**Không tìm thấy file để upload:**
- File APK nằm ở: `T:\FASTFOOD\APP\FastFood-App-v1.0.apk`
- Hoặc tìm trong thư mục Downloads nếu đã copy

---

**Ngày cập nhật:** 26/11/2025

