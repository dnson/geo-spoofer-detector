/**
 * Detection Runner Module
 * Wraps all detection functionality into a single reusable function
 * that generates complete session objects
 */

window.DetectionRunner = (function() {
    
    /**
     * Session Manager - handles multiple detections in a single session
     */
    class SessionManager {
        constructor() {
            this.currentSession = null;
            this.isActive = false;
        }
        
        /**
         * Start a new session
         */
        startSession(metadata = {}) {
            this.currentSession = {
                sessionId: generateSessionId(),
                startTime: new Date().toISOString(),
                detections: [],
                metadata: metadata,
                isActive: true
            };
            this.isActive = true;
            return this.currentSession.sessionId;
        }
        
        /**
         * Add a detection to the current session
         */
        addDetection(detectionData) {
            if (!this.isActive || !this.currentSession) {
                throw new Error('No active session. Call startSession() first.');
            }
            
            // Add detection index and timestamp
            const detection = {
                ...detectionData,
                detectionIndex: this.currentSession.detections.length,
                detectionTimestamp: new Date().toISOString()
            };
            
            this.currentSession.detections.push(detection);
            return detection;
        }
        
        /**
         * End the current session and return the complete session data
         */
        endSession() {
            if (!this.isActive || !this.currentSession) {
                throw new Error('No active session to end.');
            }
            
            this.currentSession.endTime = new Date().toISOString();
            this.currentSession.isActive = false;
            this.currentSession.summary = this.generateSessionSummary();
            
            const completedSession = this.currentSession;
            this.currentSession = null;
            this.isActive = false;
            
            return completedSession;
        }
        
        /**
         * Get the current session without ending it
         */
        getCurrentSession() {
            return this.currentSession;
        }
        
        /**
         * Generate summary statistics for the session
         */
        generateSessionSummary() {
            if (!this.currentSession || this.currentSession.detections.length === 0) {
                return null;
            }
            
            const detections = this.currentSession.detections;
            const analysis = analyzeConsistency(detections);
            
            // Calculate average scores
            const scores = detections.map(d => d.scores || {});
            const avgScores = {
                location: Math.round(scores.reduce((sum, s) => sum + (s.location || 0), 0) / scores.length),
                environment: Math.round(scores.reduce((sum, s) => sum + (s.environment || 0), 0) / scores.length),
                network: Math.round(scores.reduce((sum, s) => sum + (s.network || 0), 0) / scores.length),
                overall: Math.round(scores.reduce((sum, s) => sum + (s.overall || 0), 0) / scores.length)
            };
            
            return {
                detectionCount: detections.length,
                timespan: {
                    start: this.currentSession.startTime,
                    end: this.currentSession.endTime || new Date().toISOString(),
                    durationMs: new Date(this.currentSession.endTime || Date.now()) - new Date(this.currentSession.startTime)
                },
                averageScores: avgScores,
                consistency: {
                    location: analysis.locationConsistency,
                    environment: analysis.environmentConsistency,
                    scoreVariance: analysis.scoreVariance,
                    inconsistencies: analysis.inconsistencies
                }
            };
        }
    }
    
    // Create a singleton session manager
    const sessionManager = new SessionManager();
    
    /**
     * Run a detection and add it to the current session
     * @param {Object} options - Options for the detection run
     * @param {boolean} options.autoSession - Automatically create session if none exists
     * @returns {Promise<Object>} Detection data (not a full session)
     */
    async function runDetectionInSession(options = {}) {
        const { autoSession = true, ...detectionOptions } = options;
        
        // Auto-start session if needed
        if (autoSession && !sessionManager.isActive) {
            sessionManager.startSession({ autoCreated: true });
        }
        
        if (!sessionManager.isActive) {
            throw new Error('No active session. Start a session first or use autoSession: true');
        }
        
        // Run the detection
        const detectionData = await runDetection(detectionOptions);
        
        // Add to current session
        sessionManager.addDetection(detectionData);
        
        return detectionData;
    }
    
    /**
     * Start a new detection session
     * @param {Object} metadata - Session metadata
     * @returns {string} Session ID
     */
    function startSession(metadata = {}) {
        return sessionManager.startSession(metadata);
    }
    
    /**
     * End the current detection session
     * @returns {Object} Complete session with all detections
     */
    function endSession() {
        return sessionManager.endSession();
    }
    
    /**
     * Get current session status
     * @returns {Object} Current session info or null
     */
    function getSessionStatus() {
        const session = sessionManager.getCurrentSession();
        if (!session) {
            return { active: false, sessionId: null, detectionCount: 0 };
        }
        
        return {
            active: sessionManager.isActive,
            sessionId: session.sessionId,
            detectionCount: session.detections.length,
            startTime: session.startTime,
            metadata: session.metadata
        };
    }
    
    /**
     * Run multiple detections in a single session
     * @param {number} count - Number of detections to run
     * @param {number} delay - Delay between detections in ms
     * @param {Object} options - Detection options
     * @returns {Promise<Object>} Complete session with all detections
     */
    async function runSessionWithMultipleDetections(count = 3, delay = 1000, options = {}) {
        const { metadata = {}, ...detectionOptions } = options;
        
        // Start a new session
        const sessionId = startSession({
            ...metadata,
            plannedDetections: count,
            delay: delay
        });
        
        console.log(`Started session ${sessionId} for ${count} detections`);
        
        // Run detections
        for (let i = 0; i < count; i++) {
            if (!options.silent) {
                console.log(`Running detection ${i + 1} of ${count} in session ${sessionId}`);
            }
            
            await runDetectionInSession({
                ...detectionOptions,
                autoSession: false
            });
            
            if (i < count - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        // End session and return complete data
        const completedSession = endSession();
        console.log(`Completed session ${sessionId} with ${completedSession.detections.length} detections`);
        
        return completedSession;
    }
    
    /**
     * Run a complete detection cycle and return a session object
     * @param {Object} options - Options for the detection run
     * @param {boolean} options.includeLocation - Whether to include location detection
     * @param {boolean} options.includeEnvironment - Whether to include environment detection
     * @param {boolean} options.includeNetwork - Whether to include network detection
     * @param {boolean} options.silent - Whether to suppress UI updates
     * @returns {Promise<Object>} Complete session object with all detection data
     */
    async function runDetection(options = {}) {
        const {
            includeLocation = true,
            includeEnvironment = true,
            includeNetwork = true,
            silent = false
        } = options;
        
        // Create a new detection state for this run
        const detectionState = {
            sessionId: generateSessionId(),
            timestamp: new Date().toISOString(),
            location: null,
            environment: {},
            network: {},
            locationFlags: [],
            environmentFlags: [],
            networkFlags: [],
            timestamps: [],
            checks: {
                location: [],
                environment: [],
                network: []
            }
        };
        
        // Helper to update checks for this run
        const updateLocalCheck = (category, checkId, status, result = '') => {
            const check = detectionState.checks[category].find(c => c.id === checkId);
            if (check) {
                check.status = status;
                check.result = result;
                check.timestamp = Date.now();
            } else {
                detectionState.checks[category].push({
                    id: checkId,
                    status,
                    result,
                    timestamp: Date.now()
                });
            }
        };
        
        try {
            // Environment Detection
            if (includeEnvironment) {
                if (!silent) console.log('Running environment detection...');
                
                // Touch support check
                updateLocalCheck('environment', 'touch-support', 'running');
                if (navigator.maxTouchPoints === 0 && 'ontouchstart' in window) {
                    detectionState.environmentFlags.push({
                        type: 'warning',
                        message: 'Touch events without touch support',
                        explanation: 'The browser reports touch event capabilities but no touch points are detected.'
                    });
                    updateLocalCheck('environment', 'touch-support', 'warning', 'No touch points');
                } else {
                    updateLocalCheck('environment', 'touch-support', 'pass', 'Consistent');
                }
                
                // Screen resolution
                detectionState.environment.screenResolution = {
                    width: window.screen.width,
                    height: window.screen.height,
                    ratio: (window.screen.width / window.screen.height).toFixed(2)
                };
                
                // Color depth
                detectionState.environment.colorDepth = window.screen.colorDepth;
                updateLocalCheck('environment', 'color-depth', 'running');
                if (window.screen.colorDepth < 24) {
                    detectionState.environmentFlags.push({
                        type: 'warning',
                        message: 'Low color depth (possible RDP)',
                        explanation: `Color depth: ${window.screen.colorDepth}-bit`
                    });
                    updateLocalCheck('environment', 'color-depth', 'warning', `${window.screen.colorDepth}-bit`);
                } else {
                    updateLocalCheck('environment', 'color-depth', 'pass', `${window.screen.colorDepth}-bit`);
                }
                
                // GPU detection
                updateLocalCheck('environment', 'gpu-check', 'running');
                try {
                    const canvas = document.createElement('canvas');
                    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                    if (gl) {
                        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                        if (debugInfo) {
                            const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                            detectionState.environment.webglRenderer = renderer;
                            
                            if (renderer.includes('VMware') || renderer.includes('VirtualBox')) {
                                detectionState.environmentFlags.push({
                                    type: 'fail',
                                    message: 'Virtual display adapter detected',
                                    explanation: `GPU: ${renderer}`
                                });
                                updateLocalCheck('environment', 'gpu-check', 'fail', 'Virtual GPU');
                            } else {
                                updateLocalCheck('environment', 'gpu-check', 'pass', 'Physical GPU');
                            }
                        }
                    }
                } catch (e) {
                    updateLocalCheck('environment', 'gpu-check', 'pass', 'Unable to check');
                }
                
                // Additional environment properties
                detectionState.environment.platform = navigator.platform;
                detectionState.environment.userAgent = navigator.userAgent;
                detectionState.environment.language = navigator.language;
                detectionState.environment.languages = navigator.languages;
                detectionState.environment.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                detectionState.environment.touchSupport = 'ontouchstart' in window;
                detectionState.environment.maxTouchPoints = navigator.maxTouchPoints;
            }
            
            // Location Detection
            if (includeLocation) {
                if (!silent) console.log('Running location detection...');
                
                const locationResult = await detectLocationAsync(detectionState, updateLocalCheck);
                if (locationResult) {
                    detectionState.location = locationResult;
                }
            }
            
            // Network Detection
            if (includeNetwork) {
                if (!silent) console.log('Running network detection...');
                
                // Navigator properties check
                updateLocalCheck('network', 'navigator-props', 'running');
                const suspiciousProperties = ['brave', 'globalPrivacyControl'];
                const foundProps = suspiciousProperties.filter(prop => prop in navigator);
                
                if (foundProps.length > 0) {
                    detectionState.networkFlags.push({
                        type: 'warning',
                        message: `Privacy extension properties detected`,
                        explanation: `Found: ${foundProps.join(', ')}`
                    });
                    updateLocalCheck('network', 'navigator-props', 'warning', foundProps.join(', '));
                } else {
                    updateLocalCheck('network', 'navigator-props', 'pass', 'Standard');
                }
                
                detectionState.network.navigatorProperties = foundProps;
                
                // WebRTC IP detection
                const webrtcIps = await detectWebRTCIPs(detectionState, updateLocalCheck);
                detectionState.network.webrtcIps = webrtcIps;
                
                // Connection info
                if ('connection' in navigator) {
                    detectionState.network.connection = {
                        effectiveType: navigator.connection.effectiveType,
                        downlink: navigator.connection.downlink,
                        rtt: navigator.connection.rtt
                    };
                }
            }
            
            // Time consistency check
            updateLocalCheck('environment', 'time-flow', 'running');
            for (let i = 0; i < 5; i++) {
                detectionState.timestamps.push({
                    js: Date.now(),
                    perf: performance.now()
                });
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            // Calculate scores
            detectionState.scores = calculateScores(detectionState);
            
            // Generate fingerprint
            detectionState.fingerprint = generateFingerprint(detectionState);
            
            return detectionState;
            
        } catch (error) {
            console.error('Detection error:', error);
            detectionState.error = error.message;
            return detectionState;
        }
    }
    
    /**
     * Detect location asynchronously
     */
    async function detectLocationAsync(detectionState, updateLocalCheck) {
        const thresholds = window.ThresholdsConfig.getThresholdsSync();
        
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                detectionState.locationFlags.push({
                    type: 'fail',
                    message: 'Geolocation API not available'
                });
                updateLocalCheck('location', 'geo-api', 'fail', 'Not available');
                resolve(null);
                return;
            }
            
            updateLocalCheck('location', 'geo-api', 'pass', 'Available');
            const startTime = performance.now();
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const duration = performance.now() - startTime;
                    
                    const locationData = {
                        coordinates: {
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude
                        },
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: position.timestamp,
                        responseTime: duration
                    };
                    
                    // Check response time
                    updateLocalCheck('location', 'response-time', 'running');
                    if (duration < thresholds.location.responseTime.suspicious) {
                        detectionState.locationFlags.push({
                            type: 'warning',
                            message: 'Location obtained suspiciously fast',
                            explanation: `Response time: ${duration.toFixed(1)}ms`
                        });
                        updateLocalCheck('location', 'response-time', 'warning', `${duration.toFixed(0)}ms`);
                    } else {
                        updateLocalCheck('location', 'response-time', 'pass', `${duration.toFixed(0)}ms`);
                    }
                    
                    // Check accuracy
                    updateLocalCheck('location', 'accuracy', 'running');
                    if (position.coords.accuracy > thresholds.location.accuracy.low) {
                        detectionState.locationFlags.push({
                            type: 'warning',
                            message: 'Low location accuracy',
                            explanation: `Accuracy: ±${Math.round(position.coords.accuracy)}m`
                        });
                        updateLocalCheck('location', 'accuracy', 'warning', `±${Math.round(position.coords.accuracy)}m`);
                    } else {
                        updateLocalCheck('location', 'accuracy', 'pass', `±${Math.round(position.coords.accuracy)}m`);
                    }
                    
                    resolve(locationData);
                },
                (error) => {
                    detectionState.locationFlags.push({
                        type: 'fail',
                        message: `Location error: ${error.message}`
                    });
                    updateLocalCheck('location', 'response-time', 'fail', 'Error');
                    updateLocalCheck('location', 'accuracy', 'fail', 'Error');
                    resolve(null);
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
     * Detect WebRTC IPs
     */
    async function detectWebRTCIPs(detectionState, updateLocalCheck) {
        updateLocalCheck('network', 'webrtc-ip', 'running');
        const ips = [];
        
        try {
            const pc = new RTCPeerConnection({
                iceServers: [{urls: 'stun:stun.l.google.com:19302'}]
            });
            
            pc.createDataChannel('');
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            await new Promise((resolve) => {
                const collectedIps = new Set();
                const timeout = setTimeout(() => {
                    pc.close();
                    resolve();
                }, 2000);
                
                pc.onicecandidate = (ice) => {
                    if (!ice || !ice.candidate || !ice.candidate.candidate) return;
                    
                    const candidate = ice.candidate.candidate;
                    const ipRegex = /([0-9]{1,3}\.){3}[0-9]{1,3}/g;
                    const matches = candidate.match(ipRegex);
                    
                    if (matches) {
                        matches.forEach(ip => {
                            collectedIps.add(ip);
                            ips.push(ip);
                        });
                    }
                };
            });
            
            // Check for private IPs
            const privateIps = ips.filter(ip => 
                ip.startsWith('10.') || 
                ip.startsWith('172.') || 
                ip.startsWith('192.168.')
            );
            
            if (privateIps.length > 0) {
                detectionState.networkFlags.push({
                    type: 'warning',
                    message: 'Private IP detected (possible VPN)',
                    explanation: `Private IPs: ${privateIps.join(', ')}`
                });
                updateLocalCheck('network', 'webrtc-ip', 'warning', 'Private IPs found');
            } else {
                updateLocalCheck('network', 'webrtc-ip', 'pass', `${ips.length} IPs found`);
            }
            
        } catch (e) {
            updateLocalCheck('network', 'webrtc-ip', 'pass', 'WebRTC disabled');
        }
        
        return ips;
    }
    
    /**
     * Calculate scores based on flags
     */
    function calculateScores(detectionState) {
        const thresholds = window.ThresholdsConfig.getThresholdsSync();
        
        let locationScore = 100;
        detectionState.locationFlags.forEach(flag => {
            if (flag.type === 'warning') locationScore -= thresholds.scoring.deductions.locationWarning;
            if (flag.type === 'fail') locationScore -= thresholds.scoring.deductions.locationFail;
        });
        
        let environmentScore = 100;
        detectionState.environmentFlags.forEach(flag => {
            if (flag.type === 'warning') environmentScore -= thresholds.scoring.deductions.environmentWarning;
            if (flag.type === 'fail') environmentScore -= thresholds.scoring.deductions.environmentFail;
        });
        
        let networkScore = 100;
        detectionState.networkFlags.forEach(flag => {
            if (flag.type === 'warning') networkScore -= 20;
            if (flag.type === 'fail') networkScore -= 40;
        });
        
        return {
            location: Math.max(0, locationScore),
            environment: Math.max(0, environmentScore),
            network: Math.max(0, networkScore),
            overall: Math.max(0, Math.round((locationScore + environmentScore + networkScore) / 3))
        };
    }
    
    /**
     * Generate a unique fingerprint for this session
     */
    function generateFingerprint(detectionState) {
        const fingerprintData = {
            sessionId: detectionState.sessionId,
            timestamp: detectionState.timestamp,
            scores: detectionState.scores,
            platform: detectionState.environment.platform,
            userAgent: detectionState.environment.userAgent,
            screenResolution: detectionState.environment.screenResolution,
            webglRenderer: detectionState.environment.webglRenderer,
            timezone: detectionState.environment.timezone,
            languages: detectionState.environment.languages,
            locationAccuracy: detectionState.location?.accuracy,
            webrtcIpCount: detectionState.network.webrtcIps?.length || 0
        };
        
        // Create a simple hash
        const str = JSON.stringify(fingerprintData);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        
        return Math.abs(hash).toString(36);
    }
    
    /**
     * Generate a unique session ID
     */
    function generateSessionId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * Analyze consistency across multiple sessions
     */
    function analyzeConsistency(sessions) {
        const analysis = {
            locationConsistency: true,
            environmentConsistency: true,
            scoreVariance: 0,
            inconsistencies: []
        };
        
        if (sessions.length < 2) return analysis;
        
        // Check location consistency
        const locations = sessions.map(s => s.location).filter(Boolean);
        if (locations.length > 1) {
            for (let i = 1; i < locations.length; i++) {
                const prevLoc = locations[i - 1];
                const currLoc = locations[i];
                
                // Check if coordinates changed significantly
                const latDiff = Math.abs(prevLoc.latitude - currLoc.latitude);
                const lonDiff = Math.abs(prevLoc.longitude - currLoc.longitude);
                
                if (latDiff > 0.0001 || lonDiff > 0.0001) {
                    analysis.locationConsistency = false;
                    analysis.inconsistencies.push({
                        type: 'location',
                        message: `Location changed between runs: ${latDiff.toFixed(6)}° lat, ${lonDiff.toFixed(6)}° lon`
                    });
                }
                
                // Check response time consistency
                if (prevLoc.responseTime && currLoc.responseTime) {
                    const timeDiff = Math.abs(prevLoc.responseTime - currLoc.responseTime);
                    if (timeDiff > 100) {
                        analysis.inconsistencies.push({
                            type: 'timing',
                            message: `Response time variance: ${timeDiff.toFixed(0)}ms`
                        });
                    }
                }
            }
        }
        
        // Check environment consistency
        const environments = sessions.map(s => s.environment);
        for (let i = 1; i < environments.length; i++) {
            const prev = environments[i - 1];
            const curr = environments[i];
            
            if (prev.webglRenderer !== curr.webglRenderer) {
                analysis.environmentConsistency = false;
                analysis.inconsistencies.push({
                    type: 'environment',
                    message: 'GPU renderer changed between runs'
                });
            }
        }
        
        // Calculate score variance
        const scores = sessions.map(s => s.scores.overall);
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        analysis.scoreVariance = Math.sqrt(
            scores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / scores.length
        );
        
        return analysis;
    }
    
    // Public API
    return {
        runDetection,
        runSessionWithMultipleDetections,
        generateSessionId,
        startSession,
        endSession,
        getSessionStatus,
        runDetectionInSession,
        
        // Backward compatibility - redirect to new method
        runMultipleDetections: async function(count = 3, delay = 1000, options = {}) {
            console.warn('runMultipleDetections is deprecated. Use runSessionWithMultipleDetections instead.');
            const session = await runSessionWithMultipleDetections(count, delay, options);
            // Transform to old format for compatibility
            return {
                sessions: session.detections,
                analysis: session.summary.consistency,
                summary: {
                    totalRuns: session.summary.detectionCount,
                    averageScores: session.summary.averageScores,
                    consistency: session.summary.consistency,
                    suspiciousPatterns: session.summary.consistency.inconsistencies.length > 0,
                    inconsistencyCount: session.summary.consistency.inconsistencies.length
                }
            };
        },
        
        // Store session with multiple detections
        storeSession: async function(session) {
            if (!window.storeSessionWithDetections) {
                // Fallback to grouped sessions API if available
                if (window.storeGroupedSessions) {
                    return await window.storeGroupedSessions(
                        session.detections,
                        session.metadata
                    );
                }
                console.warn('storeSessionWithDetections function not available');
                return null;
            }
            
            return await window.storeSessionWithDetections(session);
        }
    };
})(); 