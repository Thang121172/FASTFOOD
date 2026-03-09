import os
import django
from celery import Celery

# Thiet lap bien moi truong Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

# === BAO VE CHONG LOI populate() isn't reentrant ===
# Lenh 'python manage.py migrate' da tu dong goi django.setup().
# Neu Celery app (duoc import) goi lai setup(), se gay ra RuntimeError.
# Chung ta chi goi setup() neu no chua duoc goi, hoac neu day la mot script doc lap.

# Kiem tra xem Django da duoc setup chua
if not django.apps.apps.ready:
    # Goi django.setup() va bat loi reentrant
    try:
        django.setup()
    except RuntimeError as e:
        # Bat loi neu populate() da xay ra (thuong khi chay manage.py)
        # Neu day la loi reentrant, ta bo qua, neu khong ta raise loi
        if "populate() isn't reentrant" not in str(e):
            raise

# 3. Tao ung dung Celery
app = Celery("core")

# Cau hinh Celery bang cach su dung cai dat Django.
app.config_from_object("django.conf:settings", namespace="CELERY")

# Tu dong kham pha cac tac vu (tasks) trong cac ung dung Django da cai dat.
app.autodiscover_tasks()

# NOTE: Neu ban muon su dung ten app Celery la `celery_app` nhu convention cu:
# from .app import app as celery_app 
# trong __init__.py cua core.
