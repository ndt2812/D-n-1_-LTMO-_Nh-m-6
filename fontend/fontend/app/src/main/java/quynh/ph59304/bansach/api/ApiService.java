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
import quynh.ph59304.bansach.models.ChapterContent;
import quynh.ph59304.bansach.models.ChapterContentResponse;
import quynh.ph59304.bansach.models.CheckoutResponse;
import quynh.ph59304.bansach.models.CoinBalanceResponse;
import quynh.ph59304.bansach.models.CoinExchangePackage;
import quynh.ph59304.bansach.models.CoinHistoryResponse;
import quynh.ph59304.bansach.models.CoinTopUpPackage;
import quynh.ph59304.bansach.models.CoinTransaction;
import quynh.ph59304.bansach.models.CoinWalletResponse;
import quynh.ph59304.bansach.models.Order;
import quynh.ph59304.bansach.models.OrdersResponse;
import quynh.ph59304.bansach.models.PreviewResponse;
import quynh.ph59304.bansach.models.User;
import quynh.ph59304.bansach.models.UserProfile;
import okhttp3.MultipartBody;
import okhttp3.ResponseBody;
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
import retrofit2.http.Url;

public interface ApiService {
    // Authentication
    @POST("api/register")
    Call<ApiResponse<User>> register(@Body User user);

    @POST("api/login")
    Call<ApiResponse<User>> login(@Body User user);

    @POST("api/forgot-password")
    Call<ApiResponse<Void>> forgotPassword(@Body Map<String, String> body);

    @GET("api/profile")
    Call<ApiResponse<User>> getProfile(@Header("Authorization") String token);

    @Multipart
    @POST("profile/upload")
    Call<ApiResponse<User>> uploadAvatar(
            @Header("Authorization") String token,
            @Part MultipartBody.Part image
    );

    @Multipart
    @POST("api/profile/upload")
    Call<ApiResponse<User>> uploadAvatarApi(
            @Header("Authorization") String token,
            @Part MultipartBody.Part image
    );

    @Multipart
    @POST("api/profile/upload")
    Call<ResponseBody> uploadAvatarApiRaw(
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

    @GET("api/categories")
    Call<CategoriesResponse> getCategories();

    // Cart - Tất cả API yêu cầu JWT token (được thêm tự động bởi RetrofitClient interceptor)
    @GET("api/cart")
    Call<ApiResponse<CartResponse>> getCart();

    @POST("api/cart/add")
    Call<ApiResponse<CartResponse>> addToCart(
            @Body Map<String, Object> body
    );

    @POST("api/cart/update")
    Call<ApiResponse<CartResponse>> updateCartItem(
            @Body Map<String, Object> body
    );

    @POST("api/cart/remove/{bookId}")
    Call<ApiResponse<CartResponse>> removeFromCart(
            @Path("bookId") String bookId
    );

    // Dynamic fallback POST for cart (allows trying alternative paths without rebuilding interface)
    @POST
    Call<ResponseBody> postCartDynamic(
            @Url String url,
            @Body Map<String, Object> body
    );

    // Orders
    @POST("orders")
    Call<ApiResponse<Order>> createOrder(
            @Body Map<String, Object> body
    );

    @GET("orders")
    Call<ApiResponse<OrdersResponse>> getOrders();

    @GET("orders/{id}")
    Call<ApiResponse<Order>> getOrderDetail(
            @Path("id") String orderId
    );

    // Coin System
    @GET("api/coin/balance")
    Call<ApiResponse<CoinBalanceResponse>> getCoinBalance();

    @GET("api/coin/packages")
    Call<ApiResponse<List<CoinTopUpPackage>>> getCoinTopUpPackages();

    @GET("api/coin/exchange-packages")
    Call<ApiResponse<List<CoinExchangePackage>>> getCoinExchangePackages();

    @POST("api/coin/topup")
    Call<ApiResponse<Object>> topUpCoins(@Body Map<String, Object> body);

    @POST("api/coin/exchange")
    Call<ApiResponse<Object>> exchangeCoins(@Body Map<String, Object> body);

    @GET("api/coin/transactions")
    Call<ApiResponse<CoinHistoryResponse>> getCoinTransactions(
            @Query("page") Integer page,
            @Query("limit") Integer limit,
            @Query("type") String type
    );

    @GET("api/coin/wallet")
    Call<ApiResponse<CoinWalletResponse>> getCoinWallet();

    // Preview System
    @GET("api/books/{bookId}/preview")
    Call<ApiResponse<PreviewResponse>> getBookPreview(@Path("bookId") String bookId);

    @GET("api/books/{bookId}/chapters/{chapterId}")
    Call<ApiResponse<ChapterContentResponse>> getChapterContent(
            @Path("bookId") String bookId,
            @Path("chapterId") String chapterId
    );

    @POST("api/books/{bookId}/chapters/{chapterId}/purchase")
    Call<ApiResponse<Object>> purchaseChapter(
            @Path("bookId") String bookId,
            @Path("chapterId") String chapterId
    );

    // User Profile
    @GET("api/user/profile")
    Call<ApiResponse<UserProfile>> getUserProfile();
}
