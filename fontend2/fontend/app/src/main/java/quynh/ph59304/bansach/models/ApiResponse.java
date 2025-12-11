package quynh.ph59304.bansach.models;

public class ApiResponse<T> {
    private String message;
    private T data;
    private String error;
    private Boolean success;
    private User user;
    private String token;
    private Book book;
    private java.util.List<Book> books;
    private java.util.List<Category> categories;
    private CartResponse cart;
    private java.util.List<Order> orders;
    private Order order;

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }

    public Boolean getSuccess() {
        return success;
    }

    public void setSuccess(Boolean success) {
        this.success = success;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public Book getBook() {
        return book;
    }

    public void setBook(Book book) {
        this.book = book;
    }

    public java.util.List<Book> getBooks() {
        return books;
    }

    public void setBooks(java.util.List<Book> books) {
        this.books = books;
    }

    public java.util.List<Category> getCategories() {
        return categories;
    }

    public void setCategories(java.util.List<Category> categories) {
        this.categories = categories;
    }

    public CartResponse getCart() {
        return cart;
    }

    public void setCart(CartResponse cart) {
        this.cart = cart;
    }

    public java.util.List<Order> getOrders() {
        return orders;
    }

    public void setOrders(java.util.List<Order> orders) {
        this.orders = orders;
    }

    public Order getOrder() {
        return order;
    }

    public void setOrder(Order order) {
        this.order = order;
    }
}
