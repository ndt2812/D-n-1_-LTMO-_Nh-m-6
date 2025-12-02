// Import các thư viện cần thiết

const crypto = require("crypto"); // Thư viện Node.js để tạo hash và chữ ký HMAC-SHA512

const axios = require("axios"); // Thư viện HTTP client để gọi API VNPay

const { URLSearchParams } = require("url"); // Utility để xử lý query string

const dotenv = require("dotenv").config(); // Load biến môi trường từ file .env

const moment = require("moment"); // Thư viện xử lý ngày tháng



// Class chính để xử lý tích hợp VNPay

class VNPayService {

  // Hàm khởi tạo - Load cấu hình từ biến môi trường

  constructor() {

    // VNPay API configuration - sẽ lấy từ .env

    // Terminal ID / Mã Website - Mã định danh merchant do VNPay cấp

    // Hỗ trợ cả VNP_TMN_CODE và VNPAY_TMN_CODE

    this.tmnCode = process.env.VNPAY_TMN_CODE || process.env.VNP_TMN_CODE || "";

    

    // Secret Key / Chuỗi bí mật - Dùng để tạo chữ ký (signature) cho các request

    // Hỗ trợ cả VNP_HASH_SECRET và VNPAY_HASH_SECRET

    this.hashSecret = process.env.VNPAY_HASH_SECRET || process.env.VNP_HASH_SECRET || "";

    

    // Log để debug (chỉ trong development)

    if (process.env.NODE_ENV !== 'production') {

      console.log("🔧 VNPay Service initialized:");

      console.log("  - tmnCode:", this.tmnCode || "(empty/null)");

      console.log("  - hashSecret:", this.hashSecret ? (this.hashSecret.substring(0, 10) + "..." + this.hashSecret.substring(this.hashSecret.length - 5)) : "(empty/null)");

      console.log("  - hashSecret length:", this.hashSecret ? this.hashSecret.length : 0);

      console.log("  - VNPAY_TMN_CODE:", process.env.VNPAY_TMN_CODE || "(not set)");

      console.log("  - VNP_TMN_CODE:", process.env.VNP_TMN_CODE || "(not set)");

      console.log("  - VNPAY_HASH_SECRET:", process.env.VNPAY_HASH_SECRET ? "***set***" : "(not set)");

      console.log("  - VNP_HASH_SECRET:", process.env.VNP_HASH_SECRET ? "***set***" : "(not set)");

      

      // Log full credentials để verify (chỉ khi DEBUG_VNPAY_SECRET=true)

      if (process.env.DEBUG_VNPAY_SECRET === 'true') {

        console.log("");

        console.log("═══════════════════════════════════════════════════════════");

        console.log("🔐 VNPay FULL CREDENTIALS (loaded from .env):");

        console.log("   Terminal ID (tmnCode):", this.tmnCode);

        console.log("   Secret Key (hashSecret):", this.hashSecret);

        console.log("═══════════════════════════════════════════════════════════");

        console.log("");

        console.log("📧 LƯU Ý: Nếu bạn có nhiều email với Terminal ID = 2MZKH7A5:");

        console.log("   → Hãy dùng Secret Key từ email MỚI NHẤT");

        console.log("   → Hoặc test từng Secret Key để tìm cái đúng");

        console.log("");

      }

    }

    

    // Endpoint URL thanh toán - URL của VNPay để redirect khách hàng đến trang thanh toán

    this.endpoint = process.env.VNPAY_ENDPOINT || process.env.VNP_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";

    

    // IPN URL - URL mà VNPay sẽ gọi lại (callback) khi có thay đổi trạng thái thanh toán

    this.ipnUrl = process.env.VNPAY_IPN_URL || "http://localhost:3000/api/payment/vnpay/callback";

    

    // Return URL - URL mà VNPay sẽ redirect khách hàng về sau khi thanh toán xong

    // Hỗ trợ cả /api/payment/vnpay/return và /coins/vnpay-return

    this.returnUrl = process.env.VNPAY_RETURN_URL || process.env.VNP_RETURN_URL || "http://localhost:3000/api/payment/vnpay/return";

    

    // Môi trường: sandbox (test) hoặc production (thật)

    this.env = process.env.VNPAY_ENV || process.env.VNP_ENV || "sandbox"; // sandbox hoặc production

  }



  /**

   * Tạo vnp_CreateDate đúng format VNPay: yyyyMMddHHmmss (14 ký tự)

   * Sử dụng Local Time (GMT+7) theo yêu cầu VNPay, không dùng UTC

   * @returns {String} Ngày giờ theo format yyyyMMddHHmmss (ví dụ: 20251128224405)

   */

  generateCreateDate() {

    // Lấy thời gian hiện tại của máy (Local Time, không phải UTC)

    const now = new Date();

    

    // Sử dụng Local Time (GMT+7) - VNPay yêu cầu local time, không phải UTC

    // Lấy năm (4 chữ số, ví dụ: 2025)

    const year = now.getFullYear();

    

    // Lấy tháng (1-12), padStart(2, "0") để đảm bảo luôn có 2 chữ số (01-12)

    const month = String(now.getMonth() + 1).padStart(2, "0");

    

    // Lấy ngày (1-31), padStart(2, "0") để đảm bảo luôn có 2 chữ số (01-31)

    const day = String(now.getDate()).padStart(2, "0");

    

    // Lấy giờ (0-23), padStart(2, "0") để đảm bảo luôn có 2 chữ số (00-23)

    const hours = String(now.getHours()).padStart(2, "0");

    

    // Lấy phút (0-59), padStart(2, "0") để đảm bảo luôn có 2 chữ số (00-59)

    const minutes = String(now.getMinutes()).padStart(2, "0");



// Lấy giây (0-59), padStart(2, "0") để đảm bảo luôn có 2 chữ số (00-59)

    const seconds = String(now.getSeconds()).padStart(2, "0");

    

    // Ghép lại thành chuỗi 14 ký tự: yyyyMMddHHmmss

    return `${year}${month}${day}${hours}${minutes}${seconds}`;

  }



  /**

   * Extract IP address thật từ IPv6-mapped IPv4 hoặc các format khác

   * VNPay yêu cầu IP address của khách hàng để xác thực giao dịch

   * @param {String} ip - IP address có thể có format: "::ffff:172.20.10.4" hoặc "172.20.10.4"

   * @returns {String} IP address IPv4 thuần túy (ví dụ: "192.168.1.1")

   */

  extractIpAddress(ip) {

    // Kiểm tra nếu không có IP được truyền vào

    if (!ip) {

      console.warn("⚠️ No IP address provided, using default: 192.168.1.1");

      // Dùng IP mặc định hợp lệ thay vì localhost (127.0.0.1) vì VNPay có thể không chấp nhận localhost

      return "192.168.1.1";

    }

    

    // Loại bỏ IPv6 prefix "::ffff:" - Đây là format IPv6-mapped IPv4

    // Khi server chạy trên IPv6 nhưng client dùng IPv4, IP sẽ có dạng "::ffff:172.20.10.4"

    if (ip.includes("::ffff:")) {

      ip = ip.replace("::ffff:", "");

    }

    

    // Loại bỏ IPv6 brackets - IPv6 thường được đặt trong dấu ngoặc vuông [::1]

    ip = ip.replace(/^\[|\]$/g, "");

    

    // Xử lý IPv6 localhost (::1) và localhost - chuyển trực tiếp sang IP mặc định hợp lệ

    // VNPay có thể không chấp nhận localhost IP (127.0.0.1, ::1) trong môi trường production

    if (ip === "::1" || ip === "127.0.0.1" || ip === "localhost") {

      console.warn("⚠️ Localhost IP detected (" + ip + "), using default: 192.168.1.1");

      return "192.168.1.1";

    }

    

    // Validate IPv4 format - Kiểm tra xem IP có đúng format IPv4 không (ví dụ: 192.168.1.1)

    // Regex: ^(\d{1,3}\.){3}\d{1,3}$ - 4 nhóm số, mỗi nhóm 1-3 chữ số, cách nhau bởi dấu chấm

    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;

    if (ipv4Regex.test(ip)) {

      // Trả về IP hợp lệ

      return ip;

    }

    

    // Nếu không phải IPv4 hợp lệ, trả về default

    console.warn("⚠️ Invalid IP address format, using default:", ip);

    // Dùng IP mặc định hợp lệ thay vì localhost

    return "192.168.1.1";

  }



  /**

   * Clean và encode vnp_OrderInfo

   * VNPay yêu cầu: tối đa 255 ký tự, loại bỏ ký tự đặc biệt

   * Lưu ý: VNPay có thể không chấp nhận dấu tiếng Việt, nên chuyển sang không dấu

   * @param {String} orderInfo - Thông tin đơn hàng gốc (có thể có dấu tiếng Việt)

   * @returns {String} Thông tin đơn hàng đã được làm sạch (không dấu, không ký tự đặc biệt)

   */

  sanitizeOrderInfo(orderInfo) {

    // Nếu không có thông tin đơn hàng, trả về mặc định

    if (!orderInfo) return "Thanh toan don hang";



// Hàm helper để chuyển tiếng Việt có dấu sang không dấu

    // QUAN TRỌNG: Phải chuyển dấu TRƯỚC khi loại bỏ ký tự đặc biệt

    // Nếu loại bỏ ký tự đặc biệt trước, các ký tự có dấu sẽ bị xóa mất

    const removeVietnameseAccents = (str) => {

      // Mapping từng ký tự có dấu sang không dấu

      const accents = {

        'à': 'a', 'á': 'a', 'ạ': 'a', 'ả': 'a', 'ã': 'a',

        'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ậ': 'a', 'ẩ': 'a', 'ẫ': 'a',

        'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ặ': 'a', 'ẳ': 'a', 'ẵ': 'a',

        'è': 'e', 'é': 'e', 'ẹ': 'e', 'ẻ': 'e', 'ẽ': 'e',

        'ê': 'e', 'ề': 'e', 'ế': 'e', 'ệ': 'e', 'ể': 'e', 'ễ': 'e',

        'ì': 'i', 'í': 'i', 'ị': 'i', 'ỉ': 'i', 'ĩ': 'i',

        'ò': 'o', 'ó': 'o', 'ọ': 'o', 'ỏ': 'o', 'õ': 'o',

        'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ộ': 'o', 'ổ': 'o', 'ỗ': 'o',

        'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ợ': 'o', 'ở': 'o', 'ỡ': 'o',

        'ù': 'u', 'ú': 'u', 'ụ': 'u', 'ủ': 'u', 'ũ': 'u',

        'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ự': 'u', 'ử': 'u', 'ữ': 'u',

        'ỳ': 'y', 'ý': 'y', 'ỵ': 'y', 'ỷ': 'y', 'ỹ': 'y',

        'đ': 'd',

        'À': 'A', 'Á': 'A', 'Ạ': 'A', 'Ả': 'A', 'Ã': 'A',

        'Â': 'A', 'Ầ': 'A', 'Ấ': 'A', 'Ậ': 'A', 'Ẩ': 'A', 'Ẫ': 'A',

        'Ă': 'A', 'Ằ': 'A', 'Ắ': 'A', 'Ặ': 'A', 'Ẳ': 'A', 'Ẵ': 'A',

        'È': 'E', 'É': 'E', 'Ẹ': 'E', 'Ẻ': 'E', 'Ẽ': 'E',

        'Ê': 'E', 'Ề': 'E', 'Ế': 'E', 'Ệ': 'E', 'Ể': 'E', 'Ễ': 'E',

        'Ì': 'I', 'Í': 'I', 'Ị': 'I', 'Ỉ': 'I', 'Ĩ': 'I',

        'Ò': 'O', 'Ó': 'O', 'Ọ': 'O', 'Ỏ': 'O', 'Õ': 'O',

        'Ô': 'O', 'Ồ': 'O', 'Ố': 'O', 'Ộ': 'O', 'Ổ': 'O', 'Ỗ': 'O',

        'Ơ': 'O', 'Ờ': 'O', 'Ớ': 'O', 'Ợ': 'O', 'Ở': 'O', 'Ỡ': 'O',

        'Ù': 'U', 'Ú': 'U', 'Ụ': 'U', 'Ủ': 'U', 'Ũ': 'U',

        'Ư': 'U', 'Ừ': 'U', 'Ứ': 'U', 'Ự': 'U', 'Ử': 'U', 'Ữ': 'U',

        'Ỳ': 'Y', 'Ý': 'Y', 'Ỵ': 'Y', 'Ỷ': 'Y', 'Ỹ': 'Y',

        'Đ': 'D'

      };

      // Thay thế tất cả ký tự có dấu bằng ký tự không dấu tương ứng

      return str.replace(/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/g, (char) => accents[char] || char);

    };

    

    // BƯỚC 1: Chuyển tiếng Việt có dấu sang không dấu TRƯỚC

    // Ví dụ: "Thanh toán đơn hàng" → "Thanh toan don hang"

    let cleaned = removeVietnameseAccents(orderInfo);

    

    // BƯỚC 2: Loại bỏ ký tự đặc biệt, chỉ giữ chữ, số, khoảng trắng

    // [^\w\s] = không phải chữ cái, số, hoặc khoảng trắng

    // Ví dụ: "Thanh toan don hang!" → "Thanh toan don hang"

    cleaned = cleaned

      .replace(/[^\w\s]/g, "") // Loại bỏ ký tự đặc biệt (sau khi đã chuyển dấu)



.trim(); // Loại bỏ khoảng trắng ở đầu và cuối

    

    // BƯỚC 3: Loại bỏ khoảng trắng thừa (nhiều khoảng trắng liên tiếp → 1 khoảng trắng)

    // Ví dụ: "Thanh  toan   don  hang" → "Thanh toan don hang"

    cleaned = cleaned.replace(/\s+/g, " ").trim();

    

    // BƯỚC 4: Giới hạn 255 ký tự (VNPay yêu cầu tối đa 255 ký tự)

    // Nếu dài hơn 255 ký tự, cắt bớt phần cuối

    cleaned = cleaned.substring(0, 255);

    

    // Trả về chuỗi đã làm sạch, hoặc mặc định nếu rỗng

    return cleaned || "Thanh toan don hang";

  }



  /**

   * Tạo URL thanh toán VNPay

   * Hàm này tạo URL để redirect khách hàng đến trang thanh toán VNPay

   * @param {Object} params - Các tham số thanh toán (vnp_Amount, vnp_IpAddr, vnp_TxnRef, vnp_OrderInfo)

   * @returns {Object} { success: boolean, paymentUrl: string } hoặc { success: false, message: string }

   */

  createPaymentUrl(params) {

    try {

        // Validate required parameters

        if (!params || !params.vnp_Amount) {

          throw new Error("Thiếu tham số vnp_Amount (số tiền thanh toán)");

        }

        

        // Validate configuration - Kiểm tra kỹ hơn

        if (!this.tmnCode || this.tmnCode === 'null' || this.tmnCode.trim() === '') {

          console.error("❌ VNPay TMN_CODE is null or empty:", this.tmnCode);

          throw new Error("VNPay chưa được cấu hình đúng. Vui lòng kiểm tra VNP_TMN_CODE hoặc VNPAY_TMN_CODE trong file .env");

        }

        

        if (!this.hashSecret || this.hashSecret === 'null' || this.hashSecret.trim() === '') {

          console.error("❌ VNPay HASH_SECRET is null or empty:", this.hashSecret);

          throw new Error("VNPay chưa được cấu hình đúng. Vui lòng kiểm tra VNP_HASH_SECRET hoặc VNPAY_HASH_SECRET trong file .env");

        }

        

        // Trim secret key để loại bỏ khoảng trắng thừa (nếu có)

        const trimmedSecretKey = String(this.hashSecret).trim();

        

        if (!trimmedSecretKey) {

          throw new Error("VNPay HASH_SECRET không hợp lệ (rỗng sau khi trim)");

        }

        

        // Lấy IP address của khách hàng từ params và extract đúng format

        var ipAddr = this.extractIpAddress(params.vnp_IpAddr);

        

        // Lấy Terminal ID (Mã Website) từ instance property

        var tmnCode = String(this.tmnCode).trim();

        

        // Lấy Secret Key (Chuỗi bí mật) từ instance property - Dùng để tạo chữ ký

        // Trim để loại bỏ khoảng trắng thừa

        var secretKey = trimmedSecretKey;

        

        // URL endpoint của VNPay (sandbox hoặc production)

        var vnpUrl = this.endpoint;

        

        // URL mà VNPay sẽ redirect khách hàng về sau khi thanh toán xong

        var returnUrl = params.vnp_ReturnUrl || this.returnUrl;

    

        // Tạo ngày giờ theo format yyyyMMddHHmmss (14 ký tự) - Thời gian tạo giao dịch

        var createDate = this.generateCreateDate();

        

        // Lấy mã đơn hàng từ params hoặc tạo mới

        // Nếu có vnp_TxnRef trong params, dùng nó; nếu không, tạo mới

        var orderId = params.vnp_TxnRef || this.generateTxnRef(Date.now());

        

        // Lấy số tiền từ params (đơn vị: VND)

        // Lưu ý: amount đã là VND, sẽ nhân 100 để chuyển sang xu (VNPay yêu cầu)

        var amount = params.vnp_Amount;

        

        // Mã ngân hàng (nếu có) - null nếu để khách hàng tự chọn

        var bankCode = params.vnp_BankCode || null;

        

        // Thông tin đơn hàng - Lấy từ params hoặc dùng mặc định

        var orderInfo = params.vnp_OrderInfo ? this.sanitizeOrderInfo(params.vnp_OrderInfo) : 'Thanh_toan_don_hang';

        

        // Loại đơn hàng - Lấy từ params hoặc dùng mặc định

        var orderType = params.vnp_OrderType || 'other';

        

        // Ngôn ngữ hiển thị - Lấy từ params hoặc dùng mặc định "vn" (tiếng Việt)

        var locale = params.vnp_Locale || 'vn';

        

        // Mã tiền tệ - "VND" là Việt Nam Đồng

        var currCode = params.vnp_CurrCode || 'VND';

        

        // Khởi tạo object chứa tất cả các tham số gửi đến VNPay

        var vnp_Params = {};

// Phiên bản API VNPay - Hiện tại là 2.1.0

        vnp_Params['vnp_Version'] = '2.1.0';

        

        // Lệnh thanh toán - "pay" là thanh toán

        vnp_Params['vnp_Command'] = 'pay';

        

        // Terminal ID / Mã Website - Mã định danh merchant

        vnp_Params['vnp_TmnCode'] = tmnCode;

        

        // vnp_Params['vnp_Merchant'] = '' // Không dùng trong API 2.1.0

        

        // Ngôn ngữ hiển thị

        vnp_Params['vnp_Locale'] = locale;

        

        // Mã tiền tệ

        vnp_Params['vnp_CurrCode'] = currCode;

        

        // Mã đơn hàng (Transaction Reference) - Dùng để tra cứu giao dịch

        vnp_Params['vnp_TxnRef'] = orderId;

        

        // Thông tin đơn hàng

        vnp_Params['vnp_OrderInfo'] = orderInfo;

        

        // Loại đơn hàng

        vnp_Params['vnp_OrderType'] = orderType;

        

        // Số tiền thanh toán (đơn vị: xu) - VNPay yêu cầu số tiền phải nhân 100

        // Ví dụ: 100,000 VND → 10,000,000 xu

        vnp_Params['vnp_Amount'] = amount * 100;

        

        // URL redirect về sau khi thanh toán

        vnp_Params['vnp_ReturnUrl'] = returnUrl;

        

        // IP address của khách hàng

        vnp_Params['vnp_IpAddr'] = ipAddr;

        

        // Thời gian tạo giao dịch

        vnp_Params['vnp_CreateDate'] = createDate;

        

        // Nếu có mã ngân hàng, thêm vào params

        if(bankCode !== null && bankCode !== ''){

            vnp_Params['vnp_BankCode'] = bankCode;

        }

    

        // Loại bỏ các params null, undefined, hoặc empty string trước khi tạo signature

        // VNPay không chấp nhận các params này trong signature

        const cleanedParams = {};

        Object.keys(vnp_Params).forEach(key => {

          const value = vnp_Params[key];

          // Chỉ thêm params có giá trị hợp lệ (không null, undefined, hoặc empty string)

          if (value !== null && value !== undefined && value !== '') {

            cleanedParams[key] = String(value).trim(); // Convert to string và trim khoảng trắng

          }

        });

        

        // Sắp xếp các params theo thứ tự alphabet (theo key)

        // QUAN TRỌNG: VNPay yêu cầu params phải được sắp xếp trước khi tạo chữ ký

        const sortedParams = this.sortObject(cleanedParams);

        

        // Tạo query string từ params đã sắp xếp để tạo chữ ký

        // QUAN TRỌNG: VNPay yêu cầu encode các values trong querystring cho signature

        // VNPay yêu cầu dùng encodeURIComponent cho từng value (KHÔNG encode keys)

        // VNPay yêu cầu: thay thế %20 (space) bằng dấu + trong signData

        // Tạo querystring thủ công với encodeURIComponent cho values

        let signData = Object.keys(sortedParams)

          .sort() // Sort lại để đảm bảo thứ tự đúng

          .map(key => {

            const value = sortedParams[key];

            // QUAN TRỌNG: CHỈ ENCODE value, KHÔNG encode key

            // encodeURIComponent sẽ encode các ký tự đặc biệt (space → %20, : → %3A, ...)

            const encodedValue = encodeURIComponent(String(value));

            return `${key}=${encodedValue}`;

          })

          .join("&"); // Nối các cặp key=value bằng dấu &

        // QUAN TRỌNG: VNPay yêu cầu thay thế %20 (space) bằng dấu + trong signData

        // Đây là yêu cầu đặc biệt của VNPay theo documentation

        signData = signData.replace(/%20/g, '+');

        

        // Log signData và secret key (một phần) để debug (chỉ trong môi trường development)

        if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_VNPAY_SECRET === 'true') {

          console.log("🔐 VNPay create payment - signData:", signData);

          console.log("🔐 VNPay create payment - secretKey (first 10 + last 5 chars):", secretKey.substring(0, 10) + "..." + secretKey.substring(secretKey.length - 5));

          console.log("🔐 VNPay create payment - secretKey length:", secretKey.length);

          console.log("🔐 VNPay create payment - tmnCode:", tmnCode);

          // Log full secret key và tmnCode nếu DEBUG_VNPAY_SECRET=true (để kiểm tra chính xác)

          if (process.env.DEBUG_VNPAY_SECRET === 'true') {

            console.log("");

            console.log("═══════════════════════════════════════════════════════════");

            console.log("🔐 VNPay FULL CREDENTIALS (for verification):");

            console.log("   Terminal ID (tmnCode):", tmnCode);

            console.log("   Secret Key (hashSecret):", secretKey);

            console.log("═══════════════════════════════════════════════════════════");

            console.log("");

            console.log("📧 QUAN TRỌNG: Nếu bạn có nhiều email với Terminal ID = 2MZKH7A5:");

            console.log("   1. Hãy dùng Secret Key từ email MỚI NHẤT (kiểm tra ngày gửi)");

            console.log("   2. Hoặc test từng Secret Key một để tìm cái đúng");

            console.log("   3. Terminal ID và Secret Key phải từ CÙNG MỘT EMAIL");

            console.log("");

            console.log("💡 Gợi ý: Email mới nhất thường là đúng nhất");

          }

        }

        

        // Import thư viện crypto để tạo hash

        var crypto = require("crypto");     

        

        // Tạo HMAC-SHA512 hash từ signData và secretKey

        // HMAC-SHA512 là thuật toán mã hóa một chiều, dùng để tạo chữ ký

        var hmac = crypto.createHmac("sha512", secretKey);

        

        // Cập nhật hash với signData và lấy kết quả dạng hex

        // QUAN TRỌNG: VNPay có thể yêu cầu dùng string trực tiếp (không dùng Buffer.from)

        // Thử cả 2 cách để xem cách nào đúng

        var signed = hmac.update(signData, 'utf-8').digest("hex");
        
        // Log signature để debug (chỉ trong môi trường development)
    if (process.env.NODE_ENV !== 'production') {
          console.log("🔐 VNPay create payment - signature:", signed.substring(0, 20) + "...");
        } 

        

        // Thêm chữ ký vào params (dùng sortedParams đã cleaned, không dùng vnp_Params gốc)

        sortedParams['vnp_SecureHash'] = signed;

        // VNPay yêu cầu thêm vnp_SecureHashType (SHA512)

        sortedParams['vnp_SecureHashType'] = 'SHA512';

        

        // Tạo URL thanh toán cuối cùng bằng cách thêm query string vào endpoint

        // Tất cả params (bao gồm cả vnp_SecureHash) đều được encode khi tạo URL

        // Dùng qs.stringify với encode: true để tạo URL query string

        // Dùng sortedParams đã cleaned và có signature

        const querystring = require('qs');

        vnpUrl += '?' + querystring.stringify(sortedParams, { encode: true });

        

        // Trả về URL thanh toán

       return {

        success: true,

        paymentUrl: vnpUrl,

      };

    } catch (error) {

      // Xử lý lỗi nếu có

      console.error("❌ VNPay create payment URL error:", error);

      return {

        success: false,

        message: error.message || "Lỗi tạo URL thanh toán VNPay",

      };

    }

  }



  /**

   * Xác thực callback từ VNPay

   * Hàm này verify chữ ký từ VNPay callback để đảm bảo request đến từ VNPay thật

   * @param {Object} queryParams - Query parameters từ VNPay callback (GET hoặc POST)

   * @returns {Boolean} true nếu chữ ký hợp lệ, false nếu không hợp lệ

   */

  verifyCallback(queryParams) {

    try {

      // Lấy chữ ký từ query params - VNPay sẽ gửi kèm chữ ký trong callback

      const vnp_SecureHash = queryParams["vnp_SecureHash"];

      

      // Nếu không có chữ ký, không thể verify → trả về false

      if (!vnp_SecureHash) {

        console.error("❌ VNPay verify callback: Missing vnp_SecureHash");

        return false;

      }



      // Loại bỏ vnp_SecureHash và vnp_SecureHashType khỏi params để verify

      // Chỉ verify các params khác, không verify chính chữ ký

      const paramsForVerify = { ...queryParams };

      delete paramsForVerify["vnp_SecureHash"]; // Loại bỏ chữ ký

      delete paramsForVerify["vnp_SecureHashType"]; // Loại bỏ loại hash (nếu có)



      // Sắp xếp params theo thứ tự alphabet (theo key)

      // QUAN TRỌNG: Phải sắp xếp giống như khi tạo chữ ký ban đầu

      const sortedParams = this.sortObject(paramsForVerify);

      

      // Tạo query string cho signature - PHẢI ENCODE (encode: true)

      // QUAN TRỌNG: VNPay yêu cầu encode các values trong querystring cho signature

      // Các giá trị phải được encode giống như khi tạo chữ ký ban đầu

      // Dùng encodeURIComponent cho từng value để khớp với createPaymentUrl

      let querystringForVerify = Object.keys(sortedParams)

        .sort() // Sort lại để đảm bảo thứ tự đúng

        .map(key => {

          const value = sortedParams[key];

          // QUAN TRỌNG: CHỈ ENCODE value, KHÔNG encode key

          const encodedValue = encodeURIComponent(String(value));

          return `${key}=${encodedValue}`;

        })

        .join("&"); // Nối các cặp key=value bằng dấu &

      // QUAN TRỌNG: VNPay yêu cầu thay thế %20 (space) bằng dấu + trong signData

      // Đây là yêu cầu đặc biệt của VNPay theo documentation

      querystringForVerify = querystringForVerify.replace(/%20/g, '+');

      

      console.log("🔐 VNPay verify callback querystring (ENCODED - encode: true):", querystringForVerify);



      // Tạo hash để so sánh với chữ ký từ VNPay

      // Sử dụng cùng thuật toán HMAC-SHA512 và cùng secretKey như khi tạo chữ ký

      const calculatedHash = crypto



.createHmac("sha512", this.hashSecret) // Tạo HMAC với secretKey

        .update(querystringForVerify) // Cập nhật với querystring đã encode

        .digest("hex"); // Lấy kết quả dạng hex string



      // So sánh chữ ký tính được với chữ ký từ VNPay

      // Nếu giống nhau → request hợp lệ, đến từ VNPay

      // Nếu khác nhau → request không hợp lệ, có thể bị giả mạo

      const isValid = calculatedHash === vnp_SecureHash;

      

      // Log kết quả verify

      if (!isValid) {

        console.error("❌ VNPay verify callback: Signature mismatch", {

          calculated: calculatedHash.substring(0, 20) + "...", // Chỉ log 20 ký tự đầu để debug

          received: vnp_SecureHash.substring(0, 20) + "..."

        });

      } else {

        console.log("✅ VNPay verify callback: Signature valid");

      }



      return isValid;

    } catch (error) {

      // Xử lý lỗi nếu có (ví dụ: thiếu hashSecret, lỗi crypto, ...)

      console.error("❌ VNPay verify callback error:", error);

      return false;

    }

  }



  /**

   * Query thông tin đơn hàng từ VNPay

   * Hàm này gọi API VNPay để tra cứu thông tin giao dịch (trạng thái, số tiền, ...)

   * @param {String} vnp_TxnRef - Mã đơn hàng (Transaction Reference) cần tra cứu

   * @returns {Promise<Object>} { success: boolean, data: {...} } hoặc { success: false, error: string }

   */

  async queryOrder(vnp_TxnRef) {

    try {

      // Tạo Request ID duy nhất cho request này

      // Format: vnp_TxnRef_timestamp (ví dụ: "ORD123_1699123456789")

      const vnp_RequestId = `${vnp_TxnRef}_${Date.now()}`;

      

      // Phiên bản API VNPay

      const vnp_Version = "2.1.0";

      

      // Lệnh query - "querydr" là query transaction

      const vnp_Command = "querydr";

      

      // Sử dụng generateCreateDate() để đảm bảo format đúng (yyyyMMddHHmmss)

      const vnp_CreateDate = this.generateCreateDate();



      // Khởi tạo object chứa các tham số gửi đến VNPay

      const vnp_Params = {};

      vnp_Params["vnp_RequestId"] = vnp_RequestId; // ID của request này

      vnp_Params["vnp_Version"] = vnp_Version; // Phiên bản API

      vnp_Params["vnp_Command"] = vnp_Command; // Lệnh query

      vnp_Params["vnp_TmnCode"] = this.tmnCode; // Terminal ID

      vnp_Params["vnp_TxnRef"] = vnp_TxnRef; // Mã đơn hàng cần tra cứu

      vnp_Params["vnp_CreateDate"] = vnp_CreateDate; // Thời gian tạo request



      // Sắp xếp params theo thứ tự alphabet (theo key)

      // QUAN TRỌNG: VNPay yêu cầu params phải được sắp xếp trước khi tạo chữ ký

      const sortedParams = this.sortObject(vnp_Params);

      

      // Tạo query string từ params đã sắp xếp

      // URLSearchParams tự động encode các giá trị



const querystring = new URLSearchParams(sortedParams).toString();



      // Tạo vnp_SecureHash (chữ ký) để xác thực request

      // Sử dụng HMAC-SHA512 với secretKey

      const vnp_SecureHash = crypto

        .createHmac("sha512", this.hashSecret) // Tạo HMAC với secretKey

        .update(querystring) // Cập nhật với querystring

        .digest("hex"); // Lấy kết quả dạng hex string



      // Thêm chữ ký vào params

      sortedParams["vnp_SecureHash"] = vnp_SecureHash;



      // Xác định URL API query của VNPay

      // Production: https://www.vnpayment.vn/merchant_webapi/merchant.html

      // Sandbox (test): https://sandbox.vnpayment.vn/merchant_webapi/merchant.html

      const queryUrl = this.env === "production"

        ? "https://www.vnpayment.vn/merchant_webapi/merchant.html"

        : "https://sandbox.vnpayment.vn/merchant_webapi/merchant.html";



      // VNPay query sử dụng form POST với Content-Type: application/x-www-form-urlencoded

      // Chuyển params thành form data string

      const formData = new URLSearchParams(sortedParams).toString();



      // Gọi API VNPay bằng POST request

      const response = await axios.post(queryUrl, formData, {

        headers: {

          "Content-Type": "application/x-www-form-urlencoded", // Header bắt buộc cho form POST

        },

      });



      // Lấy response data

      const responseText = response.data;

      

      // Parse response (VNPay trả về HTML hoặc JSON tùy endpoint)

      // Thường là HTML với form, cần parse để lấy thông tin

      // Hoặc có thể sử dụng API JSON nếu có

      // TODO: Có thể cần parse HTML để lấy thông tin giao dịch



      // Trả về kết quả

    return {

        success: true,

        data: {

          vnp_TxnRef: vnp_TxnRef, // Mã đơn hàng đã tra cứu

          response: responseText, // Response từ VNPay (HTML hoặc JSON)

        },

      };

    } catch (error) {

      // Xử lý lỗi nếu có (network error, API error, ...)

      console.error("VNPay query order error:", error);

      return {

        success: false,

        error: error.message, // Thông báo lỗi

      };

    }

  }



  /**

   * Sắp xếp object theo thứ tự alphabet (theo key)

   * VNPay yêu cầu các params phải được sắp xếp theo thứ tự alphabet trước khi tạo chữ ký

   * @param {Object} obj - Object cần sắp xếp (ví dụ: { vnp_Amount: 100, vnp_Command: "pay" })

   * @returns {Object} Object đã sắp xếp theo key alphabet (ví dụ: { vnp_Command: "pay", vnp_Amount: 100 })

   */

  sortObject(obj) {

    // Khởi tạo object rỗng để chứa kết quả đã sắp xếp

    const sorted = {};

    

    // Lấy tất cả keys của object và sắp xếp theo thứ tự alphabet

    // Ví dụ: ["vnp_Amount", "vnp_Command"] → ["vnp_Command", "vnp_Amount"]



const keys = Object.keys(obj).sort();

    

    // Duyệt qua từng key đã sắp xếp và copy giá trị vào object mới

    keys.forEach((key) => {

      sorted[key] = obj[key]; // Copy giá trị từ object cũ sang object mới

    });

    

    // Trả về object đã sắp xếp

    return sorted;

  }



  /**

   * Tạo mã đơn hàng (vnp_TxnRef) theo format VNPay

   * VNPay yêu cầu vnp_TxnRef tối đa 50 ký tự và phải unique

   * Format: timestamp_orderId (ví dụ: "1699123456789_ORD123")

   * @param {String|Number} orderId - ID đơn hàng trong hệ thống

   * @returns {String} Mã giao dịch VNPay (vnp_TxnRef) - tối đa 50 ký tự

   */

  generateTxnRef(orderId) {

    // Lấy timestamp hiện tại (milliseconds từ 1970-01-01)

    // Ví dụ: 1699123456789

    const timestamp = Date.now();

    

    // Chuyển orderId sang string

    const orderIdStr = orderId.toString();

    

    // Format: timestamp_orderId (tối đa 50 ký tự)

    // Tính toán độ dài tối đa của orderId

    // - timestamp.toString().length: độ dài của timestamp (thường là 13)

    // - 1: cho dấu gạch dưới "_"

    // Ví dụ: 50 - 13 - 1 = 36 ký tự cho orderId

    const maxOrderIdLength = 50 - timestamp.toString().length - 1;

    

    // Nếu orderId dài hơn cho phép, cắt bớt phần đầu, chỉ giữ phần cuối

    // slice(-maxOrderIdLength): lấy maxOrderIdLength ký tự cuối cùng

    // Ví dụ: "ORD123456789012345678901234567890" → "56789012345678901234567890" (nếu max = 30)

    const truncatedOrderId = orderIdStr.length > maxOrderIdLength

      ? orderIdStr.slice(-maxOrderIdLength)

      : orderIdStr;

    

    // Ghép timestamp và orderId bằng dấu gạch dưới

    // Ví dụ: "1699123456789_ORD123"

    return `${timestamp}_${truncatedOrderId}`;

  }



  /**

   * Parse vnp_TxnRef để lấy orderId

   * Hàm này tách orderId từ vnp_TxnRef (format: timestamp_orderId)

   * @param {String} vnp_TxnRef - Mã giao dịch từ VNPay (ví dụ: "1699123456789_ORD123")

   * @returns {String|null} orderId (ví dụ: "ORD123") hoặc null nếu không hợp lệ

   */

  parseOrderIdFromTxnRef(vnp_TxnRef) {

    // Nếu không có vnp_TxnRef, trả về null

    if (!vnp_TxnRef) return null;

    

    // Tách vnp_TxnRef bằng dấu gạch dưới "_"

    // Ví dụ: "1699123456789_ORD123" → ["1699123456789", "ORD123"]

    const parts = vnp_TxnRef.split("_");

    

    // Nếu có ít nhất 2 phần (timestamp và orderId)

    if (parts.length > 1) {

      // Lấy phần sau dấu _ đầu tiên (bỏ qua timestamp)

      // slice(1): bỏ phần đầu (timestamp), giữ lại phần sau

      // join("_"): nối lại bằng "_" (phòng trường hợp orderId có chứa "_")

      // Ví dụ: ["1699123456789", "ORD", "123"] → "ORD_123"

      return parts.slice(1).join("_");

    }



// Nếu không có dấu "_", trả về toàn bộ vnp_TxnRef (có thể là format cũ)

    return vnp_TxnRef;

  }

}



// Export một instance duy nhất của VNPayService (Singleton pattern)

// Đảm bảo chỉ có một instance được tạo và sử dụng trong toàn bộ ứng dụng

module.exports = new VNPayService();
