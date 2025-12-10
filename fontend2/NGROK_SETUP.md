# Hướng dẫn sử dụng Ngrok và các giải pháp thay thế

## 🚀 Giải pháp 1: Dùng IP Local (Khuyến nghị - Không cần ngrok)

Nếu bạn test trên **thiết bị thật trong cùng mạng Wi-Fi**, bạn không cần ngrok!

### Cách làm:
1. Đảm bảo điện thoại và máy tính cùng mạng Wi-Fi
2. Tìm IP máy tính của bạn:
   - Windows: `ipconfig` → tìm IPv4 Address
   - Ví dụ: `192.168.1.144`
3. Cập nhật `local.properties`:
   ```properties
   API_BASE_URL=http://192.168.1.144:3000/
   ```
4. Sync Gradle trong Android Studio
5. Xong! Không cần ngrok nữa.

**Lưu ý**: Nếu IP máy tính thay đổi, chỉ cần update lại trong `local.properties`.

---

## 🌐 Giải pháp 2: Ngrok với Script Tự động

Nếu bạn **bắt buộc phải dùng ngrok** (test từ xa), dùng script tự động:

### Cài đặt:
1. Cài đặt ngrok: https://ngrok.com/download
2. Đăng ký tài khoản miễn phí và lấy authtoken

### Sử dụng:

**Windows PowerShell:**
```powershell
# Start ngrok và tự động update URL
.\start-ngrok.ps1

# Hoặc chỉ định port khác
.\start-ngrok.ps1 3000

# Stop ngrok
.\stop-ngrok.ps1
```

**Windows CMD:**
```cmd
start-ngrok.bat
```

**Sau khi chạy script:**
1. Script sẽ tự động:
   - Start ngrok tunnel
   - Lấy public URL
   - Update `local.properties` với URL mới
2. **Sync Gradle** trong Android Studio (icon con voi)
3. Rebuild và chạy app

**Lưu ý**: Mỗi lần restart ngrok, URL sẽ thay đổi (trừ khi dùng paid plan). Script sẽ tự động update cho bạn.

---

## 💎 Giải pháp 3: Ngrok với Static Domain (Paid)

Nếu bạn có ngrok paid plan ($8/tháng):
1. Đăng ký static domain trên ngrok dashboard
2. Start ngrok với domain:
   ```bash
   ngrok http 3000 --domain=your-domain.ngrok-free.app
   ```
3. Set trong `local.properties`:
   ```properties
   API_BASE_URL=https://your-domain.ngrok-free.app/
   ```
4. URL sẽ không đổi nữa!

---

## 🔄 Giải pháp 4: Các dịch vụ thay thế

### LocalTunnel (Miễn phí, URL thay đổi)
```bash
npm install -g localtunnel
lt --port 3000
```

### Serveo (Miễn phí, có thể dùng subdomain tùy chỉnh)
```bash
ssh -R 80:localhost:3000 serveo.net
```

### Cloudflare Tunnel (Miễn phí, URL cố định)
```bash
cloudflared tunnel --url http://localhost:3000
```

---

## 📝 Cấu hình hiện tại

App của bạn đang sử dụng:
- **Fallback URL**: `http://192.168.1.144:3000/` (cho cùng mạng Wi-Fi)
- **Config file**: `local.properties` → `API_BASE_URL`
- **Build config**: Được đọc từ `local.properties` trong `build.gradle.kts`

---

## ⚡ Tips

1. **Test trên emulator**: Dùng `http://10.0.2.2:3000/` (không cần ngrok)
2. **Test trên thiết bị thật cùng Wi-Fi**: Dùng IP local (không cần ngrok)
3. **Test từ xa**: Dùng ngrok hoặc các dịch vụ tunnel khác
4. **Production**: Deploy backend lên server thật (Heroku, AWS, etc.)

---

## 🐛 Troubleshooting

**Ngrok không start được:**
- Kiểm tra đã cài đặt ngrok chưa: `ngrok version`
- Kiểm tra authtoken: `ngrok config check`

**URL không update:**
- Đảm bảo đã sync Gradle sau khi update `local.properties`
- Clean và rebuild project

**Kết nối bị lỗi:**
- Kiểm tra backend đang chạy trên port đúng chưa
- Kiểm tra firewall không chặn port
- Kiểm tra URL trong logcat của app


