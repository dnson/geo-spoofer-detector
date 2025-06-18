const { GoogleGenerativeAI } = require('@google/generative-ai');
const { QdrantClient } = require('@qdrant/js-client-rest');
const crypto = require('crypto');

// Initialize clients
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const qdrantClient = new QdrantClient({
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY
});

const COLLECTION_NAME = 'geo_spoofer_sessions';
const EMBEDDING_MODEL = 'text-embedding-004';

/**
 * Generate a comprehensive session fingerprint from detection data
 */
function generateSessionFingerprint(detectionData) {
    const {
        location,
        environment,
        network,
        timestamp,
        userAgent,
        clientIp,
        detectionResults
    } = detectionData;

    // Create a structured fingerprint
    const fingerprint = {
        sessionId: crypto.randomBytes(16).toString('hex'),
        timestamp: timestamp || new Date().toISOString(),
        
        // Location characteristics
        location: {
            coordinates: location?.coordinates || null,
            accuracy: location?.accuracy || null,
            responseTime: location?.responseTime || null,
            flags: location?.flags || [],
            vpnDetected: location?.vpnDetection?.isVPN || false,
            vpnConfidence: location?.vpnDetection?.confidence || 0
        },
        
        // Environment characteristics
        environment: {
            screenResolution: environment?.screenResolution || null,
            colorDepth: environment?.colorDepth || null,
            gpu: environment?.webglRenderer || null,
            touchSupport: environment?.touchSupport || null,
            platform: environment?.platform || null,
            timezone: environment?.timezone || null,
            language: environment?.language || null,
            flags: environment?.flags || []
        },
        
        // Network characteristics
        network: {
            clientIp: clientIp || null,
            userAgent: userAgent || null,
            webrtcIps: network?.webrtcIps || [],
            dnsTime: network?.dnsTime || null,
            navigatorProperties: network?.navigatorProperties || []
        },
        
        // Detection results summary
        summary: {
            locationScore: detectionResults?.locationScore || 0,
            environmentScore: detectionResults?.environmentScore || 0,
            overallRisk: calculateOverallRisk(detectionResults),
            spoofingIndicators: extractSpoofingIndicators(detectionResults)
        }
    };

    return fingerprint;
}

/**
 * Calculate overall risk score
 */
function calculateOverallRisk(detectionResults) {
    if (!detectionResults) return 'unknown';
    
    const locationScore = detectionResults.locationScore || 100;
    const environmentScore = detectionResults.environmentScore || 100;
    const avgScore = (locationScore + environmentScore) / 2;
    
    if (avgScore < 40) return 'high';
    if (avgScore < 70) return 'medium';
    return 'low';
}

/**
 * Extract key spoofing indicators
 */
function extractSpoofingIndicators(detectionResults) {
    const indicators = [];
    
    if (detectionResults?.locationFlags) {
        detectionResults.locationFlags.forEach(flag => {
            if (flag.type === 'fail' || flag.type === 'warning') {
                indicators.push(flag.message);
            }
        });
    }
    
    if (detectionResults?.environmentFlags) {
        detectionResults.environmentFlags.forEach(flag => {
            if (flag.type === 'fail' || flag.type === 'warning') {
                indicators.push(flag.message);
            }
        });
    }
    
    return indicators;
}

/**
 * Convert fingerprint to text for embedding
 */
function fingerprintToText(fingerprint) {
    const parts = [];
    
    // Location info
    if (fingerprint.location.coordinates) {
        parts.push(`Location: ${fingerprint.location.coordinates.latitude}, ${fingerprint.location.coordinates.longitude}`);
        parts.push(`Accuracy: ${fingerprint.location.accuracy}m`);
    }
    
    if (fingerprint.location.vpnDetected) {
        parts.push(`VPN detected with ${fingerprint.location.vpnConfidence}% confidence`);
    }
    
    // Environment info
    parts.push(`Platform: ${fingerprint.environment.platform}`);
    parts.push(`Screen: ${fingerprint.environment.screenResolution?.width}x${fingerprint.environment.screenResolution?.height}`);
    parts.push(`GPU: ${fingerprint.environment.gpu}`);
    
    // Network info
    parts.push(`User Agent: ${fingerprint.network.userAgent}`);
    if (fingerprint.network.webrtcIps.length > 0) {
        parts.push(`WebRTC IPs: ${fingerprint.network.webrtcIps.join(', ')}`);
    }
    
    // Summary
    parts.push(`Risk Level: ${fingerprint.summary.overallRisk}`);
    parts.push(`Location Score: ${fingerprint.summary.locationScore}`);
    parts.push(`Environment Score: ${fingerprint.summary.environmentScore}`);
    
    if (fingerprint.summary.spoofingIndicators.length > 0) {
        parts.push(`Spoofing Indicators: ${fingerprint.summary.spoofingIndicators.join('; ')}`);
    }
    
    return parts.join('\n');
}

/**
 * Generate embedding using Gemini
 */
async function generateEmbedding(text) {
    try {
        const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
        const result = await model.embedContent(text);
        return result.embedding.values;
    } catch (error) {
        console.error('Error generating embedding:', error);
        throw error;
    }
}

/**
 * Initialize Qdrant collection
 */
async function initializeQdrantCollection() {
    try {
        // Check if collection exists
        const collections = await qdrantClient.getCollections();
        const exists = collections.collections.some(c => c.name === COLLECTION_NAME);
        
        if (!exists) {
            // Create collection with appropriate vector size for Gemini embeddings
            await qdrantClient.createCollection(COLLECTION_NAME, {
                vectors: {
                    size: 768, // Gemini embedding size
                    distance: 'Cosine'
                }
            });
            console.log(`Created Qdrant collection: ${COLLECTION_NAME}`);
        }
    } catch (error) {
        console.error('Error initializing Qdrant collection:', error);
    }
}

/**
 * Store session fingerprint in Qdrant
 */
async function storeSessionFingerprint(fingerprint, embedding) {
    try {
        const point = {
            id: fingerprint.sessionId,
            vector: embedding,
            payload: fingerprint
        };
        
        await qdrantClient.upsert(COLLECTION_NAME, {
            wait: true,
            points: [point]
        });
        
        return fingerprint.sessionId;
    } catch (error) {
        console.error('Error storing fingerprint:', error);
        throw error;
    }
}

/**
 * Find similar sessions
 */
async function findSimilarSessions(embedding, limit = 5) {
    try {
        const searchResult = await qdrantClient.search(COLLECTION_NAME, {
            vector: embedding,
            limit: limit,
            with_payload: true
        });
        
        return searchResult;
    } catch (error) {
        console.error('Error searching similar sessions:', error);
        throw error;
    }
}

/**
 * Evaluate similarity with LLM
 */
async function evaluateSimilarity(currentSession, similarSessions) {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        
        const prompt = `
Analyze the following detection session and compare it with similar sessions found in the database.

Current Session:
${JSON.stringify(currentSession, null, 2)}

Similar Sessions Found:
${similarSessions.map((s, i) => `
Session ${i + 1} (Similarity Score: ${s.score}):
${JSON.stringify(s.payload, null, 2)}
`).join('\n')}

Please provide:
1. A risk assessment (High/Medium/Low) with explanation
2. Identified patterns across similar sessions
3. Specific spoofing techniques detected
4. Recommendations for action

Format your response as JSON.
`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();
        
        // Try to parse as JSON, fallback to text
        try {
            return JSON.parse(text);
        } catch {
            return { analysis: text };
        }
    } catch (error) {
        console.error('Error evaluating with LLM:', error);
        throw error;
    }
}

module.exports = {
    generateSessionFingerprint,
    fingerprintToText,
    generateEmbedding,
    initializeQdrantCollection,
    storeSessionFingerprint,
    findSimilarSessions,
    evaluateSimilarity
}; 