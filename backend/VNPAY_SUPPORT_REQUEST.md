# Yêu cầu hỗ trợ VNPay - Lỗi "Sai chữ ký"

## Thông tin liên hệ
- **Doanh nghiệp/Cá nhân**: [Điền tên của bạn]
- **Người đại diện**: [Điền tên người đại diện]
- **Email**: [Điền email của bạn]
- **Số điện thoại**: [Điền số điện thoại]

## Nội dung yêu cầu hỗ trợ

Kính gửi VNPay,

Tôi đang gặp lỗi "Sai chữ ký" (Error code: 70) khi tích hợp VNPay API 2.1.0 vào hệ thống của tôi.

### Thông tin tài khoản:
- **Terminal ID (vnp_TmnCode)**: `SY7OSRWP`
- **Secret Key (vnp_HashSecret)**: `W3Z2UI7K93...3WE9O` (32 ký tự)
- **Môi trường**: Sandbox (Test)
- **URL thanh toán**: `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html`

### Vấn đề gặp phải:
Khi tạo URL thanh toán, tôi nhận được lỗi "Sai chữ ký" từ VNPay mặc dù:
- Terminal ID và Secret Key đã được copy trực tiếp từ email của VNPay
- Đã đảm bảo Terminal ID và Secret Key từ cùng một email
- Đã thử nhiều cách tạo signature khác nhau nhưng vẫn lỗi

### Cách tạo signature hiện tại:
1. Sắp xếp các params theo thứ tự alphabet
2. Loại bỏ các params null/undefined/empty
3. Tạo querystring với `encodeURIComponent` cho từng value
4. Tạo HMAC-SHA512 hash với secret key
5. Thêm `vnp_SecureHash` và `vnp_SecureHashType=SHA512` vào params

### SignData mẫu:
```
vnp_Amount=200000000&vnp_Command=pay&vnp_CreateDate=20251201211103&vnp_CurrCode=VND&vnp_IpAddr=192.168.1.1&vnp_Locale=vn&vnp_OrderInfo=Nap%202400%20coins%202000%20400%20bonus%20qua%20VNPay&vnp_OrderType=other&vnp_ReturnUrl=https%3A%2F%2Fjohnie-breakless-dimensionally.ngrok-free.dev%2Fapi%2Fpayment%2Fvnpay%2Freturn&vnp_TmnCode=SY7OSRWP&vnp_TxnRef=1764598263696_VNP1764598263693&vnp_Version=2.1.0
```

### Signature được tạo:
```
313a8509e739b24428a7...
```

### Yêu cầu hỗ trợ:
Vui lòng xác nhận:
1. Cách tạo signature chính xác cho VNPay API 2.1.0
2. Có cần thêm params nào khác không?
3. Cách encode values có đúng không?
4. Có cần thay thế `%20` bằng `+` trong signData không?

### Thông tin bổ sung:
- **Ngôn ngữ lập trình**: Node.js
- **Thư viện sử dụng**: crypto (HMAC-SHA512), qs
- **Phiên bản API**: 2.1.0

Rất mong nhận được phản hồi từ VNPay.

Trân trọng,
[Điền tên của bạn]

