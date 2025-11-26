# Backend Cart (Giỏ Hàng) API Requirements

Tài liệu này tổng hợp toàn bộ chức năng backend cho "giỏ hàng" để frontend/mobile dễ tích hợp.

---

## 1. Tổng quan

Hệ thống giỏ hàng cho phép người dùng:
- Xem giỏ hàng của mình
- Thêm sách vào giỏ hàng
- Cập nhật số lượng sách trong giỏ hàng
- Xóa sách khỏi giỏ hàng

**Lưu ý quan trọng:**
- Tất cả API yêu cầu xác thực JWT (Bearer token)
- Mỗi user chỉ có một giỏ hàng duy nhất
- Giỏ hàng tự động tính tổng tiền dựa trên giá và số lượng
- Kiểm tra tồn kho khi thêm/cập nhật sản phẩm

---

## 2. Models

### 2.1 `models/Cart.js`

```javascript
const CartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [{
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    price: {
      type: Number,
      required: true
    }
  }],
  totalAmount: {
    type: Number,
    default: 0
  }
}, { timestamps: true });
```

**Tính năng:**
- `pre('save')`: Tự động tính `totalAmount` = tổng (price × quantity) của tất cả items
- Method `toCartJSON()`: Chuyển đổi cart thành JSON với thông tin book đã populate

**Quan hệ:**
- `user`: Reference đến User model (1-1)
- `items[].book`: Reference đến Book model (many-to-many qua items)

---

## 3. Routes

### 3.1 `routes/apiCart.js`

```javascript
GET  /api/cart                    -> apiCartController.getCart
POST /api/cart/add                -> apiCartController.addItem
POST /api/cart/update             -> apiCartController.updateItem
POST /api/cart/remove/:bookId     -> apiCartController.removeItem
```

**Middleware:**
- Tất cả routes đều yêu cầu `authenticateToken` từ `middleware/apiAuth.js`
- Sau khi xác thực, `req.user` chứa thông tin user đã đăng nhập

---

## 4. Controllers

### 4.1 `controllers/apiCartController.js`

#### `getCart(req, res)`
- **Mục đích**: Lấy thông tin giỏ hàng của user hiện tại
- **Input**: Không cần body, lấy `userId` từ `req.user`
- **Response thành công (200)**:
  ```json
  {
    "success": true,
    "message": "Lấy giỏ hàng thành công",
    "cart": {
      "id": "cart_id_string",
      "user": "user_id_string",
      "items": [
        {
          "book": {
            "id": "book_id_string",
            "title": "Tên sách",
            "author": "Tác giả",
            "price": 100000,
            "coverImage": "/uploads/cover.jpg",
            "stock": 50
          },
          "quantity": 2,
          "price": 100000,
          "lineTotal": 200000
        }
      ],
      "totalAmount": 200000
    }
  }
  ```
- **Response khi giỏ hàng trống**:
  ```json
  {
    "success": true,
    "message": "Lấy giỏ hàng thành công",
    "cart": {
      "items": [],
      "totalAmount": 0
    }
  }
  ```

#### `addItem(req, res)`
- **Mục đích**: Thêm sách vào giỏ hàng hoặc tăng số lượng nếu đã có
- **Input**:
  ```json
  {
    "bookId": "book_id_string",
    "quantity": 1  // Optional, mặc định = 1
  }
  ```
- **Logic**:
  - Nếu sách chưa có trong giỏ → thêm mới
  - Nếu sách đã có → cộng dồn số lượng
  - Kiểm tra tồn kho trước khi thêm
  - Cập nhật giá sách theo giá hiện tại
- **Response thành công (200)**:
  ```json
  {
    "success": true,
    "message": "Đã thêm sản phẩm vào giỏ",
    "cart": { /* cart object như trên */ }
  }
  ```
- **Lỗi có thể xảy ra**:
  - `BOOK_NOT_FOUND` (404): Sách không tồn tại
  - `OUT_OF_STOCK` (400): Số lượng vượt quá tồn kho
  - `INVALID_QUANTITY` (400): Số lượng không hợp lệ (< 1)

#### `updateItem(req, res)`
- **Mục đích**: Cập nhật số lượng của một sách trong giỏ hàng
- **Input**:
  ```json
  {
    "bookId": "book_id_string",
    "quantity": 3  // Required, phải >= 1
  }
  ```
- **Logic**:
  - Tìm item trong giỏ hàng
  - Kiểm tra tồn kho
  - Cập nhật số lượng và giá
- **Response thành công (200)**:
  ```json
  {
    "success": true,
    "message": "Đã cập nhật số lượng",
    "cart": { /* cart object */ }
  }
  ```
- **Lỗi có thể xảy ra**:
  - `CART_NOT_FOUND` (404): Giỏ hàng không tồn tại
  - `ITEM_NOT_FOUND` (404): Sách không có trong giỏ hàng
  - `OUT_OF_STOCK` (400): Số lượng vượt quá tồn kho
  - `INVALID_QUANTITY` (400): Số lượng không hợp lệ

#### `removeItem(req, res)`
- **Mục đích**: Xóa một sách khỏi giỏ hàng
- **Input**: `bookId` trong URL params (`/api/cart/remove/:bookId`)
- **Response thành công (200)**:
  ```json
  {
    "success": true,
    "message": "Đã xóa sản phẩm khỏi giỏ",
    "cart": { /* cart object sau khi xóa */ }
  }
  ```
- **Lỗi có thể xảy ra**:
  - `CART_NOT_FOUND` (404): Giỏ hàng không tồn tại
  - `ITEM_NOT_FOUND` (404): Sách không có trong giỏ hàng

---

## 5. Services

### 5.1 `services/cartService.js`

Service layer xử lý business logic và validation.

#### `getCartSummary(userId)`
- Lấy giỏ hàng của user, trả về summary với items đã populate
- Nếu không có giỏ hàng → trả về `{ items: [], totalAmount: 0 }`

#### `addItem(userId, bookId, quantity)`
- Validate quantity (phải >= 1)
- Kiểm tra book tồn tại
- Tạo giỏ hàng nếu chưa có
- Nếu item đã tồn tại → cộng dồn quantity
- Nếu item chưa có → thêm mới
- Kiểm tra stock trước khi lưu
- Trả về cart summary

#### `updateItemQuantity(userId, bookId, quantity)`
- Validate quantity
- Kiểm tra cart và item tồn tại
- Kiểm tra stock
- Cập nhật quantity và price
- Trả về cart summary

#### `removeItem(userId, bookId)`
- Kiểm tra cart tồn tại
- Xóa item khỏi array
- Trả về cart summary

#### `clearCart(userId)`
- Xóa toàn bộ giỏ hàng (dùng sau khi đặt hàng thành công)
- Trả về empty cart

**Error Handling:**
- Custom `CartError` class với các mã lỗi:
  - `BOOK_NOT_FOUND`
  - `CART_NOT_FOUND`
  - `ITEM_NOT_FOUND`
  - `OUT_OF_STOCK`
  - `INVALID_QUANTITY`

---

## 6. API Endpoints Chi Tiết

### 6.1 Base URL
```
/api/cart
```

### 6.2 Authentication
Tất cả endpoints yêu cầu header:
```
Authorization: Bearer <JWT_TOKEN>
```

### 6.3 Endpoints

#### GET `/api/cart`
Lấy giỏ hàng của user hiện tại.

**Request:**
```http
GET /api/cart
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response 200:**
```json
{
  "success": true,
  "message": "Lấy giỏ hàng thành công",
  "cart": {
    "id": "65a1b2c3d4e5f6g7h8i9j0k1",
    "user": "65a1b2c3d4e5f6g7h8i9j0k2",
    "items": [
      {
        "book": {
          "id": "65a1b2c3d4e5f6g7h8i9j0k3",
          "title": "Sách hay về lập trình",
          "author": "Tác giả A",
          "price": 150000,
          "coverImage": "/uploads/book1.jpg",
          "stock": 100
        },
        "quantity": 2,
        "price": 150000,
        "lineTotal": 300000
      },
      {
        "book": {
          "id": "65a1b2c3d4e5f6g7h8i9j0k4",
          "title": "Sách về AI",
          "author": "Tác giả B",
          "price": 200000,
          "coverImage": "/uploads/book2.jpg",
          "stock": 50
        },
        "quantity": 1,
        "price": 200000,
        "lineTotal": 200000
      }
    ],
    "totalAmount": 500000
  }
}
```

**Response khi giỏ hàng trống:**
```json
{
  "success": true,
  "message": "Lấy giỏ hàng thành công",
  "cart": {
    "items": [],
    "totalAmount": 0
  }
}
```

**Response 401 (Chưa đăng nhập):**
```json
{
  "error": "Thiếu token xác thực."
}
```

---

#### POST `/api/cart/add`
Thêm sách vào giỏ hàng.

**Request:**
```http
POST /api/cart/add
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "bookId": "65a1b2c3d4e5f6g7h8i9j0k3",
  "quantity": 1
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Đã thêm sản phẩm vào giỏ",
  "cart": {
    "id": "65a1b2c3d4e5f6g7h8i9j0k1",
    "items": [
      {
        "book": {
          "id": "65a1b2c3d4e5f6g7h8i9j0k3",
          "title": "Sách hay về lập trình",
          "author": "Tác giả A",
          "price": 150000,
          "coverImage": "/uploads/book1.jpg",
          "stock": 100
        },
        "quantity": 1,
        "price": 150000,
        "lineTotal": 150000
      }
    ],
    "totalAmount": 150000
  }
}
```

**Response 400 (Hết hàng):**
```json
{
  "error": "Số lượng vượt quá tồn kho hiện có.",
  "code": "OUT_OF_STOCK"
}
```

**Response 404 (Không tìm thấy sách):**
```json
{
  "error": "Sách không tồn tại.",
  "code": "BOOK_NOT_FOUND"
}
```

**Response 400 (Số lượng không hợp lệ):**
```json
{
  "error": "Số lượng phải lớn hơn 0.",
  "code": "INVALID_QUANTITY"
}
```

**Lưu ý:**
- Nếu sách đã có trong giỏ, số lượng sẽ được cộng dồn
- `quantity` là optional, mặc định = 1

---

#### POST `/api/cart/update`
Cập nhật số lượng sách trong giỏ hàng.

**Request:**
```http
POST /api/cart/update
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "bookId": "65a1b2c3d4e5f6g7h8i9j0k3",
  "quantity": 3
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Đã cập nhật số lượng",
  "cart": {
    "id": "65a1b2c3d4e5f6g7h8i9j0k1",
    "items": [
      {
        "book": {
          "id": "65a1b2c3d4e5f6g7h8i9j0k3",
          "title": "Sách hay về lập trình",
          "author": "Tác giả A",
          "price": 150000,
          "coverImage": "/uploads/book1.jpg",
          "stock": 100
        },
        "quantity": 3,
        "price": 150000,
        "lineTotal": 450000
      }
    ],
    "totalAmount": 450000
  }
}
```

**Response 404 (Sách không có trong giỏ):**
```json
{
  "error": "Sách không có trong giỏ hàng.",
  "code": "ITEM_NOT_FOUND"
}
```

**Response 404 (Giỏ hàng không tồn tại):**
```json
{
  "error": "Giỏ hàng không tồn tại.",
  "code": "CART_NOT_FOUND"
}
```

---

#### POST `/api/cart/remove/:bookId`
Xóa sách khỏi giỏ hàng.

**Request:**
```http
POST /api/cart/remove/65a1b2c3d4e5f6g7h8i9j0k3
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response 200:**
```json
{
  "success": true,
  "message": "Đã xóa sản phẩm khỏi giỏ",
  "cart": {
    "id": "65a1b2c3d4e5f6g7h8i9j0k1",
    "items": [],
    "totalAmount": 0
  }
}
```

**Response 404 (Sách không có trong giỏ):**
```json
{
  "error": "Sách không có trong giỏ hàng.",
  "code": "ITEM_NOT_FOUND"
}
```

---

## 7. Error Codes

| Code | HTTP Status | Mô tả |
|------|-------------|-------|
| `BOOK_NOT_FOUND` | 404 | Sách không tồn tại trong database |
| `CART_NOT_FOUND` | 404 | User chưa có giỏ hàng (chỉ xảy ra khi update/remove) |
| `ITEM_NOT_FOUND` | 404 | Sách không có trong giỏ hàng |
| `OUT_OF_STOCK` | 400 | Số lượng yêu cầu vượt quá tồn kho |
| `INVALID_QUANTITY` | 400 | Số lượng không hợp lệ (< 1) |

**Lỗi xác thực:**
- `401`: Thiếu token hoặc token không hợp lệ
- `403`: Tài khoản bị khóa (`isActive = false`)

**Lỗi server:**
- `500`: Lỗi server nội bộ

---

## 8. Ví dụ tích hợp Frontend

### 8.1 JavaScript/TypeScript

```javascript
const API_BASE_URL = 'http://localhost:3000/api/cart';
const token = localStorage.getItem('jwt_token'); // Lưu token sau khi login

// Lấy giỏ hàng
async function getCart() {
  const response = await fetch(`${API_BASE_URL}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Không thể lấy giỏ hàng');
  }
  
  const data = await response.json();
  return data.cart;
}

// Thêm sách vào giỏ
async function addToCart(bookId, quantity = 1) {
  const response = await fetch(`${API_BASE_URL}/add`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ bookId, quantity })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Không thể thêm vào giỏ hàng');
  }
  
  return data.cart;
}

// Cập nhật số lượng
async function updateCartItem(bookId, quantity) {
  const response = await fetch(`${API_BASE_URL}/update`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ bookId, quantity })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Không thể cập nhật giỏ hàng');
  }
  
  return data.cart;
}

// Xóa sách khỏi giỏ
async function removeFromCart(bookId) {
  const response = await fetch(`${API_BASE_URL}/remove/${bookId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Không thể xóa khỏi giỏ hàng');
  }
  
  return data.cart;
}

// Sử dụng
(async () => {
  try {
    // Lấy giỏ hàng
    const cart = await getCart();
    console.log('Giỏ hàng:', cart);
    
    // Thêm sách
    await addToCart('65a1b2c3d4e5f6g7h8i9j0k3', 2);
    
    // Cập nhật số lượng
    await updateCartItem('65a1b2c3d4e5f6g7h8i9j0k3', 5);
    
    // Xóa sách
    await removeFromCart('65a1b2c3d4e5f6g7h8i9j0k3');
  } catch (error) {
    console.error('Lỗi:', error.message);
  }
})();
```

### 8.2 React Hook Example

```jsx
import { useState, useEffect } from 'react';

function useCart() {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const token = localStorage.getItem('jwt_token');
  
  const fetchCart = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:3000/api/cart', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Lỗi khi lấy giỏ hàng');
      
      const data = await response.json();
      setCart(data.cart);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const addItem = async (bookId, quantity = 1) => {
    try {
      const response = await fetch('http://localhost:3000/api/cart/add', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bookId, quantity })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Lỗi khi thêm vào giỏ');
      }
      
      setCart(data.cart);
      return data.cart;
    } catch (err) {
      throw err;
    }
  };
  
  const updateItem = async (bookId, quantity) => {
    try {
      const response = await fetch('http://localhost:3000/api/cart/update', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bookId, quantity })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Lỗi khi cập nhật');
      }
      
      setCart(data.cart);
      return data.cart;
    } catch (err) {
      throw err;
    }
  };
  
  const removeItem = async (bookId) => {
    try {
      const response = await fetch(`http://localhost:3000/api/cart/remove/${bookId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Lỗi khi xóa');
      }
      
      setCart(data.cart);
      return data.cart;
    } catch (err) {
      throw err;
    }
  };
  
  useEffect(() => {
    if (token) {
      fetchCart();
    }
  }, [token]);
  
  return {
    cart,
    loading,
    error,
    addItem,
    updateItem,
    removeItem,
    refreshCart: fetchCart
  };
}

// Sử dụng trong component
function CartPage() {
  const { cart, loading, error, addItem, updateItem, removeItem } = useCart();
  
  if (loading) return <div>Đang tải...</div>;
  if (error) return <div>Lỗi: {error}</div>;
  if (!cart) return <div>Không có dữ liệu</div>;
  
  return (
    <div>
      <h2>Giỏ hàng của bạn</h2>
      <p>Tổng tiền: {cart.totalAmount.toLocaleString('vi-VN')} VNĐ</p>
      
      {cart.items.map((item) => (
        <div key={item.book.id}>
          <h3>{item.book.title}</h3>
          <p>Giá: {item.price.toLocaleString('vi-VN')} VNĐ</p>
          <p>Số lượng: {item.quantity}</p>
          <p>Thành tiền: {item.lineTotal.toLocaleString('vi-VN')} VNĐ</p>
          
          <button onClick={() => updateItem(item.book.id, item.quantity + 1)}>
            +
          </button>
          <button onClick={() => updateItem(item.book.id, item.quantity - 1)}>
            -
          </button>
          <button onClick={() => removeItem(item.book.id)}>
            Xóa
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## 9. Lưu ý quan trọng

1. **Authentication**: Tất cả API đều yêu cầu JWT token. Token được lấy từ header `Authorization: Bearer <token>`.

2. **Giá sách**: Giá được lưu tại thời điểm thêm vào giỏ. Nếu giá sách thay đổi sau đó, giá trong giỏ hàng vẫn giữ nguyên cho đến khi user cập nhật số lượng.

3. **Tồn kho**: Hệ thống kiểm tra `book.stock` trước khi cho phép thêm/cập nhật. Nếu `stock` là `null` hoặc `undefined`, không kiểm tra.

4. **Tự động tính tổng**: `totalAmount` được tính tự động khi save cart, không cần set thủ công.

5. **Giỏ hàng trống**: Nếu user chưa có giỏ hàng, API `getCart` trả về `{ items: [], totalAmount: 0 }` thay vì lỗi.

6. **Cộng dồn số lượng**: Khi thêm sách đã có trong giỏ, số lượng sẽ được cộng dồn thay vì tạo item mới.

---

## 10. Tích hợp với Order API

Sau khi user hoàn tất đặt hàng, nên gọi `clearCart(userId)` để xóa giỏ hàng. Xem thêm `BACKEND_ORDER_API_REQUIREMENTS.md` để biết cách tích hợp.

---

## 11. Testing

### 11.1 Test với cURL

```bash
# Lấy giỏ hàng
curl -X GET http://localhost:3000/api/cart \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Thêm sách
curl -X POST http://localhost:3000/api/cart/add \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bookId": "65a1b2c3d4e5f6g7h8i9j0k3", "quantity": 2}'

# Cập nhật số lượng
curl -X POST http://localhost:3000/api/cart/update \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bookId": "65a1b2c3d4e5f6g7h8i9j0k3", "quantity": 5}'

# Xóa sách
curl -X POST http://localhost:3000/api/cart/remove/65a1b2c3d4e5f6g7h8i9j0k3 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### 11.2 Test với Postman

1. Tạo collection mới
2. Set environment variable `token` = JWT token của bạn
3. Tạo các request với:
   - Method: GET/POST
   - URL: `http://localhost:3000/api/cart/...`
   - Headers:
     - `Authorization: Bearer {{token}}`
     - `Content-Type: application/json`
   - Body (cho POST): JSON với `bookId` và `quantity`

---

## 12. Troubleshooting

### Lỗi "Thiếu token xác thực"
- Kiểm tra header `Authorization` có đúng format: `Bearer <token>`
- Đảm bảo token chưa hết hạn

### Lỗi "Token không hợp lệ"
- Token có thể đã hết hạn (mặc định 7 ngày)
- Token không đúng secret key
- User đã bị xóa hoặc bị khóa

### Lỗi "Số lượng vượt quá tồn kho"
- Kiểm tra `book.stock` trong database
- Đảm bảo số lượng yêu cầu <= stock

### Giỏ hàng không cập nhật
- Kiểm tra response có `success: true`
- Kiểm tra `cart` object trong response
- Đảm bảo đang dùng đúng `userId`

---

**Tài liệu này được tạo dựa trên codebase hiện tại của BookStore Backend.**
**Cập nhật lần cuối: 2024**

