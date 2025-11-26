const crypto = require('crypto');
const qs = require('qs');

const DEFAULT_VNP_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
const DEFAULT_RETURN_URL = 'https://a1b2c3d4.ngrok-free.app/coins/vnpay-return';

const pad = (number) => number.toString().padStart(2, '0');

const formatDate = (date) => {
    return (
        date.getFullYear().toString() +
        pad(date.getMonth() + 1) +
        pad(date.getDate()) +
        pad(date.getHours()) +
        pad(date.getMinutes()) +
        pad(date.getSeconds())
    );
};

const sortParams = (params) => {
    return Object.keys(params)
        .sort()
        .reduce((acc, key) => {
            acc[key] = params[key];
            return acc;
        }, {});
};

const normalizeIp = (ip) => {
    if (!ip) return '127.0.0.1';

    // XFF may contain multiple IPs, take the first public candidate.
    const firstIp = ip.split(',')[0].trim();

    if (firstIp === '::1') return '127.0.0.1';
    if (firstIp.startsWith('::ffff:')) return firstIp.replace('::ffff:', '');

    return firstIp;
};

const getClientIp = (req) => {
    const rawIp =
        req.headers['x-forwarded-for'] ||
        req.ip ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        (req.connection && req.connection.socket && req.connection.socket.remoteAddress) ||
        '127.0.0.1';

    return normalizeIp(rawIp);
};

const buildPaymentUrl = ({ amount, orderInfo, txnRef, ipAddr, locale = 'vn', orderType = 'other', returnUrlOverride }) => {
    const tmnCode = process.env.VNP_TMN_CODE;
    const secretKey = process.env.VNP_HASH_SECRET;
    const vnpUrl = process.env.VNP_URL || DEFAULT_VNP_URL;
    const returnUrl = process.env.VNP_RETURN_URL || DEFAULT_RETURN_URL;

    if (!tmnCode || !secretKey) {
        throw new Error('Missing VNPAY configuration (VNP_TMN_CODE or VNP_HASH_SECRET)');
    }

    const now = new Date();
    const vnpParams = {
        vnp_Version: '2.1.0',
        vnp_Command: 'pay',
        vnp_TmnCode: tmnCode,
        vnp_Locale: locale || 'vn',
        vnp_CurrCode: 'VND',
        vnp_TxnRef: txnRef,
        vnp_OrderInfo: orderInfo,
        vnp_OrderType: orderType,
        vnp_Amount: Math.round(Number(amount) * 100),
        vnp_ReturnUrl: returnUrlOverride || returnUrl,
        vnp_IpAddr: ipAddr,
        vnp_CreateDate: formatDate(now),
        vnp_ExpireDate: formatDate(new Date(now.getTime() + 15 * 60 * 1000)),
    };

    const sortedParams = sortParams(vnpParams);
    const signData = qs.stringify(sortedParams, { encode: true, encodeValuesOnly: true });
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    sortedParams.vnp_SecureHashType = 'SHA512';
    sortedParams.vnp_SecureHash = signed;

    if (process.env.NODE_ENV !== 'production') {
        console.log('VNPay signData:', signData);
        console.log('VNPay secure hash:', signed);
        if (process.env.DEBUG_VNPAY_SECRET === 'true') {
            console.log(
                'VNPay secret preview:',
                `${secretKey.slice(0, 4)}...${secretKey.slice(-4)} (len=${secretKey.length})`
            );
        }
    }

    const paymentUrl = `${vnpUrl}?${qs.stringify(sortedParams, { encode: true })}`;

    if (process.env.NODE_ENV !== 'production') {
        console.log('VNPay payment URL:', paymentUrl);
    }

    return paymentUrl;
};

const verifyCallback = (queryParams) => {
    const secretKey = process.env.VNP_HASH_SECRET;
    if (!secretKey) {
        throw new Error('Missing VNPAY secret for verification');
    }

    const receivedHash = queryParams.vnp_SecureHash;
    const receivedHashType = queryParams.vnp_SecureHashType;
    delete queryParams.vnp_SecureHash;
    delete queryParams.vnp_SecureHashType;

    const sortedParams = sortParams(queryParams);
    const signData = qs.stringify(sortedParams, { encode: true, encodeValuesOnly: true });
    const computedHash = crypto.createHmac('sha512', secretKey)
        .update(Buffer.from(signData, 'utf-8'))
        .digest('hex');

    return {
        isValid: computedHash === receivedHash,
        hashType: receivedHashType,
        computedHash,
        receivedHash,
        params: queryParams,
    };
};

module.exports = {
    buildPaymentUrl,
    verifyCallback,
    getClientIp,
};

