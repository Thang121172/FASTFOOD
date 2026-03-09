import os
from pathlib import Path
from dotenv import load_dotenv
import dj_database_url

# Load environment variables (for local development)
load_dotenv() 

# Thiết lập đường dẫn cơ sở của dự án
BASE_DIR = Path(__file__).resolve().parent.parent

# --------------------------
# I. CẤU HÌNH CƠ BẢN
# --------------------------

SECRET_KEY = os.environ.get('SECRET_KEY', 'default-insecure-secret-key-for-local-only')
DEBUG = os.environ.get('DJANGO_DEBUG', 'False').lower() == 'true'
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '127.0.0.1,localhost').split(',')


# Tên các ứng dụng (Apps)
INSTALLED_APPS = [
    # Built-in Apps
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third-party Apps
    'rest_framework',
    'corsheaders',
    'celery', 

    # Your Apps: ĐÃ SỬA LỖI - Trỏ đúng AppConfig
    'accounts.app.AccountsConfig', # Trỏ đến file app.py của accounts
    'menus.apps.MenusConfig',      # Trỏ đến file apps.py của menus
    'orders',
    'payments',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware', 
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware', 
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# ĐÃ SỬA LỖI - BỎ TIỀN TỐ 'backend.'
ROOT_URLCONF = 'urls' 
WSGI_APPLICATION = 'wsgi.application'


# --------------------------
# II. CẤU HÌNH DATABASE
# --------------------------

DATABASE_URL = os.environ.get('DATABASE_URL')

if DATABASE_URL:
    DATABASES = {
        'default': dj_database_url.config(default=DATABASE_URL, conn_max_age=600)
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }


# --------------------------
# III. CẤU HÌNH CELERY
# --------------------------

CELERY_BROKER_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0') 
CELERY_RESULT_BACKEND = CELERY_BROKER_URL

CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'Asia/Ho_Chi_Minh'


# --------------------------
# IV. STATIC FILES
# --------------------------

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles' 
STATICFILES_DIRS = [
    BASE_DIR / 'static',
]

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'mediafiles'

# --------------------------
# V. CÀI ĐẶT KHÁC
# --------------------------

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Ho_Chi_Minh'
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'