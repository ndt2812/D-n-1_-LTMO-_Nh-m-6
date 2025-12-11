package quynh.ph59304.bansach;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;

import com.google.android.material.button.MaterialButton;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import quynh.ph59304.bansach.api.ApiService;
import quynh.ph59304.bansach.api.RetrofitClient;
import quynh.ph59304.bansach.models.ApiResponse;
import quynh.ph59304.bansach.utils.SharedPreferencesManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class BookReaderActivity extends AppCompatActivity {
    private static final String TAG = "BookReaderActivity";
    public static final String EXTRA_BOOK_ID = "book_id";
    public static final String EXTRA_BOOK_TITLE = "book_title";

    private String bookId;
    private String bookTitle;
    private ApiService apiService;
    private SharedPreferencesManager prefManager;

    private TextView tvContent;
    private TextView tvChapterTitle;
    private TextView tvChapterInfo;
    private androidx.core.widget.NestedScrollView scrollView;
    private ProgressBar progressBar;
    private TextView tvError;
    private MaterialButton btnPreviousChapter;
    private MaterialButton btnNextChapter;
    private LinearLayout layoutChapterNavigation;

    // Chapter management
    private List<Chapter> chapters = new ArrayList<>();
    private int currentChapterIndex = 0;

    private static class Chapter {
        String title;
        String content;
        int chapterNumber;

        Chapter(String title, String content, int chapterNumber) {
            this.title = title;
            this.content = content;
            this.chapterNumber = chapterNumber;
        }
    }

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_book_reader);

        bookId = getIntent().getStringExtra(EXTRA_BOOK_ID);
        bookTitle = getIntent().getStringExtra(EXTRA_BOOK_TITLE);
        if (bookId == null) {
            Toast.makeText(this, "Không tìm thấy sách", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        apiService = RetrofitClient.getInstance().getApiService();
        prefManager = new SharedPreferencesManager(this);

        if (!prefManager.isLoggedIn()) {
            Toast.makeText(this, "Vui lòng đăng nhập", Toast.LENGTH_SHORT).show();
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return;
        }

        initViews();
        setupToolbar();
        setupChapterNavigation();
        loadFullContent();
    }

    private void initViews() {
        tvContent = findViewById(R.id.tvBookContent);
        tvChapterTitle = findViewById(R.id.tvChapterTitle);
        tvChapterInfo = findViewById(R.id.tvChapterInfo);
        scrollView = findViewById(R.id.scrollViewContent);
        progressBar = findViewById(R.id.progressBar);
        tvError = findViewById(R.id.tvError);
        btnPreviousChapter = findViewById(R.id.btnPreviousChapter);
        btnNextChapter = findViewById(R.id.btnNextChapter);
        layoutChapterNavigation = findViewById(R.id.layoutChapterNavigation);
    }

    private void setupToolbar() {
        Toolbar toolbar = findViewById(R.id.toolbar);
        setSupportActionBar(toolbar);
        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
            getSupportActionBar().setDisplayShowHomeEnabled(true);
            if (bookTitle != null) {
                getSupportActionBar().setTitle(bookTitle);
            }
        }
        toolbar.setNavigationOnClickListener(v -> onBackPressed());
    }

    private void setupChapterNavigation() {
        btnPreviousChapter.setOnClickListener(v -> {
            if (currentChapterIndex > 0) {
                currentChapterIndex--;
                displayChapter(currentChapterIndex);
                scrollToTop();
            }
        });

        btnNextChapter.setOnClickListener(v -> {
            if (currentChapterIndex < chapters.size() - 1) {
                currentChapterIndex++;
                displayChapter(currentChapterIndex);
                scrollToTop();
            }
        });
    }

    private void scrollToTop() {
        if (scrollView != null) {
            scrollView.post(() -> scrollView.smoothScrollTo(0, 0));
        }
    }

    private void loadFullContent() {
        String authHeader = getAuthHeader();
        if (authHeader == null) {
            navigateToLogin();
            return;
        }

        showLoading(true);
        Call<ApiResponse<Map<String, Object>>> call = apiService.getFullBookContent(authHeader, bookId);
        call.enqueue(new Callback<ApiResponse<Map<String, Object>>>() {
            @Override
            public void onResponse(Call<ApiResponse<Map<String, Object>>> call, Response<ApiResponse<Map<String, Object>>> response) {
                showLoading(false);
                try {
                    Log.d(TAG, "═══════════════════════════════════════");
                    Log.d(TAG, "📥 API Response received");
                    Log.d(TAG, "Response code: " + response.code());
                    Log.d(TAG, "Response successful: " + response.isSuccessful());
                    
                    if (response.isSuccessful() && response.body() != null) {
                    ApiResponse<Map<String, Object>> apiResponse = response.body();
                    Boolean success = apiResponse.getSuccess();
                    if (success != null && success) {
                        Map<String, Object> data = apiResponse.getData();
                        if (data != null) {
                            Log.d(TAG, "Data keys: " + data.keySet());
                            
                            // Get content first
                            String content = (String) data.get("content");
                            Log.d(TAG, "Content from data: " + (content != null ? "exists, length=" + content.length() : "null"));
                            
                            // Try to get chapters array first
                            @SuppressWarnings("unchecked")
                            List<Map<String, Object>> chaptersList = (List<Map<String, Object>>) data.get("chapters");
                            Log.d(TAG, "Chapters list: " + (chaptersList != null ? "exists, size=" + chaptersList.size() : "null"));
                            
                            if (chaptersList != null && !chaptersList.isEmpty()) {
                                Log.d(TAG, "📚 Found chapters array with " + chaptersList.size() + " chapters");
                                parseChaptersFromArray(chaptersList);
                                
                                // Even if we have chapters from array, if only 1 chapter and content is long, split it
                                if (content != null && content.length() > 1500 && chapters.size() <= 1) {
                                    Log.w(TAG, "⚠ Chapters array only has " + chapters.size() + " chapter(s), forcing split");
                                    chapters.clear();
                                    parseChaptersBySeparator(content);
                                }
                            } else if (content != null && !content.isEmpty()) {
                                Log.d(TAG, "📝 No chapters array, parsing from content string");
                                String preview = content.length() > 500 ? content.substring(0, 500) : content;
                                Log.d(TAG, "Content preview (first 500): " + preview);
                                
                                // ALWAYS use parseChaptersBySeparator first (more reliable)
                                parseChaptersBySeparator(content);
                                
                                // If that didn't create multiple chapters, try pattern matching
                                if (chapters.size() <= 1 && content.length() > 2000) {
                                    Log.d(TAG, "Separator split didn't create multiple chapters, trying pattern matching");
                                    chapters.clear();
                                    parseChaptersFromContent(content);
                                }
                            } else {
                                Log.w(TAG, "⚠ No content or chapters found in data");
                                showError("Nội dung sách đang được cập nhật");
                                return;
                            }
                            
                            // FINAL CHECK: ALWAYS ensure multiple chapters if content is long
                            if (content != null && content.length() > 1500) {
                                if (chapters.isEmpty()) {
                                    Log.w(TAG, "⚠ No chapters parsed, forcing split");
                                    parseChaptersBySeparator(content);
                                } else if (chapters.size() == 1) {
                                    Log.w(TAG, "⚠ Only one chapter but content is long (" + content.length() + "), forcing split");
                                    String singleContent = chapters.get(0).content;
                                    chapters.clear();
                                    parseChaptersBySeparator(singleContent);
                                }
                            }
                            
                            // ABSOLUTE FINAL CHECK: If we still have only 1 chapter with long content, force split NOW
                            if (content != null && content.length() > 1500 && chapters.size() == 1) {
                                Log.e(TAG, "🚨🚨🚨 CRITICAL: Still only 1 chapter after all parsing! Force splitting NOW!");
                                String singleContent = chapters.get(0).content;
                                chapters.clear();
                                parseChaptersBySeparator(singleContent);
                                
                                // If still only 1, manually split
                                if (chapters.size() <= 1 && singleContent.length() > 1500) {
                                    Log.e(TAG, "🚨 Manual split required!");
                                    chapters.clear();
                                    int targetSize = 2500;
                                    int count = Math.max(2, (int) Math.ceil((double) singleContent.length() / targetSize));
                                    count = Math.min(count, 10);
                                    int size = singleContent.length() / count;
                                    for (int i = 0; i < count; i++) {
                                        int start = i * size;
                                        int end = (i == count - 1) ? singleContent.length() : (i + 1) * size;
                                        String chContent = singleContent.substring(start, end).trim();
                                        if (!chContent.isEmpty()) {
                                            chapters.add(new Chapter("Chương " + (i + 1), chContent, i + 1));
                                        }
                                    }
                                    Log.d(TAG, "🚨 Manual split created " + chapters.size() + " chapters");
                                }
                            }
                            
                            // Final validation and logging
                            if (!chapters.isEmpty()) {
                                Log.d(TAG, "═══════════════════════════════════════");
                                Log.d(TAG, "✅ FINAL RESULT: " + chapters.size() + " chapters");
                                for (int i = 0; i < chapters.size(); i++) {
                                    Chapter ch = chapters.get(i);
                                    Log.d(TAG, "  Chapter " + (i + 1) + ": " + ch.title + 
                                          " (length: " + ch.content.length() + " chars)");
                                }
                                Log.d(TAG, "═══════════════════════════════════════");
                                
                                // Verify we have multiple chapters for long content
                                if (content != null && content.length() > 1500 && chapters.size() == 1) {
                                    Log.e(TAG, "❌❌❌ STILL ONLY 1 CHAPTER! This should not happen!");
                                }
                                
                                currentChapterIndex = 0;
                                displayChapter(0);
                            } else {
                                Log.e(TAG, "❌ CRITICAL: Failed to parse any chapters!");
                                showError("Không tìm thấy chương nào");
                            }
                        } else {
                            Log.e(TAG, "Data is null");
                            showError("Không tìm thấy nội dung");
                        }
                    } else {
                        String errorMsg = apiResponse.getMessage() != null 
                            ? apiResponse.getMessage() 
                            : "Không thể tải nội dung sách";
                        showError(errorMsg);
                    }
                    } else {
                        if (response.code() == 403) {
                            showError("Bạn cần mua quyền truy cập để đọc sách này");
                        } else {
                            showError("Không thể tải nội dung sách");
                        }
                    }
                } catch (Exception e) {
                    Log.e(TAG, "❌ EXCEPTION in onResponse: " + e.getMessage(), e);
                    showError("Lỗi xử lý dữ liệu: " + e.getMessage());
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Map<String, Object>>> call, Throwable t) {
                showLoading(false);
                Log.e(TAG, "❌❌❌ onFailure called");
                Log.e(TAG, "Error message: " + t.getMessage());
                Log.e(TAG, "Error class: " + t.getClass().getName());
                if (t.getCause() != null) {
                    Log.e(TAG, "Cause: " + t.getCause().getMessage());
                }
                Log.e(TAG, "Full stack trace:", t);
                showError("Lỗi kết nối: " + t.getMessage());
            }
        });
    }

    private void parseChaptersFromArray(List<Map<String, Object>> chaptersList) {
        chapters.clear();
        for (Map<String, Object> chapterData : chaptersList) {
            String title = (String) chapterData.get("title");
            if (title == null) {
                title = (String) chapterData.get("chapterTitle");
            }
            String content = (String) chapterData.get("content");
            Integer chapterNumber = (Integer) chapterData.get("chapterNumber");
            if (chapterNumber == null) {
                Object numObj = chapterData.get("number");
                if (numObj instanceof Number) {
                    chapterNumber = ((Number) numObj).intValue();
                } else {
                    chapterNumber = chapters.size() + 1;
                }
            }
            
            if (title == null) {
                title = "Chương " + chapterNumber;
            }
            if (content == null) {
                content = "";
            }
            
            chapters.add(new Chapter(title, content, chapterNumber));
        }
    }

    private void parseChaptersFromContent(String content) {
        chapters.clear();
        
        if (content == null || content.trim().isEmpty()) {
            Log.w(TAG, "Content is null or empty");
            return;
        }
        
        Log.d(TAG, "=== START PARSING CONTENT ===");
        Log.d(TAG, "Content length: " + content.length());
        Log.d(TAG, "First 300 chars: " + (content.length() > 300 ? content.substring(0, 300) : content));
        
        // Multiple patterns to try
        Pattern[] patterns = {
            // Pattern 1: "Chương X:" or "Chapter X:"
            Pattern.compile("(?i)(?:chương|chapter)\\s*(\\d+)[:：]\\s*(.*?)(?=(?:chương|chapter)\\s*\\d+[:：]|$)", Pattern.DOTALL),
            // Pattern 2: "Chương X" or "Chapter X" (without colon)
            Pattern.compile("(?i)(?:chương|chapter)\\s*(\\d+)\\s+(.*?)(?=(?:chương|chapter)\\s*\\d+|$)", Pattern.DOTALL),
            // Pattern 3: "CHƯƠNG X" (uppercase)
            Pattern.compile("CHƯƠNG\\s*(\\d+)[:：]?\\s*(.*?)(?=CHƯƠNG\\s*\\d+|$)", Pattern.DOTALL),
            // Pattern 4: Just numbers like "1.", "2.", etc. at start of line
            Pattern.compile("^\\s*(\\d+)\\.\\s+(.*?)(?=^\\s*\\d+\\.|$)", Pattern.MULTILINE | Pattern.DOTALL)
        };
        
        Pattern matchedPattern = null;
        Matcher matcher = null;
        
        // Try each pattern
        for (Pattern pattern : patterns) {
            matcher = pattern.matcher(content);
            if (matcher.find()) {
                matchedPattern = pattern;
                Log.d(TAG, "Found pattern match: " + pattern.pattern());
                break;
            }
        }
        
        if (matchedPattern == null || matcher == null) {
            // No pattern matched, try to split by double newlines or other separators
            Log.d(TAG, "No pattern matched, trying alternative parsing");
            parseChaptersBySeparator(content);
            return;
        }
        
        // Reset matcher to start from beginning
        matcher = matchedPattern.matcher(content);
        int lastEnd = 0;
        
        while (matcher.find()) {
            // Add content before first chapter
            if (matcher.start() > lastEnd) {
                String preContent = content.substring(lastEnd, matcher.start()).trim();
                if (!preContent.isEmpty() && preContent.length() > 50) { // Only add if substantial
                    chapters.add(new Chapter("Mở đầu", preContent, 0));
                }
            }
            
            int chapterNumber = Integer.parseInt(matcher.group(1));
            String chapterTitle = matcher.groupCount() > 1 ? matcher.group(2).trim() : "";
            
            if (chapterTitle.isEmpty() || chapterTitle.length() > 100) {
                chapterTitle = "Chương " + chapterNumber;
            } else {
                // Clean up title (remove newlines, extra spaces)
                chapterTitle = chapterTitle.replaceAll("\\s+", " ").trim();
                if (chapterTitle.length() > 50) {
                    chapterTitle = chapterTitle.substring(0, 50) + "...";
                }
            }
            
            int startPos = matcher.end();
            int endPos = content.length();
            
            // Find next match for this chapter's end
            Matcher nextMatcher = matchedPattern.matcher(content);
            if (nextMatcher.find(startPos)) {
                endPos = nextMatcher.start();
            }
            
            String chapterContent = content.substring(startPos, endPos).trim();
            if (!chapterContent.isEmpty()) {
                chapters.add(new Chapter(chapterTitle, chapterContent, chapterNumber));
                Log.d(TAG, "Added chapter: " + chapterTitle + " (length: " + chapterContent.length() + ")");
            }
            
            lastEnd = endPos;
        }
        
        Log.d(TAG, "After pattern matching, chapters found: " + chapters.size());
        
        // ALWAYS split if content is long enough, regardless of pattern matching result
        if (content.length() > 1500) {
            if (chapters.isEmpty() || chapters.size() == 1) {
                Log.d(TAG, "Content is long (" + content.length() + ") but only " + chapters.size() + " chapter(s), forcing split");
                if (chapters.size() == 1) {
                    content = chapters.get(0).content; // Use the parsed content if available
                }
                chapters.clear();
                parseChaptersBySeparator(content);
            } else {
                Log.d(TAG, "Pattern matching successful, found " + chapters.size() + " chapters");
            }
        } else {
            Log.d(TAG, "Content is short (" + content.length() + "), keeping as is");
        }
        
        Log.d(TAG, "=== END PARSING, TOTAL CHAPTERS: " + chapters.size() + " ===");
    }
    
    private void parseChaptersBySeparator(String content) {
        if (content == null || content.trim().isEmpty()) {
            Log.w(TAG, "parseChaptersBySeparator: content is null or empty");
            return;
        }
        
        Log.d(TAG, "=== parseChaptersBySeparator START ===");
        Log.d(TAG, "Content length: " + content.length());
        chapters.clear(); // Clear any existing chapters
        
        // Try splitting by common separators
        String[] separators = {
            "\n\n\n",  // Triple newline
            "\n\n",   // Double newline
            "---",    // Dashes
            "***",    // Asterisks
            "==="     // Triple equals
        };
        
        String[] parts = null;
        String usedSeparator = null;
        
        for (String separator : separators) {
            if (content.contains(separator)) {
                parts = content.split(Pattern.quote(separator));
                usedSeparator = separator;
                Log.d(TAG, "Split by separator: " + separator + ", parts: " + parts.length);
                break;
            }
        }
        
        if (parts != null && parts.length > 1) {
            for (int i = 0; i < parts.length; i++) {
                String part = parts[i].trim();
                if (!part.isEmpty() && part.length() > 50) { // Only add substantial parts (at least 50 chars)
                    String title = "Chương " + (i + 1);
                    chapters.add(new Chapter(title, part, i + 1));
                    Log.d(TAG, "Added chapter " + (i + 1) + " from separator, length: " + part.length());
                }
            }
        }
        
        // If separator splitting didn't work or produced too few chapters, split by length
        if (chapters.size() <= 1) {
            Log.d(TAG, "Separator splitting didn't work well, splitting by length");
            chapters.clear();
            
            // Split by approximate length (e.g., every 3000-4000 characters)
            int chapterSize = 3500;
            int chapterNum = 1;
            int start = 0;
            
            while (start < content.length()) {
                int end = Math.min(start + chapterSize, content.length());
                
                // Try to end at a sentence boundary (period, exclamation, question mark)
                if (end < content.length()) {
                    int lastPeriod = content.lastIndexOf('.', end);
                    int lastExclamation = content.lastIndexOf('!', end);
                    int lastQuestion = content.lastIndexOf('?', end);
                    int lastNewline = content.lastIndexOf('\n', end);
                    
                    int bestBreak = Math.max(Math.max(lastPeriod, lastExclamation), 
                                           Math.max(lastQuestion, lastNewline));
                    
                    // Only use the break if it's at least 60% of desired size
                    if (bestBreak > start + chapterSize * 0.6) {
                        end = bestBreak + 1;
                    }
                }
                
                String chapterContent = content.substring(start, end).trim();
                if (!chapterContent.isEmpty() && chapterContent.length() > 100) {
                    chapters.add(new Chapter("Chương " + chapterNum, chapterContent, chapterNum));
                    Log.d(TAG, "Added chapter " + chapterNum + " (length: " + chapterContent.length() + ")");
                    chapterNum++;
                }
                start = end;
                
                // Safety check to avoid infinite loop
                if (start >= content.length()) {
                    break;
                }
            }
            
            Log.d(TAG, "Split by length into " + chapters.size() + " chapters");
        }
        
        // ALWAYS force split into multiple chapters if content is long enough
        Log.d(TAG, "Current chapters size: " + chapters.size() + ", content length: " + content.length());
        
        if (content.length() > 1500) {
            // ALWAYS split if we have 0 or 1 chapters
            if (chapters.size() <= 1) {
                Log.d(TAG, "FORCE SPLITTING: Content length " + content.length() + ", current chapters: " + chapters.size());
                chapters.clear();
                
                // Calculate optimal number of chapters (aim for 2000-3000 chars per chapter)
                int targetChapterSize = 2500;
                int partCount = Math.max(2, (int) Math.ceil((double) content.length() / targetChapterSize));
                partCount = Math.min(partCount, 10); // Max 10 chapters
                
                Log.d(TAG, "Calculated: splitting into " + partCount + " chapters (target size: " + targetChapterSize + ")");
                int partSize = content.length() / partCount;
                
                for (int i = 0; i < partCount; i++) {
                    int start = i * partSize;
                    int end = (i == partCount - 1) ? content.length() : (i + 1) * partSize;
                    
                    // Try to break at sentence boundary for better readability
                    if (i < partCount - 1 && end < content.length()) {
                        // Look for sentence endings within reasonable range
                        int searchStart = Math.max(start, end - partSize / 3);
                        int lastPeriod = content.lastIndexOf('.', end);
                        int lastExclamation = content.lastIndexOf('!', end);
                        int lastQuestion = content.lastIndexOf('?', end);
                        int lastNewline = content.lastIndexOf('\n', end);
                        
                        int bestBreak = Math.max(Math.max(lastPeriod, lastExclamation), 
                                               Math.max(lastQuestion, lastNewline));
                        
                        // Use the break if it's reasonable
                        if (bestBreak > searchStart) {
                            end = bestBreak + 1;
                            Log.d(TAG, "Chapter " + (i + 1) + " break at position " + end + " (sentence boundary)");
                        }
                    }
                    
                    String chapterContent = content.substring(start, end).trim();
                    if (!chapterContent.isEmpty()) {
                        chapters.add(new Chapter("Chương " + (i + 1), chapterContent, i + 1));
                        Log.d(TAG, "✓ Created chapter " + (i + 1) + ": length=" + chapterContent.length() + 
                              ", start=" + start + ", end=" + end);
                    } else {
                        Log.w(TAG, "⚠ Skipped empty chapter " + (i + 1));
                    }
                }
                Log.d(TAG, "✓✓✓ FORCE SPLIT COMPLETE: " + chapters.size() + " chapters created");
            } else {
                Log.d(TAG, "Pattern matching found " + chapters.size() + " chapters, keeping them");
            }
        } else {
            Log.d(TAG, "Content too short (" + content.length() + "), keeping as single chapter");
        }
        
        // Last resort: treat as single chapter only if content is very short
        if (chapters.isEmpty()) {
            chapters.add(new Chapter("Nội dung", content, 1));
            Log.d(TAG, "Added as single chapter (last resort, content too short: " + content.length() + ")");
        }
        
        // Final validation
        Log.d(TAG, "=== parseChaptersBySeparator END: " + chapters.size() + " chapters ===");
        if (chapters.size() == 1 && content.length() > 1500) {
            Log.e(TAG, "❌ ERROR: Only one chapter but content is long (" + content.length() + ")! This should not happen.");
        }
    }

    private void displayChapter(int index) {
        if (chapters.isEmpty()) {
            Log.e(TAG, "No chapters to display");
            showError("Không có chương nào để hiển thị");
            return;
        }
        
        if (index < 0 || index >= chapters.size()) {
            Log.e(TAG, "Invalid chapter index: " + index + ", total chapters: " + chapters.size());
            index = 0; // Default to first chapter
        }

        Chapter chapter = chapters.get(index);
        Log.d(TAG, "Displaying chapter " + (index + 1) + "/" + chapters.size() + ": " + chapter.title);
        
        // Display chapter title
        tvChapterTitle.setText(chapter.title);
        tvChapterTitle.setVisibility(View.VISIBLE);
        
        // Display ONLY this chapter's content
        tvContent.setText(chapter.content);
        
        // Update chapter info
        tvChapterInfo.setText(String.format("Chương %d / %d", index + 1, chapters.size()));
        tvChapterInfo.setVisibility(View.VISIBLE);
        
        // Update navigation buttons
        btnPreviousChapter.setVisibility(index > 0 ? View.VISIBLE : View.GONE);
        btnNextChapter.setVisibility(index < chapters.size() - 1 ? View.VISIBLE : View.GONE);
        layoutChapterNavigation.setVisibility(View.VISIBLE);
        
        // Update toolbar title
        if (getSupportActionBar() != null) {
            getSupportActionBar().setTitle(chapter.title);
        }
        
        tvError.setVisibility(View.GONE);
        scrollView.setVisibility(View.VISIBLE);
        
        // Scroll to top
        scrollToTop();
    }

    private void showLoading(boolean show) {
        progressBar.setVisibility(show ? View.VISIBLE : View.GONE);
        scrollView.setVisibility(show ? View.GONE : View.VISIBLE);
        if (show) {
            tvError.setVisibility(View.GONE);
            layoutChapterNavigation.setVisibility(View.GONE);
        }
    }

    private void showError(String message) {
        tvError.setText(message);
        tvError.setVisibility(View.VISIBLE);
        scrollView.setVisibility(View.GONE);
        layoutChapterNavigation.setVisibility(View.GONE);
    }

    private String getAuthHeader() {
        String token = prefManager.getToken();
        if (token == null || token.trim().isEmpty()) {
            return null;
        }
        return "Bearer " + token;
    }

    private void navigateToLogin() {
        prefManager.clear();
        startActivity(new Intent(this, LoginActivity.class));
        finish();
    }
}
