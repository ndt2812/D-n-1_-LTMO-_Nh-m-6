const nodemailer = require('nodemailer');

// Tạo transporter một lần và tái sử dụng
let transporter = null;

/**
 * Khởi tạo email transporter
 * Sử dụng singleton pattern để tái sử dụng connection
 */
function getTransporter() {
  if (transporter) {
    return transporter;
  }

  // Kiểm tra cấu hình email
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️  EMAIL_USER hoặc EMAIL_PASS chưa được cấu hình trong .env');
    return null;
  }

  // Tạo transporter với cấu hình Gmail
  transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    // Thêm các options để tăng độ tin cậy
    pool: true, // Sử dụng connection pooling
    maxConnections: 1,
    maxMessages: 3,
    rateDelta: 1000,
    rateLimit: 5
  });

  // Verify connection configuration
  transporter.verify(function (error, success) {
    if (error) {
      console.error('❌ Email transporter verification failed:', error);
    } else {
      console.log('✅ Email transporter is ready to send messages');
    }
  });

  return transporter;
}

/**
 * Gửi email với mã xác nhận đặt lại mật khẩu
 * @param {string} toEmail - Email người nhận
 * @param {string} resetCode - Mã xác nhận 6 chữ số
 * @returns {Promise<Object>} - Kết quả gửi email
 */
async function sendPasswordResetCode(toEmail, resetCode) {
  try {
    const emailTransporter = getTransporter();
    
    if (!emailTransporter) {
      throw new Error('Email transporter chưa được cấu hình. Vui lòng kiểm tra EMAIL_USER và EMAIL_PASS trong .env');
    }

    const mailOptions = {
      from: `"Hệ thống Bán Sách" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: 'Mã xác nhận đặt lại mật khẩu',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Mã xác nhận đặt lại mật khẩu</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 20px 0; text-align: center;">
                <table role="presentation" style="width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 40px 30px; text-align: center; background-color: #007bff; border-radius: 8px 8px 0 0;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 24px;">Yêu cầu đặt lại mật khẩu</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                        Xin chào,
                      </p>
                      <p style="margin: 0 0 30px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                        Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản của mình. Vui lòng sử dụng mã xác nhận bên dưới để tiếp tục.
                      </p>
                      <div style="text-align: center; margin: 30px 0;">
                        <div style="display: inline-block; padding: 20px 40px; background-color: #f0f0f0; border-radius: 8px; border: 2px dashed #007bff;">
                          <p style="margin: 0; font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                            ${resetCode}
                          </p>
                        </div>
                      </div>
                      <p style="margin: 30px 0 20px 0; color: #666666; font-size: 14px; line-height: 1.6;">
                        <strong>Lưu ý:</strong> Mã xác nhận này có hiệu lực trong <strong style="color: #dc3545;">15 phút</strong>.
                      </p>
                      <p style="margin: 20px 0 0 0; color: #999999; font-size: 14px; line-height: 1.6;">
                        Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này. Mật khẩu của bạn sẽ không thay đổi.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 20px 30px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">
                      <p style="margin: 0; color: #666666; font-size: 12px;">
                        Email này được gửi tự động, vui lòng không trả lời.
                      </p>
                      <p style="margin: 10px 0 0 0; color: #999999; font-size: 12px;">
                        © ${new Date().getFullYear()} Hệ thống Bán Sách. Tất cả quyền được bảo lưu.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
      text: `
Yêu cầu đặt lại mật khẩu

Xin chào,

Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản của mình.

Mã xác nhận của bạn là: ${resetCode}

Mã này có hiệu lực trong 15 phút.

Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này. Mật khẩu của bạn sẽ không thay đổi.

Trân trọng,
Đội ngũ hỗ trợ Hệ thống Bán Sách
      `.trim()
    };

    const info = await emailTransporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', info.messageId);
    return {
      success: true,
      messageId: info.messageId,
      response: info.response
    };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    throw error;
  }
}

/**
 * Gửi email thông báo đặt lại mật khẩu thành công
 * @param {string} toEmail - Email người nhận
 * @returns {Promise<Object>} - Kết quả gửi email
 */
async function sendPasswordResetSuccess(toEmail) {
  try {
    const emailTransporter = getTransporter();
    
    if (!emailTransporter) {
      throw new Error('Email transporter chưa được cấu hình');
    }

    const mailOptions = {
      from: `"Hệ thống Bán Sách" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: 'Đặt lại mật khẩu thành công',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 20px 0; text-align: center;">
                <table role="presentation" style="width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 40px 30px; text-align: center; background-color: #28a745; border-radius: 8px 8px 0 0;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 24px;">✓ Đặt lại mật khẩu thành công</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                        Xin chào,
                      </p>
                      <p style="margin: 0 0 30px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                        Mật khẩu của bạn đã được đặt lại thành công. Bạn có thể đăng nhập với mật khẩu mới ngay bây giờ.
                      </p>
                      <p style="margin: 30px 0 20px 0; color: #dc3545; font-size: 14px; line-height: 1.6;">
                        <strong>⚠️ Nếu bạn không thực hiện thao tác này, vui lòng liên hệ với chúng tôi ngay lập tức.</strong>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
      text: `
Đặt lại mật khẩu thành công

Xin chào,

Mật khẩu của bạn đã được đặt lại thành công. Bạn có thể đăng nhập với mật khẩu mới ngay bây giờ.

Nếu bạn không thực hiện thao tác này, vui lòng liên hệ với chúng tôi ngay lập tức.

Trân trọng,
Đội ngũ hỗ trợ Hệ thống Bán Sách
      `.trim()
    };

    const info = await emailTransporter.sendMail(mailOptions);
    console.log('✅ Success email sent:', info.messageId);
    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error('❌ Error sending success email:', error);
    throw error;
  }
}

module.exports = {
  getTransporter,
  sendPasswordResetCode,
  sendPasswordResetSuccess
};

