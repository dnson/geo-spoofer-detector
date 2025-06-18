const express = require('express');
const router = express.Router();

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
            clientIp: req.ip,
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
            clientIp: req.ip
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

// ==================== Utility Functions ====================

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
            age: age
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