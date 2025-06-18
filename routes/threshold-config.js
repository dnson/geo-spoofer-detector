const fs = require('fs');
const path = require('path');

let thresholds = null;

/**
 * Load thresholds from JSON file
 */
function loadThresholds() {
    try {
        const thresholdsPath = path.join(__dirname, '..', 'thresholds.json');
        const data = fs.readFileSync(thresholdsPath, 'utf8');
        thresholds = JSON.parse(data);
        console.log('Thresholds loaded successfully');
        return thresholds;
    } catch (error) {
        console.error('Error loading thresholds.json:', error);
        // Return default thresholds if file can't be loaded
        return getDefaultThresholds();
    }
}

/**
 * Get default thresholds (fallback)
 */
function getDefaultThresholds() {
    return {
        location: {
            responseTime: { suspicious: 10 },
            accuracy: { low: 1000 },
            score: { likelySpoofed: 60, suspicious: 80 }
        },
        environment: {
            score: { likelyRemote: 50, possiblyRemote: 75 },
            colorDepth: { rdpIndicator: 24 }
        },
        vpn: {
            confidence: { detected: 50 }
        },
        riskAssessment: {
            averageScore: { high: 40, medium: 70 },
            riskScore: { high: 60, medium: 30 }
        },
        patternAnalysis: {
            vpnRiskBonus: 30,
            lowAccuracyBonus: 15,
            fastResponseBonus: 20,
            vmDetectionBonus: 25,
            lowColorDepthBonus: 15,
            highRiskSimilarBonus: 20,
            similarityThreshold: 0.9
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
}

/**
 * Get thresholds (load if not already loaded)
 */
function getThresholds() {
    if (!thresholds) {
        thresholds = loadThresholds();
    }
    return thresholds;
}

/**
 * Reload thresholds from file
 */
function reloadThresholds() {
    thresholds = loadThresholds();
    return thresholds;
}

/**
 * Watch for changes to thresholds file
 */
function watchThresholdsFile() {
    const thresholdsPath = path.join(__dirname, '..', 'thresholds.json');
    
    fs.watchFile(thresholdsPath, (curr, prev) => {
        console.log('Thresholds file changed, reloading...');
        reloadThresholds();
    });
}

// Initialize on module load
loadThresholds();
watchThresholdsFile();

module.exports = {
    getThresholds,
    reloadThresholds
}; 