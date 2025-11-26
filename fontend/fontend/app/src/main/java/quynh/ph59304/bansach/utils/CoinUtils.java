package quynh.ph59304.bansach.utils;

import java.text.NumberFormat;
import java.util.Locale;

public class CoinUtils {
    private static final NumberFormat coinFormatter = NumberFormat.getNumberInstance(Locale.getDefault());

    public static String formatCoin(double amount) {
        return coinFormatter.format(amount) + " Coin";
    }

    public static String formatCurrency(double amount) {
        return coinFormatter.format(amount) + " đ";
    }

    public static String formatCoinWithSign(double amount, boolean isPositive) {
        String sign = isPositive ? "+" : "-";
        return sign + formatCoin(amount);
    }
}

