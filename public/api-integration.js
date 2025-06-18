/**
 * API Integration Module for Geo Spoofer Detector
 * 
 * This module demonstrates how to integrate the frontend with the backend API.
 * To use this, include it in the HTML file and set USE_API to true.
 */

console.log('API Integration Module loading...');

const API_BASE_URL = window.location.origin + '/api';
const USE_API = true; // Set to true to use backend API

console.log('API_BASE_URL:', API_BASE_URL);
console.log('USE_API:', USE_API);

class GeoSpoofAPI {
    constructor() {
        this.baseUrl = API_BASE_URL;
    }

    /**
     * Verify location authenticity through the API
     */
    async verifyLocation(locationData) {
        console.log('Making API call to /api/location/verify', locationData);
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

            const result = await response.json();
            console.log('Location verify response:', result);
            return result;
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
        console.log('Making API call to /api/environment/analyze', environmentData);
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

            const result = await response.json();
            console.log('Environment analyze response:', result);
            return result;
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
    console.log('detectLocationWithAPI called');
    
    if (!navigator.geolocation) {
        window.detectionState.locationFlags.push({
            type: 'fail',
            message: 'Geolocation API not available'
        });
        return;
    }

    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                // Store location locally
                window.detectionState.location = {
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
                    window.detectionState.locationFlags = verificationResult.flags || [];
                    
                    // Get additional metadata
                    const metadata = await geoSpoofAPI.getLocationMetadata(
                        position.coords.latitude,
                        position.coords.longitude
                    );

                    if (metadata) {
                        window.detectionState.location.metadata = metadata;
                    }
                }

                resolve();
            },
            (error) => {
                window.detectionState.locationFlags.push({
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
    console.log('detectEnvironmentWithAPI called');
    
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
        window.detectionState.environmentFlags = analysisResult.flags || [];
        window.detectionState.environmentType = analysisResult.environmentType;
    }
}

/**
 * Store results after detection completes
 */
async function storeDetectionResultsAPI() {
    const sessionId = generateSessionId();
    const results = {
        location: window.detectionState.location,
        locationFlags: window.detectionState.locationFlags,
        environmentFlags: window.detectionState.environmentFlags,
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
    console.log('USE_API is true, setting up integration immediately');
    setupAPIIntegration();
}

function setupAPIIntegration() {
    console.log('Setting up API integration...');
    console.log('window.detectLocation exists:', !!window.detectLocation);
    console.log('window.detectEnvironment exists:', !!window.detectEnvironment);
    console.log('window.analyzeResults exists:', !!window.analyzeResults);
    
    // Override the original detectLocation function
    if (window.detectLocation) {
        console.log('Overriding detectLocation with API version');
        window.detectLocation = detectLocationWithAPI;
    }
    
    // Override the original detectEnvironment function  
    if (window.detectEnvironment) {
        console.log('Overriding detectEnvironment with API version');
        window.detectEnvironment = detectEnvironmentWithAPI;
    }
    
    // Add hook to store results after analysis
    if (window.analyzeResults) {
        console.log('Adding hook to analyzeResults');
        const originalAnalyzeResults = window.analyzeResults;
        window.analyzeResults = function() {
            originalAnalyzeResults();
            storeDetectionResultsAPI();
        };
    }
} 