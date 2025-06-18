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

// Reference to updateCheck function from main script
// const updateCheck = window.updateCheck || function() { console.warn('updateCheck not available'); };

/**
 * Enhanced location detection with API integration
 */
async function detectLocationWithAPI() {
    console.log('detectLocationWithAPI called');
    
    window.updateCheck('location', 'geo-api', 'running');
    if (!navigator.geolocation) {
        window.detectionState.locationFlags.push({
            type: 'fail',
            message: 'Geolocation API not available',
            explanation: 'Your browser does not support the Geolocation API. This may be an older browser or one with location services disabled at the system level.'
        });
        window.updateCheck('location', 'geo-api', 'fail', 'Not available');
        window.updateCheck('location', 'response-time', 'fail', 'N/A');
        window.updateCheck('location', 'accuracy', 'fail', 'N/A');
        window.updateCheck('location', 'null-island', 'fail', 'N/A');
        window.updateCheck('location', 'round-coords', 'fail', 'N/A');
        window.updateCheck('location', 'vpn-detection', 'fail', 'N/A');
        return;
    }
    
    window.updateCheck('location', 'geo-api', 'pass', 'Available');

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
                window.updateCheck('location', 'response-time', 'running');
                if (duration < 10) {
                    window.detectionState.locationFlags.push({
                        type: 'warning',
                        message: 'Location obtained suspiciously fast',
                        explanation: `Response time: ${duration.toFixed(1)}ms. Real GPS typically takes 100-1000ms. Very fast responses may indicate a location spoofing extension providing cached/fake coordinates.`
                    });
                    window.updateCheck('location', 'response-time', 'warning', `${duration.toFixed(0)}ms`);
                } else {
                    window.updateCheck('location', 'response-time', 'pass', `${duration.toFixed(0)}ms`);
                }
                
                // Check accuracy
                window.updateCheck('location', 'accuracy', 'running');
                if (position.coords.accuracy > 1000) {
                    window.detectionState.locationFlags.push({
                        type: 'warning',
                        message: 'Low location accuracy',
                        explanation: `Accuracy: ±${Math.round(position.coords.accuracy)}m. GPS typically provides 5-10m accuracy. High values suggest IP-based geolocation or poor GPS signal.`
                    });
                    window.updateCheck('location', 'accuracy', 'warning', `±${Math.round(position.coords.accuracy)}m`);
                } else {
                    window.updateCheck('location', 'accuracy', 'pass', `±${Math.round(position.coords.accuracy)}m`);
                }
                
                // Check for common spoofing coordinates
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                
                window.updateCheck('location', 'null-island', 'running');
                if (lat === 0 && lon === 0) {
                    window.detectionState.locationFlags.push({
                        type: 'fail',
                        message: 'Null Island coordinates detected',
                        explanation: 'Coordinates (0°, 0°) point to "Null Island" in the Atlantic Ocean. This is a common default value used by spoofing tools.'
                    });
                    window.updateCheck('location', 'null-island', 'fail', 'Detected');
                } else {
                    window.updateCheck('location', 'null-island', 'pass', 'Valid coords');
                }
                
                // Check for overly round numbers
                window.updateCheck('location', 'round-coords', 'running');
                if (lat % 1 === 0 && lon % 1 === 0) {
                    window.detectionState.locationFlags.push({
                        type: 'warning',
                        message: 'Suspiciously round coordinates',
                        explanation: `Coordinates are exact integers (${lat}°, ${lon}°). Real GPS coordinates typically have decimal precision. Round numbers suggest manual input or basic spoofing.`
                    });
                    window.updateCheck('location', 'round-coords', 'warning', 'Too round');
                } else {
                    window.updateCheck('location', 'round-coords', 'pass', 'Normal precision');
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
                    
                    // Perform VPN detection
                    window.updateCheck('location', 'vpn-detection', 'running');
                    try {
                        const vpnResponse = await fetch('/api/vpn/check');
                        const vpnData = await vpnResponse.json();
                        
                        if (vpnData.isVPN) {
                            window.detectionState.locationFlags.push({
                                type: 'warning',
                                message: 'VPN/Proxy detected',
                                explanation: vpnData.explanation
                            });
                            window.updateCheck('location', 'vpn-detection', 'warning', `${vpnData.confidence}% confidence`);
                        } else {
                            window.updateCheck('location', 'vpn-detection', 'pass', 'No VPN');
                        }
                    } catch (e) {
                        console.error('VPN check error:', e);
                        window.updateCheck('location', 'vpn-detection', 'pass', 'Unable to check');
                    }
                } else {
                    // API call failed, add a flag
                    window.detectionState.locationFlags.push({
                        type: 'warning',
                        message: 'Could not verify location with server'
                    });
                    window.updateCheck('location', 'vpn-detection', 'pass', 'API error');
                }

                resolve();
            },
            (error) => {
                console.error('Geolocation error:', error);
                
                let explanation = '';
                switch(error.code) {
                    case 1: // PERMISSION_DENIED
                        explanation = 'Location access was denied. Check your browser settings to allow location access for this site.';
                        break;
                    case 2: // POSITION_UNAVAILABLE
                        explanation = 'Unable to determine location. This can happen when GPS/WiFi positioning is unavailable or disabled.';
                        break;
                    case 3: // TIMEOUT
                        explanation = 'Location request timed out. This might indicate poor GPS signal or network issues.';
                        break;
                    default:
                        explanation = 'An unknown error occurred while trying to get your location.';
                }
                
                window.detectionState.locationFlags.push({
                    type: 'fail',
                    message: `Location error: ${error.message}`,
                    explanation: explanation
                });
                
                window.updateCheck('location', 'response-time', 'fail', 'Error');
                window.updateCheck('location', 'accuracy', 'fail', 'Error');
                window.updateCheck('location', 'null-island', 'fail', 'Error');
                window.updateCheck('location', 'round-coords', 'fail', 'Error');
                window.updateCheck('location', 'vpn-detection', 'fail', 'Error');
                
                // Still call the API even on error
                geoSpoofAPI.verifyLocation({
                    latitude: null,
                    longitude: null,
                    accuracy: null,
                    timestamp: Date.now(),
                    error: error.message
                }).then(async verificationResult => {
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
                    
                    // Still perform VPN check even on error
                    window.updateCheck('location', 'vpn-detection', 'running');
                    try {
                        const vpnResponse = await fetch('/api/vpn/check');
                        const vpnData = await vpnResponse.json();
                        
                        if (vpnData.isVPN) {
                            window.detectionState.locationFlags.push({
                                type: 'warning',
                                message: 'VPN/Proxy detected',
                                explanation: vpnData.explanation
                            });
                            window.updateCheck('location', 'vpn-detection', 'warning', `${vpnData.confidence}% confidence`);
                        } else {
                            window.updateCheck('location', 'vpn-detection', 'pass', 'No VPN');
                        }
                    } catch (e) {
                        console.error('VPN check error:', e);
                        window.updateCheck('location', 'vpn-detection', 'pass', 'Unable to check');
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
                }).then(async verificationResult => {
                    if (verificationResult) {
                        window.detectionState.locationFlags = [
                            { type: 'fail', message: 'Location not available' },
                            ...(verificationResult.flags || [])
                        ];
                    }
                    
                    // Still perform VPN check even without location
                    window.updateCheck('location', 'vpn-detection', 'running');
                    try {
                        const vpnResponse = await fetch('/api/vpn/check');
                        const vpnData = await vpnResponse.json();
                        
                        if (vpnData.isVPN) {
                            window.detectionState.locationFlags.push({
                                type: 'warning',
                                message: 'VPN/Proxy detected',
                                explanation: vpnData.explanation
                            });
                            window.updateCheck('location', 'vpn-detection', 'warning', `${vpnData.confidence}% confidence`);
                        } else {
                            window.updateCheck('location', 'vpn-detection', 'pass', 'No VPN');
                        }
                    } catch (e) {
                        console.error('VPN check error:', e);
                        window.updateCheck('location', 'vpn-detection', 'pass', 'Unable to check');
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
 * Store session fingerprint for pattern analysis
 */
async function storeSessionFingerprint() {
    try {
        // Show storing notification
        showNotification('Storing session fingerprint...', 'info');
        
        // Collect all detection data
        const sessionData = {
            location: window.detectionState.location,
            environment: {
                screenResolution: {
                    width: window.screen.width,
                    height: window.screen.height
                },
                colorDepth: window.screen.colorDepth,
                touchSupport: 'ontouchstart' in window,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                language: navigator.language,
                platform: navigator.platform,
                webglRenderer: getWebGLRenderer(),
                flags: window.detectionState.environmentFlags
            },
            network: {
                webrtcIps: collectWebRTCIPs(),
                navigatorProperties: detectNavigatorProperties()
            },
            timestamp: new Date().toISOString(),
            detectionResults: {
                locationScore: window.detectionState.verificationScore || calculateLocationScore(),
                environmentScore: window.detectionState.environmentScore || calculateEnvironmentScore(),
                locationFlags: window.detectionState.locationFlags,
                environmentFlags: window.detectionState.environmentFlags
            }
        };
        
        const response = await fetch(`${API_BASE_URL}/session/store`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(sessionData)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('Session fingerprint stored:', result.sessionId);
            
            // Store session ID for future reference
            window.lastSessionId = result.sessionId;
            
            // Show success notification
            showNotification(`Session stored! ID: ${result.sessionId.substring(0, 8)}...`, 'success');
            
            // Show pattern analysis card
            window.showPatternAnalysisCard();
            
            // Optionally show pattern analysis
            if (window.showPatternAnalysis) {
                await findSimilarSessions(sessionData);
            }
        } else {
            throw new Error(`Server returned ${response.status}`);
        }
    } catch (error) {
        console.error('Failed to store session fingerprint:', error);
        
        // Show error notification with helpful message
        if (error.message.includes('Failed to fetch')) {
            showNotification('Session storage skipped - Gemini/Qdrant not configured', 'warning');
        } else {
            showNotification('Failed to store session: ' + error.message, 'error');
        }
    }
}

/**
 * Show notification to user
 */
function showNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            transform: translateX(400px);
            transition: transform 0.3s ease;
            max-width: 300px;
        `;
        document.body.appendChild(notification);
    }
    
    // Set color based on type
    const colors = {
        info: '#3b82f6',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444'
    };
    
    notification.style.backgroundColor = colors[type] || colors.info;
    notification.textContent = message;
    
    // Show notification
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Hide after 4 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(400px)';
    }, 4000);
}

/**
 * Find similar sessions and show analysis
 */
async function findSimilarSessions(sessionData) {
    try {
        const response = await fetch(`${API_BASE_URL}/session/similar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sessionData, limit: 5 })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('Similar sessions found:', result.similarSessions);
            
            // Get LLM evaluation
            const evalResponse = await fetch(`${API_BASE_URL}/session/evaluate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    currentSession: sessionData,
                    similarSessions: result.similarSessions
                })
            });
            
            if (evalResponse.ok) {
                const evaluation = await evalResponse.json();
                displayPatternAnalysis(evaluation.evaluation, result.similarSessions);
            }
        }
    } catch (error) {
        console.error('Failed to find similar sessions:', error);
    }
}

/**
 * Helper functions for collecting additional data
 */
function getWebGLRenderer() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            }
        }
    } catch (e) {}
    return 'Unknown';
}

function collectWebRTCIPs() {
    // This would collect WebRTC IPs if available
    // Placeholder for now
    return [];
}

function detectNavigatorProperties() {
    const props = [];
    const suspiciousProperties = ['brave', 'globalPrivacyControl'];
    suspiciousProperties.forEach(prop => {
        if (prop in navigator) {
            props.push(prop);
        }
    });
    return props;
}

function calculateLocationScore() {
    let score = 100;
    window.detectionState.locationFlags.forEach(flag => {
        if (flag.type === 'warning') score -= 20;
        if (flag.type === 'fail') score -= 40;
    });
    return Math.max(0, score);
}

function calculateEnvironmentScore() {
    let score = 100;
    window.detectionState.environmentFlags.forEach(flag => {
        if (flag.type === 'warning') score -= 25;
        if (flag.type === 'fail') score -= 50;
    });
    return Math.max(0, score);
}

/**
 * Display pattern analysis in UI
 */
function displayPatternAnalysis(evaluation, similarSessions) {
    // This would update the UI to show pattern analysis
    // For now, log to console
    console.log('Pattern Analysis:', evaluation);
    console.log('Similar Sessions:', similarSessions);
    
    // You could create a new UI card or modal to display this information
    // For example:
    if (window.showPatternAnalysisUI) {
        window.showPatternAnalysisUI(evaluation, similarSessions);
    }
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
            
            // Store session fingerprint for pattern analysis
            storeSessionFingerprint();
        };
    }
} 