package quynh.ph59304.bansach.models;

public class CoinTopUpPackage {
    private final int coins;
    private final int vnd;
    private final int bonus;

    public CoinTopUpPackage(int coins, int vnd, int bonus) {
        this.coins = coins;
        this.vnd = vnd;
        this.bonus = bonus;
    }

    public int getCoins() {
        return coins;
    }

    public int getVnd() {
        return vnd;
    }

    public int getBonus() {
        return bonus;
    }

    public int getTotalCoins() {
        return coins + bonus;
    }
}

