package quynh.ph59304.bansach.models;

import java.util.List;

public class CoinHistoryResponse {
    private List<CoinTransaction> transactions;
    private int total;
    private int page;
    private int limit;

    public CoinHistoryResponse() {
    }

    public List<CoinTransaction> getTransactions() {
        return transactions;
    }

    public void setTransactions(List<CoinTransaction> transactions) {
        this.transactions = transactions;
    }

    public int getTotal() {
        return total;
    }

    public void setTotal(int total) {
        this.total = total;
    }

    public int getPage() {
        return page;
    }

    public void setPage(int page) {
        this.page = page;
    }

    public int getLimit() {
        return limit;
    }

    public void setLimit(int limit) {
        this.limit = limit;
    }
}

