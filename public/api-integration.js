/**
 * API Integration Module for Geo Spoofer Detector
 * 
 * This module demonstrates how to integrate the frontend with the backend API.
 * To use this, include it in the HTML file and set USE_API to true.
 */

const API_BASE_URL = window.location.origin + '/api';
const USE_API = false; // Set to true to use backend API

class GeoSpoofAPI {
    constructor() {
        this.baseUrl = API_BASE_URL;
    }

    /**
     * Verify location authenticity through the API
     */
    async verifyLocation(locationData) {
        try {
            const response = await fetch(`${this.baseUrl}/location/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(locationData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Location verification error:', error);
            return null;
        }
    }

    /**
     * Get location metadata from the API
     */
    async getLocationMetadata(lat, lon) {
        try {
            const response = await fetch(
                `${this.baseUrl}/location/metadata?lat=${lat}&lon=${lon}`
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Metadata fetch error:', error);
            return null;
        }
    }

    /**
     * Analyze environment through the API
     */
    async analyzeEnvironment(environmentData) {
        try {
            const response = await fetch(`${this.baseUrl}/environment/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(environmentData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Environment analysis error:', error);
            return null;
        }
    }

    /**
     * Store detection results
     */
    async storeDetectionResults(sessionId, results) {
        try {
            const response = await fetch(`${this.baseUrl}/detection/store`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sessionId, results })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Store detection error:', error);
            return null;
        }
    }
}

// Initialize API client
const geoSpoofAPI = new GeoSpoofAPI();

/**
 * Enhanced location detection with API integration
 */
async function detectLocationWithAPI() {
    if (!USE_API) {
        return; // Use existing client-side detection
    }

    if (!navigator.geolocation) {
        detectionState.locationFlags.push({
            type: 'fail',
            message: 'Geolocation API not available'
        });
        return;
    }

    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                // Store location locally
                detectionState.location = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                };

                // Verify with API
                const verificationResult = await geoSpoofAPI.verifyLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                });

                if (verificationResult) {
                    // Use API results
                    detectionState.locationFlags = verificationResult.flags || [];
                    
                    // Get additional metadata
                    const metadata = await geoSpoofAPI.getLocationMetadata(
                        position.coords.latitude,
                        position.coords.longitude
                    );

                    if (metadata) {
                        detectionState.location.metadata = metadata;
                    }
                }

                resolve();
            },
            (error) => {
                detectionState.locationFlags.push({
                    type: 'fail',
                    message: `Location error: ${error.message}`
                });
                resolve();
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
}

/**
 * Enhanced environment detection with API integration
 */
async function detectEnvironmentWithAPI() {
    if (!USE_API) {
        return; // Use existing client-side detection
    }

    // Collect environment data
    const environmentData = {
        screenResolution: {
            width: window.screen.width,
            height: window.screen.height
        },
        colorDepth: window.screen.colorDepth,
        touchSupport: 'ontouchstart' in window,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        platform: navigator.platform
    };

    // Get WebGL renderer info
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                environmentData.webglRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            }
        }
    } catch (e) {}

    // Send to API for analysis
    const analysisResult = await geoSpoofAPI.analyzeEnvironment(environmentData);

    if (analysisResult) {
        detectionState.environmentFlags = analysisResult.flags || [];
        detectionState.environmentType = analysisResult.environmentType;
    }
}

/**
 * Store results after detection completes
 */
async function storeDetectionResultsAPI() {
    if (!USE_API) {
        return;
    }

    const sessionId = generateSessionId();
    const results = {
        location: detectionState.location,
        locationFlags: detectionState.locationFlags,
        environmentFlags: detectionState.environmentFlags,
        timestamp: new Date().toISOString()
    };

    const storeResult = await geoSpoofAPI.storeDetectionResults(sessionId, results);
    
    if (storeResult && storeResult.success) {
        console.log('Detection results stored:', storeResult.detectionId);
    }
}

/**
 * Generate a unique session ID
 */
function generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Override the original detection functions if API is enabled
 */
if (USE_API) {
    console.log('API integration enabled');
    
    // Override the original detectLocation function
    window.detectLocation = detectLocationWithAPI;
    
    // Override the original detectEnvironment function  
    window.detectEnvironment = detectEnvironmentWithAPI;
    
    // Add hook to store results after analysis
    const originalAnalyzeResults = window.analyzeResults;
    window.analyzeResults = function() {
        originalAnalyzeResults();
        storeDetectionResultsAPI();
    };
} 