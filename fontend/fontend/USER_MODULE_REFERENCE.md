# User Module Reference

Tài liệu này gom toàn bộ luồng và mã nguồn liên quan đến người dùng trong backend `BookStore` để phục vụ khi tích hợp Android (Java/Kotlin). Thông tin được trích trực tiếp từ các file hiện có trong repo.

---

## 1. Kiến trúc tổng quát
- **Xác thực web**: Passport Local Strategy (username/password) cấu hình tại `app.js`. Session lưu trong MongoDB thông qua `connect-mongo`; cookie được bảo vệ bằng `SESSION_SECRET`.
- **API mobile**: Các endpoint REST dùng JWT (Bearer token) cũng khai báo trong `app.js`. Secret đọc từ `JWT_SECRET`.
- **Trạng thái người dùng**: Mọi middleware đều kiểm tra `user.isActive`; admin có thể khóa/mở tài khoản trong giao diện quản trị.
- **Thông báo**: Web render sử dụng `connect-flash` để hiển thị message; API trả JSON/HTTP status.

---

## 2. User Model (`models/User.js`)
- Trường chính:
  - `username` (email dùng để login) – unique, required.
  - `password` – được hash bằng bcrypt ở `pre('save')`.
  - `role` – `customer` (mặc định) hoặc `admin`.
  - `avatar` – đường dẫn file upload (ví dụ `/uploads/<filename>`).
  - `resetPasswordToken`, `resetPasswordExpires` – hỗ trợ quên mật khẩu.
  - `isActive` – khóa/mở tài khoản.
  - `coinBalance` – số dư ví coin (>= 0).
  - `profile` – thông tin cá nhân (fullName, email, phone, address, city, postalCode).
- Method tiện ích:
  - `comparePassword(candidatePassword)` → Promise<boolean>.
  - `addCoins(amount)` / `deductCoins(amount)` / `hasEnoughCoins(amount)` – phục vụ coin system.

---

## 3. Middleware liên quan người dùng
- `middleware/auth.js`
  - `ensureAuthenticated` / `isAuthenticated`: chặn truy cập nếu chưa login hoặc tài khoản bị khóa. Nếu request Accept `application/json` thì trả JSON lỗi, ngược lại redirect kèm flash message.
  - `forwardAuthenticated`: ngăn user đã login truy cập trang login/register.
  - `ensureAdmin` / `isAdmin`: xác thực admin (bao gồm check `isActive`).
- `middleware/adminAuth.js`
  - `requireAdmin` áp dụng cho toàn bộ `/admin`.
  - `setAdminFlag` gắn `res.locals.isAdmin` cho view.

---

## 4. Web Auth & Profile Flow (`controllers/authController.js`, `routes/index.js`)
- **Register (Web)**  
  - `GET /register` hiển thị form.  
  - `POST /register` validate > tạo `User` mới > auto login (Passport `req.login`).  
- **Login (Web)**  
  - `GET /login` hiển thị form.  
  - `POST /login` dùng `passport.authenticate('local')`; admin được redirect `/admin`, khách hàng `/books`.
- **Logout**: `GET /logout`.
- **Forgot/Reset Password**  
  - `GET/POST /forgot-password` tạo token, gửi email (Gmail SMTP qua `.env` `EMAIL_USER/EMAIL_PASS`).  
  - `GET/POST /reset-password/:token` đổi mật khẩu.
- **Change Password (đã login)**  
  - `POST /profile/change-password` (middleware `ensureAuthenticated`). Kiểm tra mật khẩu cũ, cập nhật mới và buộc logout.
- **Profile & Avatar**  
  - `GET /profile` render thông tin.  
  - `POST /profile/upload` dùng `middleware/upload`. Sau khi upload, cập nhật `User.avatar`.

---

## 5. API Auth dành cho Mobile (`app.js`)
Các endpoint JSON sử dụng JWT (Bearer `<token>`). Sau khi đăng ký/đăng nhập thành công, FE/Android lưu token và gửi qua header `Authorization`.

| Endpoint | Method | Body | Response | Notes |
|----------|--------|------|----------|-------|
| `/api/register` | POST | `{ username, password }` | `{ message, user:{id,username,role}, token }` | Validate độ dài ≥6. Check unique username. |
| `/api/login` | POST | `{ username, password }` | giống register | Sai info trả 401. |
| `/api/profile` | GET | Bearer token | `{ user:{id,username,role,avatar} }` | Middleware `authenticateToken`. |
| `/api/forgot-password` | POST | `{ username }` | `{ message }` | Không tiết lộ user có tồn tại hay không. |

Lỗi chung: `401 Invalid token`, `500 Server error`… Kiểm tra log `console.error`.

---

## 6. User Order Flow (`controllers/orderController.js`, `routes/orders.js`)
- Mọi route `/orders` yêu cầu `auth.isAuthenticated`.
- **Checkout**: `GET /orders/checkout` render giỏ hàng (lấy từ `Cart` của user).
- **Create order**: `POST /orders`  
  - Lấy items từ giỏ, tính phí ship bằng `calculateShippingFee`.  
  - Tạo `Order` (tự sinh `orderNumber` trong `models/Order.js`).  
  - Dọn giỏ (`Cart.findOneAndDelete`).  
  - Nếu Accept `application/json` → trả `{ message, order }`; ngược lại redirect + flash.
- **Order history/details**:  
  - `GET /orders` phân trang; Accept JSON trả `orders` + `pagination`.  
  - `GET /orders/:orderId` hiển thị hoặc trả JSON chi tiết.  
- **Cancel**: `POST` hoặc `DELETE /orders/:orderId/cancel` (chỉ `orderStatus === 'pending'`).  
- **Admin update**: `PUT /orders/:orderId/status` (middleware `auth.isAdmin`).  

---

## 7. Coin Wallet Flow (`controllers/coinController.js`, `routes/coins.js`)
- Routes dưới `/coins` đều yêu cầu `isAuthenticated`.
- `GET /coins/wallet`: render số dư và 10 giao dịch gần nhất (`CoinTransaction.getUserTransactions`).
- `GET /coins/topup`: hiển thị gói nạp preset.
- `POST /coins/topup`: giả lập thanh toán, quy đổi 1,000 VND = 1 coin + bonus theo bậc; tạo transaction `type: 'deposit'`.
- `GET /coins/history`: phân trang lịch sử (lọc theo `type` nếu có).
- API:  
  - `GET /coins/api/balance`: JSON `{ success, balance }`.  
  - `POST /coins/api/payment-callback`: mô phỏng cập nhật trạng thái giao dịch.  
- Admin-only: `POST /coins/admin/give-bonus` (middleware `isAdmin`) – tạo transaction `type: 'bonus'`.

---

## 8. Admin User Management (`controllers/adminController.js`, `routes/admin.js`)
- `GET /admin/users`: phân trang người dùng (filter role/search).  
- `GET /admin/users/:id`: chi tiết.  
- `POST /admin/users/:id/role`: thay đổi role.  
- `POST /admin/users/:id/toggle-status`: khóa/mở tài khoản; ngăn admin tự khóa chính mình.  
- Coin bonus cũng thao tác trên user (mục 7).  
- Dashboard còn hiển thị thống kê người dùng/sách/admin để hỗ trợ vận hành.

---

## 9. Các lưu ý tích hợp Android
- **Session vs JWT**: Mobile nên dùng JWT endpoints (mục 5). Không cần cookie/session.
- **Trạng thái khóa**: Nếu admin khóa user (`isActive=false`), mọi middleware/API sẽ trả 403/redirect → cần xử lý logout phía mobile.
- **Avatar & uploads**: Hiện tại upload chỉ hỗ trợ từ web (multipart + `middleware/upload`). Mobile có thể reuse endpoint `/profile/upload` (cần gửi form-data kèm file).
- **Reset password email**: Dùng Gmail SMTP, cần thiết lập `EMAIL_USER`, `EMAIL_PASS`.
- **Error localization**: Message chủ yếu tiếng Việt; mobile có thể hiển thị trực tiếp hoặc map sang mã lỗi riêng.
- **Coin & Order**: Khi cần đồng bộ trên app, gọi các API JSON (đặt Accept header). Nhiều controller đã phân nhánh theo header để trả JSON thay vì render view.

---

## 10. Biến môi trường liên quan
- `MONGODB_URI` – kết nối DB.
- `SESSION_SECRET` – session cookie.
- `JWT_SECRET` – ký token cho mobile/API.
- `EMAIL_USER`, `EMAIL_PASS` – gửi mail reset password.
- `CORS_ORIGINS` – whitelist origin cho frontend/mobile (xem `app.js`).

---

### Checklist tích hợp nhanh
1. Gọi `POST /api/login` → lưu token.
2. Thêm header `Authorization: Bearer <token>` cho các request cần bảo vệ (`/api/profile`, `/orders/*` nếu dùng JSON, `/coins/api/*`, …).
3. Lắng nghe HTTP 401/403 để logout hoặc hiển thị thông báo tài khoản bị khóa.
4. Khi cần ví coin hoặc đơn hàng, gửi header `Accept: application/json` để backend trả JSON thay vì HTML.
5. Admin thao tác nên dùng web; mobile admin muốn thao tác cần tái sử dụng các endpoint `/admin` hoặc xây API mới.

---

> File này tự động hóa quá trình “ghi nhớ” phần user: chỉ cần tham chiếu `docs/USER_MODULE_REFERENCE.md` để biết chính xác model, controller, route và yêu cầu tích hợp.

