const express = require('express');
const router = express.Router();
const { detectVPN, getVPNExplanation } = require('./vpn-detection');
const { 
    generateSessionFingerprint,
    fingerprintToText,
    generateEmbedding,
    initializeQdrantCollection,
    storeSessionFingerprint,
    findSimilarSessions,
    evaluateSimilarity
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
    try {
        const {
            screenResolution,
            colorDepth,
            touchSupport,
            webglRenderer,
            timezone,
            language,
            platform
        } = req.body;

        const analysis = analyzeEnvironment({
            screenResolution,
            colorDepth,
            touchSupport,
            webglRenderer,
            timezone,
            language,
            platform,
            userAgent: req.headers['user-agent']
        });

        res.json(analysis);
    } catch (error) {
        console.error('Environment analysis error:', error);
        res.status(500).json({ error: 'Failed to analyze environment' });
    }
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
        const { evaluateLite } = require('./session-fingerprint');
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

    // Check accuracy
    if (accuracy > 1000) {
        flags.push({ type: 'warning', message: 'Low location accuracy' });
        score -= 15;
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

    // Determine status
    let status = 'authentic';
    if (score < 60) status = 'likely_spoofed';
    else if (score < 80) status = 'suspicious';

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

function analyzeEnvironment(data) {
    const flags = [];
    let score = 100;
    let environmentType = 'local_desktop';

    // Check screen resolution
    if (data.screenResolution) {
        const { width, height } = data.screenResolution;
        const ratio = width / height;
        const commonRatios = [16/9, 16/10, 4/3, 21/9];
        const isCommon = commonRatios.some(r => Math.abs(ratio - r) < 0.01);
        
        if (!isCommon) {
            flags.push({ type: 'warning', message: 'Unusual screen aspect ratio' });
            score -= 20;
        }
    }

    // Check color depth
    if (data.colorDepth < 24) {
        flags.push({ type: 'warning', message: 'Low color depth (possible RDP)' });
        score -= 25;
    }

    // Check WebGL renderer
    if (data.webglRenderer) {
        const renderer = data.webglRenderer.toLowerCase();
        if (renderer.includes('vmware') || renderer.includes('virtualbox') || 
            renderer.includes('microsoft basic') || renderer.includes('llvmpipe')) {
            flags.push({ type: 'critical', message: 'Virtual display adapter detected' });
            score -= 40;
            environmentType = 'virtual_machine';
        }
    }

    // Check touch support anomalies
    if (data.touchSupport === false && data.platform && data.platform.includes('Android')) {
        flags.push({ type: 'warning', message: 'Android device without touch support' });
        score -= 30;
    }

    // Determine environment type
    if (score < 50) {
        environmentType = 'remote_desktop';
    } else if (score < 75) {
        environmentType = 'possibly_remote';
    }

    return {
        environmentType,
        score,
        flags,
        details: {
            screenResolution: data.screenResolution,
            colorDepth: data.colorDepth,
            webglRenderer: data.webglRenderer,
            platform: data.platform,
            timezone: data.timezone,
            language: data.language
        }
    };
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

function getTimezoneFromCoordinates(lat, lon) {
    // Simplified timezone estimation
    // In production, use a proper timezone API or library
    const longitude = parseFloat(lon);
    const timezoneOffset = Math.round(longitude / 15);
    return `UTC${timezoneOffset >= 0 ? '+' : ''}${timezoneOffset}`;
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

module.exports = router; 