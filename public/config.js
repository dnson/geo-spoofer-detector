// Production Configuration for Geo Spoofer Detector
window.GEO_DETECTOR_CONFIG = {
    // Environment detection
    isProduction: () => {
        return !['localhost', '127.0.0.1'].includes(window.location.hostname);
    },
    
    // API endpoints (can be environment-specific)
    API_BASE_URL: window.location.origin + '/api',
    
    // Feature flags
    features: {
        // Core features
        USE_API: true,
        USE_MOCK_DATA: false,
        
        // Detection methods
        WEBRTC_CHECK: true,
        DNS_TIMING_CHECK: false, // Noisy in production
        NAVIGATOR_PROPERTIES_CHECK: true,
        TIMEZONE_CHECK: true,
        
        // Enhanced features for production
        IP_GEOLOCATION: true,
        BROWSER_FINGERPRINTING: false, // Privacy concern
        
        // Analytics (if needed)
        ANALYTICS_ENABLED: false
    },
    
    // Rate limiting
    rateLimits: {
        MAX_DETECTIONS_PER_SESSION: 10,
        COOLDOWN_MS: 30000 // 30 seconds between detections
    },
    
    // Logging configuration
    logging: {
        // Log levels: 'debug', 'info', 'warn', 'error', 'none'
        level: () => window.GEO_DETECTOR_CONFIG.isProduction() ? 'error' : 'debug',
        
        // Custom logger
        log: function(level, ...args) {
            const currentLevel = typeof this.level === 'function' ? this.level() : this.level;
            const levels = ['debug', 'info', 'warn', 'error', 'none'];
            const currentLevelIndex = levels.indexOf(currentLevel);
            const messageLevelIndex = levels.indexOf(level);
            
            if (messageLevelIndex >= currentLevelIndex) {
                console[level] ? console[level](...args) : console.log(...args);
            }
        }
    },
    
    // Privacy settings
    privacy: {
        // Don't store sensitive data
        STORE_LOCATION: false,
        ANONYMIZE_IP: true,
        
        // Data retention
        SESSION_TIMEOUT_MS: 30 * 60 * 1000 // 30 minutes
    }
};

// Convenience logging methods
window.GEO_DETECTOR_CONFIG.debug = (...args) => 
    window.GEO_DETECTOR_CONFIG.logging.log('debug', ...args);
window.GEO_DETECTOR_CONFIG.info = (...args) => 
    window.GEO_DETECTOR_CONFIG.logging.log('info', ...args);
window.GEO_DETECTOR_CONFIG.warn = (...args) => 
    window.GEO_DETECTOR_CONFIG.logging.log('warn', ...args);
window.GEO_DETECTOR_CONFIG.error = (...args) => 
    window.GEO_DETECTOR_CONFIG.logging.log('error', ...args); 