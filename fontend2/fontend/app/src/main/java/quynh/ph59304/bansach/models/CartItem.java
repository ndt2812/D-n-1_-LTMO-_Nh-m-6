package quynh.ph59304.bansach.models;

import com.google.gson.annotations.SerializedName;

public class CartItem {
    @SerializedName("_id")
    private String id;
    private Book book;
    private int quantity;
    private double price;

    public CartItem() {
    }

    public CartItem(String bookId, int quantity) {
        this.book = new Book();
        this.book.setId(bookId);
        this.quantity = quantity;
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
        if (book != null) {
            return book.getPrice() * quantity;
        }
        return price * quantity;
    }
}


