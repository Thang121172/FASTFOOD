# backend/orders/models.py

from django.db import models
from django.conf import settings
# ĐÃ SỬA: Dùng đường dẫn tuyệt đối (backend.menus.models)
from menus.models import Merchant, MenuItem

User = settings.AUTH_USER_MODEL


class Order(models.Model):
    """
    Đơn hàng mà customer đặt từ một merchant cụ thể.
    Sau đó merchant xác nhận, shipper nhận giao.
    """

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"              # khách đặt, chờ merchant duyệt
        CONFIRMED = "CONFIRMED", "Confirmed"        # merchant chấp nhận làm
        READY = "READY_FOR_PICKUP", "Ready for pickup"  # món đã sẵn sàng để shipper lấy
        PICKED_UP = "PICKED_UP", "Picked up"        # shipper đã nhận hàng
        DELIVERING = "DELIVERING", "Delivering"     # đang giao
        DELIVERED = "DELIVERED", "Delivered"        # đã giao xong
        CANCELED = "CANCELED", "Canceled"           # hủy

    class PaymentStatus(models.TextChoices):
        UNPAID = "UNPAID", "Unpaid"
        PAID = "PAID", "Paid"
        REFUNDED = "REFUNDED", "Refunded"

    # Ai đặt đơn
    customer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="customer_orders",
        help_text="Người đặt đơn (role=customer)",
    )

    # Đơn thuộc merchant nào
    merchant = models.ForeignKey(
        Merchant,
        on_delete=models.CASCADE,
        related_name="orders",
        help_text="Cửa hàng nhận đơn",
    )

    # Shipper nào đang/đã giao đơn (có thể null lúc mới tạo)
    shipper = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="shipper_orders",
        null=True,
        blank=True,
        help_text="Shipper đảm nhận đơn này",
    )

    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.PENDING,
        help_text="Trạng thái xử lý đơn hàng",
    )

    payment_status = models.CharField(
        max_length=16,
        choices=PaymentStatus.choices,
        default=PaymentStatus.UNPAID,
        help_text="Trạng thái thanh toán",
    )

    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text="Tổng tiền khi checkout",
    )

    delivery_address = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Địa chỉ giao hàng (điền bởi customer)",
    )

    delivery_lat = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        blank=True,
        null=True,
        help_text="Vĩ độ giao hàng",
    )

    delivery_lng = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        blank=True,
        null=True,
        help_text="Kinh độ giao hàng",
    )

    note = models.TextField(
        blank=True,
        default="",
        help_text="Ghi chú thêm của khách (ví dụ: ít cay)",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Thời điểm khách tạo đơn",
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Thời điểm trạng thái đơn được cập nhật lần cuối",
    )

    def __str__(self):
        return f"Order#{self.id} | {self.merchant.name} -> {self.customer}"

    @property
    def is_available_for_shipper(self):
        """
        Dùng cho ShipperViewSet:
        Trả True nếu đơn đã sẵn sàng để shipper nhận (READY_FOR_PICKUP)
        và chưa có shipper nào claim.
        """
        return (
            self.status == self.Status.READY
            and self.shipper is None
        )


class OrderItem(models.Model):
    """
    Chi tiết từng món trong đơn hàng.
    Lưu snapshot tên và giá của món tại thời điểm đặt để không bị ảnh hưởng
    nếu MenuItem đổi giá sau này.
    """

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="items",
    )

    menu_item = models.ForeignKey(
        MenuItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="order_items",
        help_text="Tham chiếu món gốc (có thể null nếu món bị xóa sau này)",
    )

    name_snapshot = models.CharField(
        max_length=200,
        help_text="Tên món tại thời điểm đặt",
    )

    price_snapshot = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Giá đơn vị tại thời điểm đặt",
    )

    quantity = models.PositiveIntegerField(
        default=1,
        help_text="Số lượng món khách chọn",
    )

    line_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="price_snapshot * quantity",
    )

    def __str__(self):
        return f"{self.quantity} x {self.name_snapshot} (Order {self.order_id})"


# =========================================================
# UC-11: Review & Rating Models
# =========================================================

class Review(models.Model):
    """
    UC-11: Đánh giá đơn/món/shipper
    Customer có thể đánh giá:
    - Đơn hàng (order)
    - Món ăn (menu_item) 
    - Shipper
    """
    
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="reviews",
        help_text="Đơn hàng được đánh giá"
    )
    
    customer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="reviews_given",
        help_text="Khách hàng đánh giá"
    )
    
    # Đánh giá tổng thể đơn hàng (1-5 sao)
    order_rating = models.PositiveIntegerField(
        default=5,
        help_text="Đánh giá đơn hàng (1-5 sao)"
    )
    
    # Đánh giá merchant/cửa hàng
    merchant_rating = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Đánh giá cửa hàng (1-5 sao)"
    )
    
    # Đánh giá shipper (nếu có)
    shipper_rating = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Đánh giá shipper (1-5 sao)"
    )
    
    comment = models.TextField(
        blank=True,
        default="",
        help_text="Nhận xét của khách hàng"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = [['order', 'customer']]  # Mỗi customer chỉ đánh giá 1 lần cho 1 đơn
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Review for Order#{self.order_id} by {self.customer.username}"


class MenuItemReview(models.Model):
    """
    Đánh giá chi tiết từng món trong đơn hàng
    """
    
    review = models.ForeignKey(
        Review,
        on_delete=models.CASCADE,
        related_name="menu_item_reviews"
    )
    
    order_item = models.ForeignKey(
        OrderItem,
        on_delete=models.CASCADE,
        related_name="reviews"
    )
    
    rating = models.PositiveIntegerField(
        default=5,
        help_text="Đánh giá món (1-5 sao)"
    )
    
    comment = models.TextField(
        blank=True,
        default="",
        help_text="Nhận xét về món"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = [['review', 'order_item']]
    
    def __str__(self):
        return f"Review for {self.order_item.name_snapshot} in Order#{self.order_item.order_id}"


# =========================================================
# UC-13: Complaint & Feedback Models
# =========================================================

class Complaint(models.Model):
    """
    UC-13: Khiếu nại / phản hồi
    Customer có thể gửi khiếu nại về đơn hàng
    Merchant/Admin có thể xử lý khiếu nại
    """
    
    class Status(models.TextChoices):
        PENDING = "PENDING", "Chờ xử lý"
        IN_PROGRESS = "IN_PROGRESS", "Đang xử lý"
        RESOLVED = "RESOLVED", "Đã giải quyết"
        REJECTED = "REJECTED", "Từ chối"
    
    class Type(models.TextChoices):
        ORDER_ISSUE = "ORDER_ISSUE", "Vấn đề về đơn hàng"
        FOOD_QUALITY = "FOOD_QUALITY", "Chất lượng món ăn"
        DELIVERY_ISSUE = "DELIVERY_ISSUE", "Vấn đề giao hàng"
        PAYMENT_ISSUE = "PAYMENT_ISSUE", "Vấn đề thanh toán"
        OTHER = "OTHER", "Khác"
    
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="complaints",
        help_text="Đơn hàng liên quan"
    )
    
    customer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="complaints_filed",
        help_text="Khách hàng gửi khiếu nại"
    )
    
    complaint_type = models.CharField(
        max_length=32,
        choices=Type.choices,
        default=Type.OTHER
    )
    
    title = models.CharField(
        max_length=255,
        help_text="Tiêu đề khiếu nại"
    )
    
    description = models.TextField(
        help_text="Mô tả chi tiết khiếu nại"
    )
    
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.PENDING
    )
    
    # Phản hồi từ merchant/admin
    response = models.TextField(
        blank=True,
        default="",
        help_text="Phản hồi từ merchant/admin"
    )
    
    # Người xử lý (merchant hoặc admin)
    handled_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="complaints_handled",
        help_text="Người xử lý khiếu nại"
    )
    
    resolved_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Thời điểm giải quyết"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Complaint#{self.id} - {self.title} (Order#{self.order_id})"