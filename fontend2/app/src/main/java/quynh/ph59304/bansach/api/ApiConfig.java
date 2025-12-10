package quynh.ph59304.bansach.api;

import quynh.ph59304.bansach.BuildConfig;

/**
 * Central place to resolve the API base URL so we can switch between
 * emulator/real-device endpoints without touching the source code.
 */
public final class ApiConfig {
    // private static final String FALLBACK_BASE_URL = "http://172.20.10.2:3000/"; // Dùng khi test trên thiết bị thật trong cùng mạng Wi-Fi
    private static final String FALLBACK_BASE_URL = "http://10.0.2.2:3000/"; // Dùng để test trên emulator

    private ApiConfig() {
    }

    /**
     * Returns the base URL that Retrofit should use. It always ends with a slash.
     */
    public static String getBaseUrl() {
        String configured = BuildConfig.BASE_URL;
        if (configured == null || configured.trim().isEmpty()) {
            configured = FALLBACK_BASE_URL;
        }
        configured = configured.trim();
        return configured.endsWith("/") ? configured : configured + "/";
    }

    /**
     * Returns the base origin (no trailing slash) for building absolute asset URLs.
     */
    private static String getBaseOrigin() {
        String base = getBaseUrl();
        return base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
    }

    /**
     * Converts a relative path (e.g. /uploads/avatar.png) into an absolute URL
     * using the configured base origin. Absolute URLs are returned unchanged.
     */
    public static String buildAbsoluteUrl(String maybeRelativePath) {
        if (maybeRelativePath == null || maybeRelativePath.isEmpty()) {
            return maybeRelativePath;
        }
        if (maybeRelativePath.startsWith("http")) {
            return maybeRelativePath;
        }
        String normalizedPath = maybeRelativePath.startsWith("/")
                ? maybeRelativePath
                : "/" + maybeRelativePath;
        return getBaseOrigin() + normalizedPath;
    }
}

