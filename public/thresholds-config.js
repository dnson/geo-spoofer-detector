/**
 * Frontend Thresholds Configuration
 * This module loads and manages thresholds for the frontend detection
 */

window.ThresholdsConfig = (function() {
    let thresholds = null;
    
    /**
     * Default thresholds (fallback)
     */
    const defaultThresholds = {
        location: {
            responseTime: { suspicious: 10 },
            accuracy: { low: 1000 },
            score: { likelySpoofed: 60, suspicious: 80 }
        },
        environment: {
            score: { likelyRemote: 50, possiblyRemote: 75 },
            colorDepth: { rdpIndicator: 24 }
        },
        scoring: {
            deductions: {
                locationWarning: 20,
                locationFail: 40,
                environmentWarning: 25,
                environmentFail: 50
            }
        }
    };
    
    /**
     * Load thresholds from server
     */
    async function loadThresholds() {
        try {
            const response = await fetch('/thresholds.json');
            if (response.ok) {
                thresholds = await response.json();
                console.log('Thresholds loaded from server');
            } else {
                console.warn('Failed to load thresholds from server, using defaults');
                thresholds = defaultThresholds;
            }
        } catch (error) {
            console.error('Error loading thresholds:', error);
            thresholds = defaultThresholds;
        }
        return thresholds;
    }
    
    /**
     * Get thresholds (load if not already loaded)
     */
    async function getThresholds() {
        if (!thresholds) {
            await loadThresholds();
        }
        return thresholds;
    }
    
    /**
     * Get thresholds synchronously (must be loaded first)
     */
    function getThresholdsSync() {
        return thresholds || defaultThresholds;
    }
    
    // Public API
    return {
        loadThresholds,
        getThresholds,
        getThresholdsSync
    };
})(); 