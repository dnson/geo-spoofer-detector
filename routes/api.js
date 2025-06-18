const express = require('express');
const router = express.Router();
const { detectVPN, getVPNExplanation } = require('./vpn-detection');
const { getThresholds } = require('./threshold-config');
const { 
    generateSessionFingerprint,
    fingerprintToText,
    generateEmbedding,
    initializeQdrantCollection,
    storeSessionFingerprint,
    findSimilarSessions,
    evaluateSimilarity,
    evaluateLite
} = require('./session-fingerprint');

// Initialize Qdrant collection on startup
initializeQdrantCollection().catch(console.error);

// Middleware to log API requests
router.use((req, res, next) => {
    console.log(`[API] ${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
});

// ==================== Location Verification API ====================

// Verify location authenticity
router.post('/location/verify', async (req, res) => {
    try {
        const { latitude, longitude, accuracy, timestamp } = req.body;
        
        console.log('[API] Location verify request:', {
            body: req.body,
            ip: req.ip,
            headers: req.headers
        });
        
        if (latitude === null || longitude === null) {
            // Handle case where location is not available
            return res.json({
                status: 'unable_to_verify',
                score: 0,
                flags: [
                    { type: 'fail', message: 'Location data not provided' }
                ],
                analysis: {
                    coordinates: null,
                    accuracy: null,
                    timestamp: new Date().toISOString(),
                    age: 0
                }
            });
        }
        
        if (!latitude || !longitude) {
            return res.status(400).json({ 
                error: 'Missing required location data' 
            });
        }

        // Perform location verification checks
        const verificationResult = await verifyLocation({
            latitude,
            longitude,
            accuracy,
            timestamp,
            clientIp: getClientIp(req),
            userAgent: req.headers['user-agent']
        });

        res.json(verificationResult);
    } catch (error) {
        console.error('Location verification error:', error);
        res.status(500).json({ error: 'Failed to verify location' });
    }
});

// Get location metadata
router.get('/location/metadata', async (req, res) => {
    try {
        const { lat, lon } = req.query;
        
        if (!lat || !lon) {
            return res.status(400).json({ 
                error: 'Missing latitude or longitude' 
            });
        }

        // In a real implementation, this would query a geolocation database
        const metadata = {
            coordinates: { latitude: parseFloat(lat), longitude: parseFloat(lon) },
            timezone: getTimezoneFromCoordinates(lat, lon),
            country: 'Unknown', // Would be determined by reverse geocoding
            region: 'Unknown',
            vpnProbability: calculateVPNProbability(req)
        };

        res.json(metadata);
    } catch (error) {
        console.error('Metadata error:', error);
        res.status(500).json({ error: 'Failed to get location metadata' });
    }
});

// ==================== Environment Detection API ====================

// Analyze client environment
router.post('/environment/analyze', async (req, res) => {
    const { 
        screenResolution, 
        colorDepth, 
        touchSupport, 
        webglRenderer,
        timezone,
        language,
        platform
    } = req.body;

    const flags = [];
    let score = 100;
    
    const thresholds = getThresholds();

    // Check for virtual machine indicators
    if (webglRenderer) {
        const renderer = webglRenderer.toLowerCase();
        if (renderer.includes('vmware') || renderer.includes('virtualbox')) {
            flags.push({ type: 'fail', message: 'Virtual machine detected' });
            score -= 50;
        }
    }

    // Check for RDP indicators
    if (colorDepth < thresholds.environment.colorDepth.rdpIndicator) {
        flags.push({ type: 'warning', message: 'Low color depth (possible RDP)' });
        score -= 25;
    }

    // Check for unusual resolutions
    const commonResolutions = [
        '1920x1080', '1366x768', '1440x900', '1536x864', '1280x720',
        '2560x1440', '3840x2160', '1680x1050', '1600x900', '1280x800'
    ];
    
    const resString = `${screenResolution.width}x${screenResolution.height}`;
    if (!commonResolutions.includes(resString)) {
        flags.push({ type: 'warning', message: 'Unusual screen resolution' });
        score -= 15;
    }

    // Determine environment type
    let environmentType = 'local_desktop';
    if (score < thresholds.environment.score.likelyRemote) {
        environmentType = 'remote_desktop';
    } else if (score < thresholds.environment.score.possiblyRemote) {
        environmentType = 'possibly_remote';
    }

    const analysis = {
        environmentType,
        score,
        flags,
        details: {
            screenResolution,
            colorDepth,
            touchSupport,
            webglRenderer,
            platform,
            timezone,
            language
        }
    };

    res.json(analysis);
});

// ==================== Detection History API ====================

// Store detection result
router.post('/detection/store', async (req, res) => {
    try {
        const { sessionId, results } = req.body;
        
        // In a real implementation, this would store in a database
        const stored = {
            id: generateId(),
            sessionId,
            results,
            timestamp: new Date().toISOString(),
            clientIp: getClientIp(req)
        };

        res.json({ 
            success: true, 
            detectionId: stored.id 
        });
    } catch (error) {
        console.error('Store detection error:', error);
        res.status(500).json({ error: 'Failed to store detection results' });
    }
});

// ==================== VPN Detection API ====================

// Check IP for VPN/Proxy
router.get('/vpn/check/:ip?', async (req, res) => {
    try {
        const ip = req.params.ip || getClientIp(req);
        
        if (!ip || ip === 'unknown') {
            return res.status(400).json({ 
                error: 'Unable to determine IP address' 
            });
        }
        
        const vpnResults = await detectVPN(ip);
        const explanation = getVPNExplanation(vpnResults);
        
        res.json({
            ip: ip,
            isVPN: vpnResults.isVPN,
            confidence: vpnResults.confidence,
            explanation: explanation,
            details: vpnResults.details
        });
    } catch (error) {
        console.error('VPN check error:', error);
        res.status(500).json({ error: 'Failed to check VPN status' });
    }
});

// ==================== Session Fingerprinting API ====================

// Store detection session for pattern analysis
router.post('/session/store', async (req, res) => {
    try {
        const detectionData = {
            location: req.body.location,
            environment: req.body.environment,
            network: req.body.network,
            timestamp: req.body.timestamp,
            userAgent: req.headers['user-agent'],
            clientIp: getClientIp(req),
            detectionResults: req.body.detectionResults
        };
        
        // Generate fingerprint
        const fingerprint = generateSessionFingerprint(detectionData);
        
        // Convert to text for embedding
        const fingerprintText = fingerprintToText(fingerprint);
        
        // Generate embedding
        const embedding = await generateEmbedding(fingerprintText);
        
        // Store in Qdrant
        const sessionId = await storeSessionFingerprint(fingerprint, embedding);
        
        res.json({
            success: true,
            sessionId: sessionId,
            fingerprint: fingerprint
        });
    } catch (error) {
        console.error('Session store error:', error);
        res.status(500).json({ error: 'Failed to store session fingerprint' });
    }
});

// Find similar sessions
router.post('/session/similar', async (req, res) => {
    try {
        const { sessionData, limit = 5 } = req.body;
        
        let embedding;
        
        if (sessionData) {
            // Generate fingerprint from provided data
            const detectionData = {
                location: sessionData.location,
                environment: sessionData.environment,
                network: sessionData.network,
                timestamp: sessionData.timestamp,
                userAgent: req.headers['user-agent'],
                clientIp: getClientIp(req),
                detectionResults: sessionData.detectionResults
            };
            
            const fingerprint = generateSessionFingerprint(detectionData);
            const fingerprintText = fingerprintToText(fingerprint);
            embedding = await generateEmbedding(fingerprintText);
        } else {
            return res.status(400).json({ error: 'Session data required' });
        }
        
        // Find similar sessions
        const similarSessions = await findSimilarSessions(embedding, limit);
        
        res.json({
            success: true,
            similarSessions: similarSessions
        });
    } catch (error) {
        console.error('Similar sessions error:', error);
        res.status(500).json({ error: 'Failed to find similar sessions' });
    }
});

// Evaluate session with LLM
router.post('/session/evaluate', async (req, res) => {
    try {
        const { currentSession, similarSessions } = req.body;
        
        if (!currentSession) {
            return res.status(400).json({ error: 'Current session data required' });
        }
        
        let sessions = similarSessions;
        
        // If no similar sessions provided, find them
        if (!sessions) {
            const detectionData = {
                location: currentSession.location,
                environment: currentSession.environment,
                network: currentSession.network,
                timestamp: currentSession.timestamp,
                userAgent: req.headers['user-agent'],
                clientIp: getClientIp(req),
                detectionResults: currentSession.detectionResults
            };
            
            const fingerprint = generateSessionFingerprint(detectionData);
            const fingerprintText = fingerprintToText(fingerprint);
            const embedding = await generateEmbedding(fingerprintText);
            sessions = await findSimilarSessions(embedding, 5);
        }
        
        // Evaluate with LLM
        const evaluation = await evaluateSimilarity(currentSession, sessions);
        
        res.json({
            success: true,
            evaluation: evaluation,
            similarSessionsCount: sessions.length
        });
    } catch (error) {
        console.error('Evaluation error:', error);
        res.status(500).json({ error: 'Failed to evaluate session' });
    }
});

// Lite analysis endpoint - faster evaluation with embeddings
router.post('/session/analyze-lite', async (req, res) => {
    try {
        const { sessionData } = req.body;
        
        if (!sessionData) {
            return res.status(400).json({ error: 'Session data required' });
        }
        
        // Generate detection data
        const detectionData = {
            location: sessionData.location,
            environment: sessionData.environment,
            network: sessionData.network,
            timestamp: sessionData.timestamp,
            userAgent: req.headers['user-agent'],
            clientIp: getClientIp(req),
            detectionResults: sessionData.detectionResults
        };
        
        // Generate fingerprint and embedding
        const fingerprint = generateSessionFingerprint(detectionData);
        const fingerprintText = fingerprintToText(fingerprint);
        const embedding = await generateEmbedding(fingerprintText);
        
        // Find similar sessions (limit to 3 for speed)
        const similarSessions = await findSimilarSessions(embedding, 3);
        
        // Perform lite evaluation
        const liteEvaluation = await evaluateLite(fingerprint, similarSessions);
        
        res.json({
            success: true,
            fingerprint: fingerprint,
            evaluation: liteEvaluation,
            similarSessions: similarSessions.map(s => ({
                score: s.score,
                risk: s.payload?.summary?.overallRisk,
                indicators: s.payload?.summary?.spoofingIndicators
            }))
        });
    } catch (error) {
        console.error('Lite analysis error:', error);
        res.status(500).json({ error: 'Failed to perform lite analysis' });
    }
});

// Get session analysis summary
router.get('/session/analysis/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        // This would retrieve the session from Qdrant by ID
        // For now, return a placeholder
        res.json({
            success: true,
            message: 'Session analysis endpoint - implement Qdrant retrieval by ID'
        });
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ error: 'Failed to get session analysis' });
    }
});

// Store grouped sessions (multiple detection runs)
router.post('/session/store-group', async (req, res) => {
    try {
        const { groupSessionId, sessions, metadata } = req.body;
        
        if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
            return res.status(400).json({ error: 'Sessions array is required' });
        }
        
        // Generate group session ID if not provided
        const groupId = groupSessionId || generateId();
        
        // Process each session in the group
        const processedSessions = [];
        const embeddings = [];
        
        for (const session of sessions) {
            // Add group reference to each session
            const enrichedSession = {
                ...session,
                groupSessionId: groupId,
                groupIndex: processedSessions.length
            };
            
            // Generate fingerprint if not already present
            const detectionData = {
                location: session.location,
                environment: session.environment,
                network: session.network,
                timestamp: session.timestamp,
                userAgent: req.headers['user-agent'],
                clientIp: getClientIp(req),
                detectionResults: {
                    locationScore: session.scores?.location || 0,
                    environmentScore: session.scores?.environment || 0,
                    locationFlags: session.locationFlags || [],
                    environmentFlags: session.environmentFlags || []
                }
            };
            
            const fingerprint = generateSessionFingerprint(detectionData);
            enrichedSession.fingerprint = session.fingerprint || fingerprint;
            
            // Generate embedding
            const fingerprintText = fingerprintToText(fingerprint);
            const embedding = await generateEmbedding(fingerprintText);
            
            embeddings.push(embedding);
            processedSessions.push(enrichedSession);
        }
        
        // Store each session in Qdrant
        const storedSessionIds = [];
        for (let i = 0; i < processedSessions.length; i++) {
            const sessionId = await storeSessionFingerprint(
                processedSessions[i].fingerprint,
                embeddings[i]
            );
            storedSessionIds.push(sessionId);
        }
        
        // Create group summary
        const groupSummary = {
            groupSessionId: groupId,
            timestamp: new Date().toISOString(),
            sessionCount: sessions.length,
            sessionIds: storedSessionIds,
            metadata: metadata || {},
            analysis: analyzeGroupedSessions(sessions),
            clientIp: getClientIp(req),
            userAgent: req.headers['user-agent']
        };
        
        // Store group summary (in a real app, this would go to a database)
        // For now, we'll include it in the response
        
        res.json({
            success: true,
            groupSessionId: groupId,
            sessionCount: sessions.length,
            storedSessionIds,
            groupSummary
        });
    } catch (error) {
        console.error('Group session store error:', error);
        res.status(500).json({ error: 'Failed to store grouped sessions' });
    }
});

// Store session with multiple detections as array
router.post('/session/store-multi', async (req, res) => {
    try {
        const { sessionId, startTime, endTime, detections, metadata, summary } = req.body;
        
        if (!detections || !Array.isArray(detections) || detections.length === 0) {
            return res.status(400).json({ error: 'Detections array is required' });
        }
        
        // Use provided sessionId or generate new one
        const finalSessionId = sessionId || generateId();
        
        // Process each detection
        const processedDetections = [];
        const embeddings = [];
        
        for (let i = 0; i < detections.length; i++) {
            const detection = detections[i];
            
            // Generate fingerprint for each detection
            const detectionData = {
                location: detection.location,
                environment: detection.environment,
                network: detection.network,
                timestamp: detection.timestamp || detection.detectionTimestamp,
                userAgent: req.headers['user-agent'],
                clientIp: getClientIp(req),
                detectionResults: {
                    locationScore: detection.scores?.location || 0,
                    environmentScore: detection.scores?.environment || 0,
                    locationFlags: detection.locationFlags || [],
                    environmentFlags: detection.environmentFlags || []
                }
            };
            
            const fingerprint = generateSessionFingerprint(detectionData);
            
            // Generate embedding
            const fingerprintText = fingerprintToText(fingerprint);
            const embedding = await generateEmbedding(fingerprintText);
            
            embeddings.push(embedding);
            processedDetections.push({
                ...detection,
                fingerprint: detection.fingerprint || fingerprint,
                detectionIndex: i,
                sessionId: finalSessionId
            });
        }
        
        // Store complete session in Qdrant with aggregated fingerprint
        const sessionFingerprint = {
            sessionId: finalSessionId,
            startTime: startTime || detections[0]?.timestamp,
            endTime: endTime || detections[detections.length - 1]?.timestamp,
            detectionCount: detections.length,
            metadata: metadata || {},
            summary: summary || analyzeGroupedSessions(detections),
            detections: processedDetections.map(d => ({
                index: d.detectionIndex,
                timestamp: d.timestamp || d.detectionTimestamp,
                scores: d.scores,
                fingerprint: d.fingerprint
            }))
        };
        
        // Generate session-level embedding (average of detection embeddings)
        const sessionEmbedding = embeddings[0].map((_, idx) => {
            const sum = embeddings.reduce((acc, emb) => acc + emb[idx], 0);
            return sum / embeddings.length;
        });
        
        // Store in Qdrant
        const storedId = await storeSessionFingerprint(sessionFingerprint, sessionEmbedding);
        
        res.json({
            success: true,
            sessionId: finalSessionId,
            storedId: storedId,
            detectionCount: detections.length,
            summary: sessionFingerprint.summary
        });
    } catch (error) {
        console.error('Multi-detection session store error:', error);
        res.status(500).json({ error: 'Failed to store multi-detection session' });
    }
});

// Retrieve session with multiple detections
router.get('/session/multi/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        // In a real implementation, this would:
        // 1. Retrieve session from Qdrant by sessionId
        // 2. Return the complete session with all detections
        
        res.json({
            success: true,
            sessionId,
            message: 'Multi-detection session retrieval - implement Qdrant retrieval'
        });
    } catch (error) {
        console.error('Session retrieval error:', error);
        res.status(500).json({ error: 'Failed to retrieve session' });
    }
});

// Retrieve grouped sessions
router.get('/session/group/:groupSessionId', async (req, res) => {
    try {
        const { groupSessionId } = req.params;
        
        // In a real implementation, this would:
        // 1. Retrieve group metadata from database
        // 2. Fetch all sessions belonging to this group from Qdrant
        // 3. Return the complete group data
        
        res.json({
            success: true,
            groupSessionId,
            message: 'Group retrieval endpoint - implement database/Qdrant retrieval'
        });
    } catch (error) {
        console.error('Group retrieval error:', error);
        res.status(500).json({ error: 'Failed to retrieve grouped sessions' });
    }
});

// Analyze grouped sessions for patterns
function analyzeGroupedSessions(sessions) {
    if (!sessions || sessions.length === 0) return null;
    
    const analysis = {
        totalSessions: sessions.length,
        timeSpan: null,
        locationVariance: {},
        scoreStatistics: {},
        flagFrequency: {},
        consistencyMetrics: {}
    };
    
    // Calculate time span
    const timestamps = sessions.map(s => new Date(s.timestamp).getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    analysis.timeSpan = {
        start: new Date(minTime).toISOString(),
        end: new Date(maxTime).toISOString(),
        durationMs: maxTime - minTime
    };
    
    // Analyze location variance
    const locations = sessions.map(s => s.location).filter(Boolean);
    if (locations.length > 0) {
        const lats = locations.map(l => l.latitude);
        const lons = locations.map(l => l.longitude);
        
        analysis.locationVariance = {
            latitude: {
                min: Math.min(...lats),
                max: Math.max(...lats),
                variance: calculateVariance(lats)
            },
            longitude: {
                min: Math.min(...lons),
                max: Math.max(...lons),
                variance: calculateVariance(lons)
            }
        };
    }
    
    // Analyze score statistics
    const scoreTypes = ['location', 'environment', 'network', 'overall'];
    scoreTypes.forEach(type => {
        const scores = sessions.map(s => s.scores?.[type] || 0);
        analysis.scoreStatistics[type] = {
            min: Math.min(...scores),
            max: Math.max(...scores),
            average: scores.reduce((a, b) => a + b, 0) / scores.length,
            variance: calculateVariance(scores)
        };
    });
    
    // Analyze flag frequency
    const allFlags = [];
    sessions.forEach(session => {
        ['locationFlags', 'environmentFlags', 'networkFlags'].forEach(flagType => {
            if (session[flagType]) {
                session[flagType].forEach(flag => {
                    allFlags.push({
                        type: flagType,
                        message: flag.message,
                        severity: flag.type
                    });
                });
            }
        });
    });
    
    // Count flag occurrences
    allFlags.forEach(flag => {
        const key = `${flag.type}:${flag.message}`;
        if (!analysis.flagFrequency[key]) {
            analysis.flagFrequency[key] = {
                count: 0,
                severity: flag.severity,
                type: flag.type,
                message: flag.message
            };
        }
        analysis.flagFrequency[key].count++;
    });
    
    // Calculate consistency metrics
    analysis.consistencyMetrics = {
        locationConsistent: analysis.locationVariance.latitude?.variance < 0.0001 &&
                           analysis.locationVariance.longitude?.variance < 0.0001,
        scoreStable: Object.values(analysis.scoreStatistics).every(stat => 
            stat.variance < 100
        ),
        flagsConsistent: Object.values(analysis.flagFrequency).every(flag =>
            flag.count === sessions.length || flag.count === 0
        )
    };
    
    return analysis;
}

// Helper function to calculate variance
function calculateVariance(numbers) {
    if (numbers.length === 0) return 0;
    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
}

// ==================== Utility Functions ====================

function getClientIp(req) {
    // Try various headers that might contain the real IP
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    
    if (req.headers['x-real-ip']) {
        return req.headers['x-real-ip'];
    }
    
    if (req.connection && req.connection.remoteAddress) {
        return req.connection.remoteAddress;
    }
    
    return req.ip || 'unknown';
}

async function verifyLocation(data) {
    const { latitude, longitude, accuracy, timestamp, clientIp, userAgent } = data;
    const flags = [];
    let score = 100;

    // Check for null island
    if (latitude === 0 && longitude === 0) {
        flags.push({ type: 'critical', message: 'Null Island coordinates detected' });
        score -= 50;
    }

    // Check for overly round coordinates
    if (Number.isInteger(latitude) && Number.isInteger(longitude)) {
        flags.push({ type: 'warning', message: 'Suspiciously round coordinates' });
        score -= 20;
    }

    // Check for suspicious patterns
    const thresholds = getThresholds();
    
    // Check accuracy
    if (accuracy > thresholds.location.accuracy.low) {
        flags.push({
            type: 'warning',
            message: 'Low location accuracy',
            explanation: `Accuracy of ${accuracy}m is above the ${thresholds.location.accuracy.low}m threshold`
        });
        score -= 30;
    }

    // Check timestamp freshness
    const age = Date.now() - timestamp;
    if (age > 60000) { // More than 1 minute old
        flags.push({ type: 'warning', message: 'Stale location data' });
        score -= 10;
    }
    
    // VPN Detection
    let vpnResults = null;
    if (clientIp && clientIp !== 'unknown') {
        try {
            vpnResults = await detectVPN(clientIp);
            if (vpnResults.isVPN) {
                const explanation = getVPNExplanation(vpnResults);
                flags.push({ 
                    type: 'warning', 
                    message: 'VPN/Proxy detected',
                    explanation: explanation
                });
                score -= 30;
                
                // Add specific service detections
                if (vpnResults.detections.some(d => d.isTor)) {
                    flags.push({ 
                        type: 'fail', 
                        message: 'Tor network detected',
                        explanation: 'Connection is routed through the Tor anonymity network. Location cannot be verified.'
                    });
                    score -= 20;
                }
                
                if (vpnResults.detections.some(d => d.fraudScore > 90)) {
                    flags.push({ 
                        type: 'fail', 
                        message: 'High-risk IP address',
                        explanation: 'This IP has been associated with fraudulent activity or abuse.'
                    });
                    score -= 20;
                }
            }
        } catch (error) {
            console.error('VPN detection error:', error);
            // Don't penalize if VPN detection fails
        }
    }

    // Determine status based on score
    let status = 'authentic';
    if (score < thresholds.location.score.likelySpoofed) status = 'likely_spoofed';
    else if (score < thresholds.location.score.suspicious) status = 'suspicious';

    return {
        status,
        score,
        flags,
        analysis: {
            coordinates: { latitude, longitude },
            accuracy,
            timestamp: new Date(timestamp).toISOString(),
            age: age,
            vpnDetection: vpnResults
        }
    };
}

function getTimezoneFromCoordinates(lat, lon) {
    // Simplified timezone estimation
    // In production, use a proper timezone API or library
    const longitude = parseFloat(lon);
    const timezoneOffset = Math.round(longitude / 15);
    return `UTC${timezoneOffset >= 0 ? '+' : ''}${timezoneOffset}`;
}

function calculateVPNProbability(req) {
    let probability = 0;
    
    // Check for common VPN/proxy headers
    const suspiciousHeaders = [
        'x-forwarded-for',
        'x-real-ip',
        'x-originating-ip',
        'x-forwarded',
        'forwarded-for',
        'client-ip'
    ];
    
    suspiciousHeaders.forEach(header => {
        if (req.headers[header]) {
            probability += 15;
        }
    });

    // Check user agent for automation tools
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    if (ua.includes('headless') || ua.includes('phantom') || ua.includes('selenium')) {
        probability += 30;
    }

    return Math.min(probability, 100);
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Get current thresholds
router.get('/thresholds', (req, res) => {
    const thresholds = getThresholds();
    res.json(thresholds);
});

// Update thresholds (admin only - add authentication in production)
router.put('/thresholds', (req, res) => {
    try {
        const { reloadThresholds } = require('./threshold-config');
        const fs = require('fs');
        const path = require('path');
        
        // Validate the threshold structure
        const newThresholds = req.body;
        
        // Basic validation
        if (!newThresholds.location || !newThresholds.environment || !newThresholds.vpn) {
            return res.status(400).json({ 
                error: 'Invalid threshold structure',
                message: 'Thresholds must include location, environment, and vpn sections'
            });
        }
        
        // Write to file
        const thresholdsPath = path.join(__dirname, '..', 'thresholds.json');
        fs.writeFileSync(thresholdsPath, JSON.stringify(newThresholds, null, 2));
        
        // Reload thresholds in memory
        reloadThresholds();
        
        res.json({ 
            success: true, 
            message: 'Thresholds updated successfully',
            thresholds: getThresholds()
        });
    } catch (error) {
        console.error('Error updating thresholds:', error);
        res.status(500).json({ 
            error: 'Failed to update thresholds',
            message: error.message
        });
    }
});

module.exports = router; 