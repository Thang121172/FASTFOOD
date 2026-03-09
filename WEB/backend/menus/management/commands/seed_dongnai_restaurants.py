"""
Django management command to seed restaurants in Dong Nai area
Usage: python manage.py seed_dongnai_restaurants
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from menus.models import Merchant, MenuItem, Category
from orders.models import Order, OrderItem
from accounts.models import Profile
from decimal import Decimal

User = get_user_model()


class Command(BaseCommand):
    help = 'Seed restaurants data for Dong Nai (Bien Hoa, Trang Bom, Ho Nai)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear all existing data before seeding',
        )

    def handle(self, *args, **options):
        if options['clear']:
            self.stdout.write(self.style.WARNING('Clearing all existing data...'))
            self.clear_data()
            self.stdout.write(self.style.SUCCESS('✓ Data cleared'))

        self.stdout.write(self.style.SUCCESS('Starting to seed Dong Nai restaurants...'))
        
        with transaction.atomic():
            # Create merchant owners
            owners = self.create_merchant_owners()
            
            # Create merchants with real GPS
            merchants = self.create_merchants(owners)
            
            # Create menu items
            self.create_menu_items(merchants)
            
            # Create sample customers and shippers
            self.create_sample_users()

        self.stdout.write(self.style.SUCCESS('✓ Successfully seeded Dong Nai restaurants!'))
        self.stdout.write(self.style.SUCCESS(f'Created {len(merchants)} merchants'))

    def clear_data(self):
        """Clear all data from database"""
        try:
            OrderItem.objects.all().delete()
        except Exception as e:
            self.stdout.write(f'  Warning: Could not delete OrderItem: {e}')
        
        try:
            Order.objects.all().delete()
        except Exception as e:
            self.stdout.write(f'  Warning: Could not delete Order: {e}')
        
        try:
            MenuItem.objects.all().delete()
        except Exception as e:
            self.stdout.write(f'  Warning: Could not delete MenuItem: {e}')
        
        try:
            Merchant.objects.all().delete()
        except Exception as e:
            self.stdout.write(f'  Warning: Could not delete Merchant: {e}')
        
        try:
            Category.objects.all().delete()
        except Exception as e:
            self.stdout.write(f'  Warning: Could not delete Category: {e}')
        
        try:
            Profile.objects.all().delete()
        except Exception as e:
            self.stdout.write(f'  Warning: Could not delete Profile: {e}')
        
        try:
            User.objects.all().delete()
        except Exception as e:
            self.stdout.write(f'  Warning: Could not delete User: {e}')

    def create_categories(self):
        """Create food categories"""
        categories_data = [
            'Cơm',
            'Phở',
            'Bánh mì',
            'Cà phê',
            'Trà sữa',
            'Bún',
            'Đồ ăn vặt',
            'Lẩu',
            'Đồ uống',
        ]
        
        categories = {}
        for name in categories_data:
            cat, _ = Category.objects.get_or_create(
                name=name,
                defaults={'description': f'Danh mục {name}'}
            )
            categories[name] = cat
            self.stdout.write(f'  Created category: {name}')
        
        return categories

    def create_merchant_owners(self):
        """Create merchant owner accounts"""
        owners = []
        for i in range(1, 16):
            username = f'merchant{i}'
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': f'{username}@fastfood.vn',
                    'is_active': True,
                }
            )
            if created:
                user.set_password('merchant123')
                user.save()
            
            profile, _ = Profile.objects.get_or_create(
                user=user,
                defaults={
                    'role': 'merchant',
                    'full_name': f'Chủ quán {i}',
                    'phone': f'090000{i:04d}',
                }
            )
            owners.append(user)
        
        self.stdout.write(f'  Created {len(owners)} merchant owners')
        return owners

    def create_merchants(self, owners):
        """Create merchants with real GPS coordinates in Dong Nai"""
        merchants_data = [
            # BIÊN HÒA
            {
                'name': 'Phở Bò Biên Hòa',
                'address': '123 Phạm Văn Thuận, Tân Mai, Biên Hòa',
                'latitude': Decimal('10.9506'),
                'longitude': Decimal('106.8236'),
                'category': 'Phở',
            },
            {
                'name': 'Cơm Tấm Sườn Nướng',
                'address': '45 Võ Thị Sáu, Thống Nhất, Biên Hòa',
                'latitude': Decimal('10.9447'),
                'longitude': Decimal('106.8195'),
                'category': 'Cơm',
            },
            {
                'name': 'Bánh Mì Xíu Mại Biên Hòa',
                'address': '78 Cách Mạng Tháng 8, Quyết Thắng, Biên Hòa',
                'latitude': Decimal('10.9515'),
                'longitude': Decimal('106.8327'),
                'category': 'Bánh mì',
            },
            {
                'name': 'Highlands Coffee Biên Hòa',
                'address': '234 Đại lộ Đồng Khởi, Biên Hòa',
                'latitude': Decimal('10.9458'),
                'longitude': Decimal('106.8215'),
                'category': 'Cà phê',
            },
            {
                'name': 'Trà Sữa TocoToco Biên Hòa',
                'address': '156 Trần Hưng Đạo, Tam Hiệp, Biên Hòa',
                'latitude': Decimal('10.9489'),
                'longitude': Decimal('106.8278'),
                'category': 'Trà sữa',
            },
            
            # HỐ NAI
            {
                'name': 'Bún Bò Huế Hố Nai',
                'address': '67 Quốc Lộ 1, Hố Nai, Biên Hòa',
                'latitude': Decimal('10.9638'),
                'longitude': Decimal('106.8447'),
                'category': 'Bún',
            },
            {
                'name': 'Quán Cơm Gà Hố Nai',
                'address': '123 Đường Hồ Văn Long, Hố Nai, Biên Hòa',
                'latitude': Decimal('10.9615'),
                'longitude': Decimal('106.8502'),
                'category': 'Cơm',
            },
            {
                'name': 'Cà Phê Vỉa Hè Hố Nai',
                'address': '89 ĐT743, Hố Nai, Biên Hòa',
                'latitude': Decimal('10.9592'),
                'longitude': Decimal('106.8425'),
                'category': 'Cà phê',
            },
            {
                'name': 'Lẩu Nướng Hố Nai',
                'address': '234 Quốc Lộ 1K, Hố Nai, Biên Hòa',
                'latitude': Decimal('10.9675'),
                'longitude': Decimal('106.8538'),
                'category': 'Lẩu',
            },
            
            # TRẢNG BOM
            {
                'name': 'Phở Gà Trảng Bom',
                'address': '45 Quốc Lộ 1, Trảng Bom',
                'latitude': Decimal('10.9245'),
                'longitude': Decimal('107.0115'),
                'category': 'Phở',
            },
            {
                'name': 'Bánh Tráng Trảng Bom',
                'address': '123 Nguyễn Văn Trị, Trảng Bom',  
                'latitude': Decimal('10.9198'),
                'longitude': Decimal('107.0087'),
                'category': 'Đồ ăn vặt',
            },
            {
                'name': 'Cơm Niêu Trảng Bom',
                'address': '67 ĐT 769, Trảng Bom',
                'latitude': Decimal('10.9272'),
                'longitude': Decimal('107.0142'),
                'category': 'Cơm',
            },
            {
                'name': 'Trà Chanh Trảng Bom',
                'address': '89 Phan Châu Trinh, Trảng Bom',
                'latitude': Decimal('10.9215'),
                'longitude': Decimal('107.0095'),
                'category': 'Đồ uống',
            },
            {
                'name': 'Bún Riêu Cua Trảng Bom',
                'address': '156 Quốc Lộ 1, Trảng Bom',
                'latitude': Decimal('10.9302'),
                'longitude': Decimal('107.0168'),
                'category': 'Bún',
            },
            {
                'name': 'Trà Sữa Ding Tea Trảng Bom',
                'address': '234 Nguyễn Ái Quốc, Trảng Bom',
                'latitude': Decimal('10.9178'),
                'longitude': Decimal('107.0052'),
                'category': 'Trà sữa',
            },
        ]

        merchants = []
        for i, data in enumerate(merchants_data):
            merchant, created = Merchant.objects.get_or_create(
                name=data['name'],
                defaults={
                    'owner': owners[i],
                    'address': data['address'],
                    'latitude': data['latitude'],
                    'longitude': data['longitude'],
                    'description': f"Chuyên {data['category']} tại {data['address'].split(',')[-1].strip()}",
                    'is_active': True,
                }
            )
            merchants.append((merchant, data['category']))
            if created:
                self.stdout.write(f'  ✓ {data["name"]} - GPS: {data["latitude"]}, {data["longitude"]}')

        return merchants

    def create_menu_items(self, merchants):
        """Create menu items for each merchant"""
        menu_templates = {
            'Phở': [
                ('Phở Bò Tái', 45000),
                ('Phở Bò Chín', 45000),
                ('Phở Gà', 40000),
                ('Phở Đặc Biệt', 55000),
            ],
            'Cơm': [
                ('Cơm Sườn Nướng', 35000),
                ('Cơm Gà Nướng', 35000),
                ('Cơm Bì Chả', 30000),
                ('Cơm Tấm Đặc Biệt', 45000),
            ],
            'Bánh mì': [
                ('Bánh Mì Thịt', 20000),
                ('Bánh Mì Xíu Mại', 25000),
                ('Bánh Mì Pate', 15000),
                ('Bánh Mì Đặc Biệt', 30000),
            ],
            'Cà phê': [
                ('Cà Phê Đen', 20000),
                ('Cà Phê Sữa', 25000),
                ('Bạc Xỉu', 25000),
                ('Cappuccino', 35000),
            ],
            'Trà sữa': [
                ('Trà Sữa Truyền Thống', 25000),
                ('Trà Sữa Trân Châu', 30000),
                ('Trà Sữa Matcha', 35000),
                ('Trà Sữa Socola', 35000),
            ],
            'Bún': [
                ('Bún Bò Huế', 40000),
                ('Bún Riêu', 35000),
                ('Bún Chả', 40000),
                ('Bún Thịt Nướng', 35000),
            ],
            'Đồ ăn vặt': [
                ('Bánh Tráng Trộn', 15000),
                ('Hủ Tiếu Chiên', 25000),
                ('Nem Nướng', 20000),
                ('Chả Giò', 30000),
            ],
            'Lẩu': [
                ('Lẩu Thái', 150000),
                ('Lẩu Bò', 180000),
                ('Lẩu Nướng', 200000),
                ('Lẩu Hải Sản', 220000),
            ],
            'Đồ uống': [
                ('Trà Chanh', 15000),
                ('Nước Cam', 20000),
                ('Sinh Tố Bơ', 25000),
                ('Nước Dừa', 20000),
            ],
        }

        for merchant, category_name in merchants:
            if category_name in menu_templates:
                for item_name, price in menu_templates[category_name]:
                    MenuItem.objects.get_or_create(
                        merchant=merchant,
                        name=item_name,
                        defaults={
                            'price': Decimal(str(price)),
                            'description': f'{item_name} tại {merchant.name}',
                            'is_available': True,
                            'stock': 100,
                        }
                    )

        self.stdout.write(f'  ✓ Created menu items for all merchants')

    def create_sample_users(self):
        """Create sample customers and shippers"""
        # Create 3 customers
        for i in range(1, 4):
            username = f'customer{i}'
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': f'{username}@example.com',
                    'is_active': True,
                }
            )
            if created:
                user.set_password('customer123')
                user.save()
            
            Profile.objects.get_or_create(
                user=user,
                defaults={
                    'role': 'customer',
                    'full_name': f'Khách hàng {i}',
                    'phone': f'091000{i:04d}',
                }
            )

        # Create 5 shippers in different areas
        shipper_locations = [
            ('Biên Hòa Center', Decimal('10.9506'), Decimal('106.8236')),
            ('Hố Nai', Decimal('10.9638'), Decimal('106.8447')),
            ('Trảng Bom', Decimal('10.9245'), Decimal('107.0115')),
            ('Biên Hòa East', Decimal('10.9489'), Decimal('106.8378')),
            ('Trảng Bom Center', Decimal('10.9198'), Decimal('107.0087')),
        ]

        for i, (area, lat, lng) in enumerate(shipper_locations, 1):
            username = f'shipper{i}'
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': f'{username}@fastfood.vn',
                    'is_active': True,
                }
            )
            if created:
                user.set_password('shipper123')
                user.save()
            
            Profile.objects.get_or_create(
                user=user,
                defaults={
                    'role': 'shipper',
                    'full_name': f'Shipper {area}',
                    'phone': f'092000{i:04d}',
                    'latitude': lat,
                    'longitude': lng,
                    'is_available': True,
                    'vehicle_plate': f'59X1-{1000+i}',
                }
            )

        self.stdout.write(f'  ✓ Created 3 customers and 5 shippers')
