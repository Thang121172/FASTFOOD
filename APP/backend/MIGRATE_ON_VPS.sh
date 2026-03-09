#!/bin/bash
# Script chạy migration trên VPS
# Sử dụng: ./MIGRATE_ON_VPS.sh

set -e  # Dừng nếu có lỗi

echo "🚀 Bắt đầu migration database trên VPS..."
echo ""

# Kiểm tra file .env
if [ ! -f .env ]; then
    echo "⚠️  Không tìm thấy file .env"
    echo "   Tạo file .env mẫu..."
    
    cat > .env << 'EOF'
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fastfood
DB_USER=app
DB_PASSWORD=123456

# Server Configuration
PORT=8000
NODE_ENV=production

# JWT Secret
JWT_SECRET=your-secret-key-change-this-in-production
EOF
    
    echo "✅ Đã tạo file .env mẫu"
    echo "   ⚠️  Vui lòng chỉnh sửa file .env với thông tin database của bạn!"
    echo ""
    read -p "Nhấn Enter sau khi đã chỉnh sửa .env..."
fi

# Kiểm tra PostgreSQL
echo "📊 Kiểm tra PostgreSQL..."
if ! systemctl is-active --quiet postgresql; then
    echo "⚠️  PostgreSQL không chạy. Đang khởi động..."
    sudo systemctl start postgresql
    sleep 2
fi

echo "✅ PostgreSQL đang chạy"
echo ""

# Kiểm tra kết nối database
echo "🔌 Kiểm tra kết nối database..."
source .env
if psql -h "${DB_HOST:-localhost}" -U "${DB_USER:-app}" -d "${DB_NAME:-fastfood}" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Kết nối database thành công"
else
    echo "❌ Không thể kết nối database"
    echo "   Kiểm tra lại thông tin trong file .env"
    exit 1
fi

echo ""

# Chạy migration
echo "📦 Đang chạy migration..."
echo ""

node migrate.js

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration thành công!"
    echo ""
    
    # Kiểm tra bảng users
    echo "🔍 Kiểm tra bảng users..."
    if psql -h "${DB_HOST:-localhost}" -U "${DB_USER:-app}" -d "${DB_NAME:-fastfood}" -c "SELECT COUNT(*) FROM users;" > /dev/null 2>&1; then
        USER_COUNT=$(psql -h "${DB_HOST:-localhost}" -U "${DB_USER:-app}" -d "${DB_NAME:-fastfood}" -t -c "SELECT COUNT(*) FROM users;")
        echo "✅ Bảng users tồn tại với $USER_COUNT users"
    else
        echo "❌ Bảng users không tồn tại!"
        exit 1
    fi
    
    echo ""
    echo "💡 Bước tiếp theo:"
    echo "   - Khởi động lại backend: pm2 restart fastfood-backend"
    echo "   - Hoặc: sudo systemctl restart fastfood-backend"
    echo "   - Test API: curl http://localhost:8000/api/v1/restaurants"
    
else
    echo ""
    echo "❌ Migration thất bại!"
    echo "   Kiểm tra log ở trên để xem lỗi chi tiết"
    exit 1
fi

echo ""

