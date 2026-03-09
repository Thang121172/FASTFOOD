#!/bin/bash
# Script Deploy tự động cho VPS Production

echo "🚀 Bắt đầu quá trình Deploy FastFood dự án..."

# Kéo code mới nhất từ branch main
echo "📥 Đang kéo code mới từ GitHub..."
git pull origin main

# Build lại các image (nếu có cập nhật Dockerfile)
echo "📦 Đang build các Docker images..."
docker-compose -f docker-compose.prod.yml build

# Khởi động / Cập nhật containers
echo "🔄 Đang cập nhật containers..."
docker-compose -f docker-compose.prod.yml up -d

# Migrate database (Django)
echo "🗄️ Đang chạy Migration cho Database..."
docker exec -it fastfood_django_prod python manage.py migrate
docker exec -it fastfood_django_prod python manage.py collectstatic --noinput

# Xóa các images cũ thừa (Dangling images) để tiết kiệm dung lượng VPS
echo "🧹 Đang dọn dẹp hệ thống..."
docker image prune -f

echo "✅ Quá trình Deploy hoàn tất!"
echo "Truy cập hệ thống tại Domain/IP của bạn."
