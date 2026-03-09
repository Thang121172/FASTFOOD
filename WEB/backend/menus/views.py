from rest_framework import viewsets, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from .models import MenuItem, Merchant
from .serializers import MenuItemSerializer, MerchantSerializer
from .utils import haversine_distance


class MerchantViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet cho merchants - chỉ đọc (list, retrieve)
    """
    queryset = Merchant.objects.filter(is_active=True)
    serializer_class = MerchantSerializer

    @action(detail=False, methods=['get'], url_path='nearby')
    def nearby(self, request):
        """
        Lấy danh sách merchants gần vị trí khách hàng.
        
        Query params:
        - lat: Vĩ độ của khách hàng (required)
        - lng: Kinh độ của khách hàng (required)
        - radius: Bán kính tìm kiếm (km), mặc định 10km
        """
        lat = request.query_params.get('lat')
        lng = request.query_params.get('lng')
        try:
            radius = float(request.query_params.get('radius', 10))
        except (ValueError, TypeError):
            radius = 10.0

        if not lat or not lng:
            return Response(
                {'error': 'Thiếu tham số lat và lng'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            customer_lat = float(lat)
            customer_lng = float(lng)
        except (ValueError, TypeError):
            return Response(
                {'error': 'lat và lng phải là số hợp lệ'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Lấy tất cả merchant có tọa độ
        merchants_with_location = Merchant.objects.filter(
            is_active=True,
            latitude__isnull=False,
            longitude__isnull=False
        )

        # Tính khoảng cách và lọc merchant trong phạm vi
        nearby_merchants = []
        for merchant in merchants_with_location:
            try:
                if merchant.latitude is None or merchant.longitude is None:
                    continue
                    
                merchant_lat = float(merchant.latitude)
                merchant_lng = float(merchant.longitude)
                
                distance = haversine_distance(
                    customer_lat, customer_lng,
                    merchant_lat, merchant_lng
                )
                if distance <= radius:
                    merchant.distance_km = distance
                    nearby_merchants.append(merchant)
            except (ValueError, TypeError):
                continue

        # Sắp xếp theo khoảng cách (gần nhất trước)
        nearby_merchants.sort(key=lambda m: m.distance_km)

        # Serialize
        serializer = self.get_serializer(nearby_merchants, many=True)
        data = serializer.data

        # Thêm khoảng cách vào mỗi merchant
        for item_data, merchant in zip(data, nearby_merchants):
            item_data['distance_km'] = round(merchant.distance_km, 2)

        return Response({
            'merchants': data,
            'count': len(data),
            'radius_km': radius,
            'customer_location': {'lat': customer_lat, 'lng': customer_lng}
        })


class MenuViewSet(viewsets.ModelViewSet):
    queryset = MenuItem.objects.all().select_related('merchant')
    serializer_class = MenuItemSerializer
    
    def get_queryset(self):
        """
        Override queryset:
        - Merchant/Admin: thấy tất cả món của merchant của họ (kể cả đã ẩn)
        - Customer/Public: chỉ thấy món is_available=True
        """
        queryset = MenuItem.objects.all().select_related('merchant')
        
        # Nếu user là merchant hoặc admin, cho phép thấy tất cả món của merchant của họ
        if self.request.user.is_authenticated:
            from accounts.models import Profile
            try:
                profile = self.request.user.profile
                if profile.role in ['merchant', 'admin']:
                    # Lấy danh sách merchant mà user có quyền
                    from orders.views import user_merchants
                    merchants = user_merchants(self.request.user)
                    if merchants.exists():
                        # Merchant chỉ thấy món của merchant của họ
                        queryset = queryset.filter(merchant__in=merchants)
                    else:
                        # Nếu không có merchant, trả về empty queryset
                        queryset = queryset.none()
                    return queryset
            except Profile.DoesNotExist:
                pass
        
        # Customer/Public: chỉ thấy món is_available=True
        return queryset.filter(is_available=True)
    
    def get_serializer_context(self):
        """Thêm request vào context để serializer có thể build absolute URL"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def perform_create(self, serializer):
        """Gán `merchant` tự động dựa trên user hiện tại. Trả 403 nếu user không thuộc merchant nào."""
        if not self.request.user or not self.request.user.is_authenticated:
            raise PermissionDenied('Authentication required to create menu items')

        # Lấy danh sách merchant mà user có quyền
        from orders.views import user_merchants
        merchants = user_merchants(self.request.user)
        if not merchants.exists():
            raise PermissionDenied('User does not belong to any merchant')

        # Nếu user có nhiều merchant, chọn cái đầu tiên (hoặc có thể mở rộng để cho chọn)
        merchant = merchants.first()
        serializer.save(merchant=merchant)

    def perform_update(self, serializer):
        """Đảm bảo user có quyền cập nhật menu item (thuộc merchant của họ)."""
        instance = self.get_object()
        if not self.request.user or not self.request.user.is_authenticated:
            raise PermissionDenied('Authentication required to update menu items')

        from orders.views import user_merchants
        merchants = user_merchants(self.request.user)
        if not merchants.filter(id=instance.merchant_id).exists():
            raise PermissionDenied('You do not have permission to update this menu item')

        serializer.save()

    def perform_destroy(self, instance):
        """Đảm bảo user có quyền xóa menu item."""
        if not self.request.user or not self.request.user.is_authenticated:
            raise PermissionDenied('Authentication required to delete menu items')

        from orders.views import user_merchants
        merchants = user_merchants(self.request.user)
        if not merchants.filter(id=instance.merchant_id).exists():
            raise PermissionDenied('You do not have permission to delete this menu item')

        instance.delete()

    @action(detail=False, methods=['get'], url_path='nearby')
    def nearby(self, request):
        """
        Lấy danh sách menu items từ các merchant gần vị trí khách hàng.
        
        Query params:
        - lat: Vĩ độ của khách hàng (required)
        - lng: Kinh độ của khách hàng (required)
        - radius: Bán kính tìm kiếm (km), mặc định 10km
        """
        lat = request.query_params.get('lat')
        lng = request.query_params.get('lng')
        try:
            radius = float(request.query_params.get('radius', 10))  # Mặc định 10km
        except (ValueError, TypeError):
            radius = 10.0  # Mặc định 10km nếu không hợp lệ

        if not lat or not lng:
            return Response(
                {'error': 'Thiếu tham số lat và lng'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            customer_lat = float(lat)
            customer_lng = float(lng)
        except (ValueError, TypeError):
            return Response(
                {'error': 'lat và lng phải là số hợp lệ'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Lấy tất cả merchant có tọa độ
        merchants_with_location = Merchant.objects.filter(
            is_active=True,
            latitude__isnull=False,
            longitude__isnull=False
        )

        # Tính khoảng cách và lọc merchant trong phạm vi
        nearby_merchants = []
        for merchant in merchants_with_location:
            try:
                # Đảm bảo latitude và longitude không phải None
                if merchant.latitude is None or merchant.longitude is None:
                    continue
                    
                merchant_lat = float(merchant.latitude)
                merchant_lng = float(merchant.longitude)
                
                distance = haversine_distance(
                    customer_lat, customer_lng,
                    merchant_lat, merchant_lng
                )
                if distance <= radius:
                    merchant.distance_km = distance
                    nearby_merchants.append(merchant)
            except (ValueError, TypeError) as e:
                # Bỏ qua merchant có tọa độ không hợp lệ
                continue

        # Lấy menu items từ các merchant gần đó
        if not nearby_merchants:
            return Response({
                'items': [],
                'message': f'Không tìm thấy cửa hàng nào trong phạm vi {radius}km'
            })

        merchant_ids = [m.id for m in nearby_merchants]
        menu_items = MenuItem.objects.filter(
            merchant_id__in=merchant_ids,
            is_available=True,
            merchant__isnull=False  # Đảm bảo merchant tồn tại
        ).select_related('merchant')

        # Tạo dict để tra cứu khoảng cách nhanh
        merchant_distance_map = {m.id: m.distance_km for m in nearby_merchants}

        # Serialize và thêm khoảng cách
        try:
            serializer = self.get_serializer(menu_items, many=True)
            data = serializer.data

            # Thêm khoảng cách vào mỗi item
            for item_data, item in zip(data, menu_items):
                item_data['distance_km'] = round(merchant_distance_map.get(item.merchant_id, 0), 2)

            # Sắp xếp theo khoảng cách (gần nhất trước)
            data.sort(key=lambda x: x.get('distance_km', float('inf')))
        except Exception as e:
            # Nếu có lỗi serialize, trả về lỗi
            return Response(
                {'error': f'Lỗi khi xử lý dữ liệu: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response({
            'items': data,
            'count': len(data),
            'radius_km': radius,
            'customer_location': {'lat': customer_lat, 'lng': customer_lng}
        })
