package quynh.ph59304.bansach.models;

import com.google.gson.annotations.SerializedName;

public class OrderItem {
    @SerializedName(value = "_id", alternate = {"id"})
    private String id;
    private Book book;
    private int quantity;
    private double price;

    public OrderItem() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public Book getBook() {
        return book;
    }

    public void setBook(Book book) {
        this.book = book;
    }

    public int getQuantity() {
        return quantity;
    }

    public void setQuantity(int quantity) {
        this.quantity = quantity;
    }

    public double getPrice() {
        return price;
    }

    public void setPrice(double price) {
        this.price = price;
    }

    public double getSubtotal() {
        return price * quantity;
    }
}


