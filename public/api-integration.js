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
        const startTime = performance.now();
        
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const endTime = performance.now();
                const duration = endTime - startTime;
                
                console.log('Geolocation success:', position);
                
                // Store location locally
                window.detectionState.location = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                };
                
                console.log('Location stored in detectionState:', window.detectionState.location);
                
                // Check for suspiciously fast response (client-side check)
                if (duration < 10) {
                    window.detectionState.locationFlags.push({
                        type: 'warning',
                        message: 'Location obtained suspiciously fast'
                    });
                }

                // Verify with API
                const locationData = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                };
                
                console.log('Sending location data to API:', locationData);
                
                const verificationResult = await geoSpoofAPI.verifyLocation(locationData);

                if (verificationResult) {
                    // Merge API results with existing flags
                    if (verificationResult.flags && verificationResult.flags.length > 0) {
                        window.detectionState.locationFlags = [
                            ...window.detectionState.locationFlags,
                            ...verificationResult.flags
                        ];
                    }
                    
                    // Store the verification status
                    window.detectionState.verificationStatus = verificationResult.status;
                    window.detectionState.verificationScore = verificationResult.score;
                    
                    // Get additional metadata
                    const metadata = await geoSpoofAPI.getLocationMetadata(
                        position.coords.latitude,
                        position.coords.longitude
                    );

                    if (metadata) {
                        window.detectionState.location.metadata = metadata;
                    }
                } else {
                    // API call failed, add a flag
                    window.detectionState.locationFlags.push({
                        type: 'warning',
                        message: 'Could not verify location with server'
                    });
                }

                resolve();
            },
            (error) => {
                console.error('Geolocation error:', error);
                window.detectionState.locationFlags.push({
                    type: 'fail',
                    message: `Location error: ${error.message}`
                });
                
                // Still call the API even on error
                geoSpoofAPI.verifyLocation({
                    latitude: null,
                    longitude: null,
                    accuracy: null,
                    timestamp: Date.now(),
                    error: error.message
                }).then(verificationResult => {
                    console.log('API response for location error:', verificationResult);
                    if (verificationResult) {
                        // Store the verification status
                        window.detectionState.verificationStatus = verificationResult.status;
                        window.detectionState.verificationScore = verificationResult.score;
                        
                        // Merge flags
                        if (verificationResult.flags && verificationResult.flags.length > 0) {
                            window.detectionState.locationFlags = [
                                ...window.detectionState.locationFlags,
                                ...verificationResult.flags
                            ];
                        }
                    }
                });
                
                resolve();
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
        
        // Add a timeout fallback
        setTimeout(() => {
            if (!window.detectionState.location) {
                console.log('Geolocation timed out, using API without location data');
                // Still call the API even without location data
                geoSpoofAPI.verifyLocation({
                    latitude: null,
                    longitude: null,
                    accuracy: null,
                    timestamp: Date.now()
                }).then(verificationResult => {
                    if (verificationResult) {
                        window.detectionState.locationFlags = [
                            { type: 'fail', message: 'Location not available' },
                            ...(verificationResult.flags || [])
                        ];
                    }
                });
                resolve();
            }
        }, 5000);
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
        // Merge API results with existing flags
        if (analysisResult.flags && analysisResult.flags.length > 0) {
            window.detectionState.environmentFlags = [
                ...window.detectionState.environmentFlags,
                ...analysisResult.flags
            ];
        }
        window.detectionState.environmentType = analysisResult.environmentType;
        window.detectionState.environmentScore = analysisResult.score;
    } else {
        // API call failed, add a flag
        window.detectionState.environmentFlags.push({
            type: 'warning',
            message: 'Could not analyze environment with server'
        });
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
            // Call original function first
            originalAnalyzeResults();
            
            // Override location status if we have API verification results
            if (window.detectionState.verificationStatus) {
                const locationStatus = document.getElementById('locationStatus');
                const coordinates = document.getElementById('coordinates');
                
                // Map API status to UI status
                let statusText = 'Authentic';
                let statusClass = 'status-authentic';
                
                switch (window.detectionState.verificationStatus) {
                    case 'likely_spoofed':
                        statusText = 'Likely Spoofed';
                        statusClass = 'status-spoofed';
                        break;
                    case 'suspicious':
                        statusText = 'Suspicious';
                        statusClass = 'status-suspicious';
                        break;
                    case 'unable_to_verify':
                        statusText = 'Unable to Verify';
                        statusClass = 'status-spoofed';
                        break;
                    case 'authentic':
                    default:
                        statusText = 'Authentic';
                        statusClass = 'status-authentic';
                        break;
                }
                
                // Use API score if location not available
                if (!window.detectionState.location && window.detectionState.verificationScore !== undefined) {
                    const score = window.detectionState.verificationScore;
                    if (score < 60) {
                        statusText = 'Likely Spoofed';
                        statusClass = 'status-spoofed';
                    } else if (score < 80) {
                        statusText = 'Suspicious';
                        statusClass = 'status-suspicious';
                    }
                }
                
                locationStatus.textContent = statusText;
                locationStatus.className = `status-badge ${statusClass}`;
            }
            
            // Override environment status if we have API results
            if (window.detectionState.environmentType) {
                const environmentStatus = document.getElementById('environmentStatus');
                
                let statusText = 'Local Desktop';
                let statusClass = 'status-authentic';
                
                switch (window.detectionState.environmentType) {
                    case 'remote_desktop':
                        statusText = 'Remote Desktop';
                        statusClass = 'status-spoofed';
                        break;
                    case 'possibly_remote':
                        statusText = 'Possibly Remote';
                        statusClass = 'status-suspicious';
                        break;
                    case 'virtual_machine':
                        statusText = 'Virtual Machine';
                        statusClass = 'status-spoofed';
                        break;
                    case 'local_desktop':
                    default:
                        statusText = 'Local Desktop';
                        statusClass = 'status-authentic';
                        break;
                }
                
                environmentStatus.textContent = statusText;
                environmentStatus.className = `status-badge ${statusClass}`;
            }
            
            console.log('Final detectionState after analysis:', window.detectionState);
            storeDetectionResultsAPI();
        };
    }
} 