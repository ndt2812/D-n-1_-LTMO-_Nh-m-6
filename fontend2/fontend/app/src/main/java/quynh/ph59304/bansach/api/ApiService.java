package quynh.ph59304.bansach.api;

import java.util.List;
import java.util.Map;

import quynh.ph59304.bansach.models.ApiResponse;
import quynh.ph59304.bansach.models.Book;
import quynh.ph59304.bansach.models.BooksResponse;
import quynh.ph59304.bansach.models.CartItem;
import quynh.ph59304.bansach.models.CartResponse;
import quynh.ph59304.bansach.models.CategoriesResponse;
import quynh.ph59304.bansach.models.Category;
import quynh.ph59304.bansach.models.CoinBalanceResponse;
import quynh.ph59304.bansach.models.CoinHistoryResponse;
import quynh.ph59304.bansach.models.CoinTransaction;
import quynh.ph59304.bansach.models.CoinWalletResponse;
import quynh.ph59304.bansach.models.Order;
import quynh.ph59304.bansach.models.OrdersResponse;
import quynh.ph59304.bansach.models.PreviewResponse;
import quynh.ph59304.bansach.models.PromotionListResponse;
import quynh.ph59304.bansach.models.PromotionPreviewResponse;
import quynh.ph59304.bansach.models.NotificationListResponse;
import quynh.ph59304.bansach.models.ReviewCreateResponse;
import quynh.ph59304.bansach.models.ReviewListResponse;
import quynh.ph59304.bansach.models.User;
import okhttp3.MultipartBody;
import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.DELETE;
import retrofit2.http.GET;
import retrofit2.http.Header;
import retrofit2.http.Multipart;
import retrofit2.http.POST;
import retrofit2.http.PUT;
import retrofit2.http.Part;
import retrofit2.http.Path;
import retrofit2.http.Query;
import okhttp3.ResponseBody;

public interface ApiService {
    // Authentication
    @POST("api/register")
    Call<ApiResponse<User>> register(@Body Map<String, String> body);

    @POST("api/login")
    Call<ApiResponse<User>> login(@Body User user);

    @POST("api/forgot-password")
    Call<ApiResponse<Void>> forgotPassword(@Body Map<String, String> body);

    @POST("api/verify-reset-code")
    Call<ApiResponse<Map<String, String>>> verifyResetCode(@Body Map<String, String> body);

    @POST("api/reset-password")
    Call<ApiResponse<Void>> resetPassword(@Body Map<String, String> body);

    // Change password (for logged in users)
    @POST("api/change-password/send-code")
    Call<ApiResponse<Void>> sendChangePasswordCode(@Header("Authorization") String token);

    @POST("api/change-password/verify-code")
    Call<ApiResponse<Map<String, String>>> verifyChangePasswordCode(
            @Header("Authorization") String token,
            @Body Map<String, String> body
    );

    @POST("api/change-password/reset")
    Call<ApiResponse<Void>> changePassword(
            @Header("Authorization") String token,
            @Body Map<String, String> body
    );

    @GET("api/profile")
    Call<ApiResponse<User>> getProfile(@Header("Authorization") String token);

    @Multipart
    @POST("api/profile/avatar")
    Call<ApiResponse<User>> uploadAvatarApi(
            @Header("Authorization") String token,
            @Part MultipartBody.Part image
    );

    // Books
    @GET("api/books")
    Call<BooksResponse> getBooks(
            @Query("search") String search,
            @Query("category") String category,
            @Query("minPrice") Double minPrice,
            @Query("maxPrice") Double maxPrice
    );

    @GET("api/books/{id}")
    Call<ApiResponse<Book>> getBookDetail(@Path("id") String id);

    @GET("api/books/{bookId}/reviews")
    Call<ReviewListResponse> getBookReviews(
            @Path("bookId") String bookId,
            @Query("page") Integer page,
            @Query("limit") Integer limit,
            @Header("Authorization") String token
    );

    @POST("api/books/{bookId}/reviews")
    Call<ReviewCreateResponse> createReview(
            @Header("Authorization") String token,
            @Path("bookId") String bookId,
            @Body Map<String, Object> body
    );

    @PUT("api/books/{bookId}/reviews/{reviewId}")
    Call<ReviewCreateResponse> updateReview(
            @Header("Authorization") String token,
            @Path("bookId") String bookId,
            @Path("reviewId") String reviewId,
            @Body Map<String, Object> body
    );

    @GET("api/books/{bookId}/preview")
    Call<PreviewResponse> getPreviewContent(
            @Path("bookId") String bookId,
            @Header("Authorization") String token
    );

    @GET("api/categories")
    Call<CategoriesResponse> getCategories();

    // Cart
    // JWT-protected cart API
    @GET("api/cart")
    Call<ApiResponse<CartResponse>> getCart(
            @Header("Authorization") String token
    );

    @POST("api/cart/add")
    Call<ApiResponse<CartResponse>> addToCart(
            @Header("Authorization") String token,
            @Body Map<String, Object> body
    );

    // Backend supports POST /cart/update (also has PUT but POST is more compatible with some servers)
    @POST("api/cart/update")
    Call<ApiResponse<CartResponse>> updateCartItem(
            @Header("Authorization") String token,
            @Body Map<String, Object> body
    );

    // Backend supports POST /cart/remove/:bookId (and DELETE)
    @POST("api/cart/remove/{bookId}")
    Call<ApiResponse<CartResponse>> removeFromCart(
            @Header("Authorization") String token,
            @Path("bookId") String bookId
    );

    // Orders
    @POST("api/orders")
    Call<ResponseBody> createOrderApiRaw(
            @Header("Authorization") String token,
            @Body Map<String, Object> body
    );

    @POST("api/orders")
    Call<ApiResponse<Order>> createOrderApi(
            @Header("Authorization") String token,
            @Body Map<String, Object> body
    );

    @POST("orders")
    Call<ApiResponse<Order>> createOrderLegacy(
            @Header("Authorization") String token,
            @Body Map<String, Object> body
    );

    @POST("api/orders/apply-promotion")
    Call<PromotionPreviewResponse> applyPromotion(
            @Header("Authorization") String token,
            @Body Map<String, String> body
    );

    @GET("api/orders/promotions")
    Call<PromotionListResponse> getAvailablePromotions(
            @Header("Authorization") String token
    );

    @GET("api/orders")
    Call<ApiResponse<OrdersResponse>> getOrdersApi(
            @Header("Authorization") String token
    );

    @GET("orders")
    Call<ApiResponse<OrdersResponse>> getOrdersLegacy(
            @Header("Authorization") String token
    );

    @GET("api/orders/{id}")
    Call<ApiResponse<Order>> getOrderDetailApi(
            @Header("Authorization") String token,
            @Path("id") String orderId
    );

    @GET("orders/{id}")
    Call<ApiResponse<Order>> getOrderDetailLegacy(
            @Header("Authorization") String token,
            @Path("id") String orderId
    );

    @POST("api/orders/{id}/cancel")
    Call<ApiResponse<Order>> cancelOrder(
            @Header("Authorization") String token,
            @Path("id") String orderId
    );

    // Coin wallet
    @GET("coins/wallet")
    Call<CoinWalletResponse> getCoinWallet(
            @Header("Authorization") String token
    );

    @GET("coins/history")
    Call<CoinHistoryResponse> getCoinHistory(
            @Header("Authorization") String token,
            @Query("page") Integer page,
            @Query("limit") Integer limit,
            @Query("type") String type
    );

    @POST("coins/topup")
    Call<ResponseBody> topUpCoinsRaw(
            @Header("Authorization") String token,
            @Body Map<String, Object> body
    );

    @POST("coins/topup")
    Call<ApiResponse<CoinTransaction>> topUpCoins(
            @Header("Authorization") String token,
            @Body Map<String, Object> body
    );

    @GET("coins/api/balance")
    Call<CoinBalanceResponse> getCoinBalance(
            @Header("Authorization") String token
    );

    // Manual callback processing for pending transactions
    @POST("coins/manual-callback")
    Call<ApiResponse<Map<String, Object>>> manualCallback(
            @Header("Authorization") String token,
            @Body Map<String, Object> body
    );

    // Book Access & Purchase
    @GET("access/api/books/{bookId}/check")
    Call<ApiResponse<Map<String, Object>>> checkBookAccess(
            @Header("Authorization") String token,
            @Path("bookId") String bookId
    );

    // Notifications
    @GET("api/notifications")
    Call<NotificationListResponse> getNotifications(
            @Header("Authorization") String token,
            @Query("page") Integer page,
            @Query("limit") Integer limit,
            @Query("unreadOnly") Boolean unreadOnly
    );

    @GET("api/notifications/unread-count")
    Call<ApiResponse<Map<String, Integer>>> getUnreadCount(
            @Header("Authorization") String token
    );

    @PUT("api/notifications/{notificationId}/read")
    Call<ApiResponse<Void>> markNotificationAsRead(
            @Header("Authorization") String token,
            @Path("notificationId") String notificationId
    );

    @PUT("api/notifications/read-all")
    Call<ApiResponse<Void>> markAllNotificationsAsRead(
            @Header("Authorization") String token
    );

    @POST("access/books/{bookId}/purchase")
    Call<ApiResponse<Map<String, Object>>> purchaseBookAccess(
            @Header("Authorization") String token,
            @Path("bookId") String bookId,
            @Body Map<String, Object> body
    );

    @GET("access/api/books/{bookId}/content")
    Call<ApiResponse<Map<String, Object>>> getFullBookContent(
            @Header("Authorization") String token,
            @Path("bookId") String bookId
    );
}
