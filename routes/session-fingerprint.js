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
            coordinates: location?.coordinates || (location?.latitude && location?.longitude ? {
                latitude: location.latitude,
                longitude: location.longitude
            } : null),
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
            cpuCores: environment?.cpuCores || cpuCores,
            deviceMemory: environment?.deviceMemory || deviceMemory,
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
You are a security analyst specializing in location spoofing and remote access detection. Analyze the following detection session and compare it with similar sessions from our database.

Current Session:
${JSON.stringify(currentSession, null, 2)}

Similar Sessions Found:
${similarSessions.map((s, i) => `
Session ${i + 1} (Similarity Score: ${s.score}):
${JSON.stringify(s.payload, null, 2)}
`).join('\n')}

Provide a comprehensive analysis including:
1. Risk Assessment: Determine if this is HIGH, MEDIUM, or LOW risk based on:
   - Severity of spoofing indicators
   - Consistency with similar sessions
   - Likelihood of genuine vs. spoofed location

2. Pattern Analysis: Identify specific patterns such as:
   - Common spoofing techniques (VPN, browser extensions, developer tools)
   - Environmental inconsistencies (virtual machines, remote desktop)
   - Behavioral anomalies compared to legitimate users

3. Technical Indicators: Detail specific technical evidence:
   - GPS anomalies (speed of response, accuracy issues)
   - Network indicators (multiple IPs, VPN signatures)
   - Hardware/software mismatches

4. Confidence Score: Rate your confidence in the assessment (0-100%)

5. Actionable Recommendations: Provide specific actions such as:
   - Additional verification steps needed
   - Security measures to implement
   - User experience considerations

Format your response as JSON with the following structure:
{
  "riskAssessment": "HIGH/MEDIUM/LOW",
  "confidence": 85,
  "explanation": "Brief explanation of the risk assessment",
  "patterns": ["pattern1", "pattern2"],
  "technicalIndicators": {
    "location": ["indicator1", "indicator2"],
    "environment": ["indicator1", "indicator2"],
    "network": ["indicator1", "indicator2"]
  },
  "spoofingTechniques": ["technique1", "technique2"],
  "recommendations": ["recommendation1", "recommendation2"],
  "similarityInsights": "How this session compares to similar ones"
}
`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();
        
        // Try to parse as JSON, fallback to structured response
        try {
            return JSON.parse(text);
        } catch {
            // If JSON parsing fails, create structured response from text
            return {
                riskAssessment: "MEDIUM",
                confidence: 70,
                explanation: text,
                patterns: ["Unable to parse detailed patterns"],
                recommendations: ["Review raw analysis text for details"]
            };
        }
    } catch (error) {
        console.error('Error evaluating with LLM:', error);
        throw error;
    }
}

/**
 * Lite evaluation - faster analysis using pattern matching and embeddings
 */
async function evaluateLite(fingerprint, similarSessions) {
    try {
        // Calculate risk based on fingerprint data
        let riskScore = 0;
        let riskFactors = [];
        let patterns = [];
        
        // Check location indicators
        if (fingerprint.location.vpnDetected) {
            riskScore += 30;
            riskFactors.push('VPN/Proxy detected');
            patterns.push('Network anonymization tool usage');
        }
        
        if (fingerprint.location.accuracy > 1000) {
            riskScore += 15;
            riskFactors.push('Low GPS accuracy');
        }
        
        if (fingerprint.location.responseTime && fingerprint.location.responseTime < 10) {
            riskScore += 20;
            riskFactors.push('Suspiciously fast location response');
            patterns.push('Possible browser extension spoofing');
        }
        
        // Check environment indicators
        const gpu = fingerprint.environment.gpu?.toLowerCase() || '';
        if (gpu.includes('vmware') || gpu.includes('virtualbox') || gpu.includes('microsoft basic')) {
            riskScore += 25;
            riskFactors.push('Virtual machine detected');
            patterns.push('Virtualized environment');
        }
        
        if (fingerprint.environment.colorDepth < 24) {
            riskScore += 15;
            riskFactors.push('Low color depth (possible RDP)');
            patterns.push('Remote desktop connection');
        }
        
        // Analyze similar sessions
        let similarityInsights = '';
        if (similarSessions.length > 0) {
            const highRiskSimilar = similarSessions.filter(s => 
                s.payload?.summary?.overallRisk === 'high'
            ).length;
            
            const avgSimilarity = similarSessions.reduce((acc, s) => acc + s.score, 0) / similarSessions.length;
            
            if (highRiskSimilar > similarSessions.length / 2) {
                riskScore += 20;
                similarityInsights = `${highRiskSimilar} out of ${similarSessions.length} similar sessions were high risk`;
                patterns.push('Pattern matches known spoofing attempts');
            }
            
            if (avgSimilarity > 0.9) {
                patterns.push('Very high similarity to previous sessions');
                similarityInsights += `. Average similarity: ${(avgSimilarity * 100).toFixed(1)}%`;
            }
        }
        
        // Determine risk level
        let riskLevel = 'LOW';
        if (riskScore >= 60) riskLevel = 'HIGH';
        else if (riskScore >= 30) riskLevel = 'MEDIUM';
        
        // Generate recommendations based on risk
        const recommendations = [];
        if (riskLevel === 'HIGH') {
            recommendations.push('Require additional authentication');
            recommendations.push('Flag for manual review');
            recommendations.push('Consider blocking high-risk actions');
        } else if (riskLevel === 'MEDIUM') {
            recommendations.push('Monitor user behavior closely');
            recommendations.push('Enable enhanced logging');
            recommendations.push('Consider step-up authentication for sensitive actions');
        } else {
            recommendations.push('Standard security measures sufficient');
            recommendations.push('Continue normal monitoring');
        }
        
        // Use Gemini for quick insight if available
        let aiInsight = '';
        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
            const quickPrompt = `In one sentence, summarize the security risk for a user with: ${riskFactors.join(', ')}`;
            const result = await model.generateContent(quickPrompt);
            aiInsight = result.response.text().trim();
        } catch (error) {
            console.error('Error getting AI insight:', error);
            aiInsight = `Detected ${riskFactors.length} risk factors indicating ${riskLevel.toLowerCase()} probability of location spoofing`;
        }
        
        return {
            riskAssessment: riskLevel,
            riskScore: riskScore,
            confidence: Math.min(90, 50 + (riskFactors.length * 10)),
            explanation: aiInsight,
            riskFactors: riskFactors,
            patterns: patterns,
            recommendations: recommendations,
            similarityInsights: similarityInsights,
            processingTime: 'fast'
        };
        
    } catch (error) {
        console.error('Error in lite evaluation:', error);
        return {
            riskAssessment: 'UNKNOWN',
            riskScore: 0,
            confidence: 0,
            explanation: 'Error performing lite analysis',
            riskFactors: [],
            patterns: [],
            recommendations: ['Retry analysis or use full evaluation'],
            processingTime: 'error'
        };
    }
}

module.exports = {
    generateSessionFingerprint,
    fingerprintToText,
    generateEmbedding,
    initializeQdrantCollection,
    storeSessionFingerprint,
    findSimilarSessions,
    evaluateSimilarity,
    evaluateLite
}; 
