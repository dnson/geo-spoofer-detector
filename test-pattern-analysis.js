const axios = require('axios');

// Test server URL
const BASE_URL = process.env.API_URL || 'http://localhost:3000';

// Sample session data
const sampleSessionData = {
    location: {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 15,
        timestamp: Date.now()
    },
    environment: {
        screenResolution: { width: 1920, height: 1080 },
        colorDepth: 24,
        touchSupport: false,
        webglRenderer: 'NVIDIA GeForce GTX 1080',
        timezone: 'America/Los_Angeles',
        language: 'en-US',
        platform: 'Win32'
    },
    detectionResults: {
        locationScore: 80,
        environmentScore: 90,
        locationFlags: [
            { type: 'warning', message: 'VPN/Proxy detected' }
        ],
        environmentFlags: []
    }
};

// Test spoofed session data
const spoofedSessionData = {
    location: {
        latitude: 0,
        longitude: 0,
        accuracy: 5000,
        timestamp: Date.now()
    },
    environment: {
        screenResolution: { width: 1920, height: 1080 },
        colorDepth: 16,
        touchSupport: false,
        webglRenderer: 'VMware SVGA 3D',
        timezone: 'UTC',
        language: 'en-US',
        platform: 'Win32'
    },
    detectionResults: {
        locationScore: 20,
        environmentScore: 30,
        locationFlags: [
            { type: 'fail', message: 'Null Island coordinates detected' },
            { type: 'warning', message: 'Low location accuracy' }
        ],
        environmentFlags: [
            { type: 'fail', message: 'Virtual display adapter detected' },
            { type: 'warning', message: 'Low color depth (possible RDP)' }
        ]
    }
};

async function testLiteAnalysis(sessionData, label) {
    console.log(`\n🔬 Testing Lite Analysis - ${label}`);
    console.log('=' .repeat(50));
    
    try {
        const response = await axios.post(`${BASE_URL}/api/session/analyze-lite`, {
            sessionData
        });
        
        const { evaluation, similarSessions } = response.data;
        
        console.log(`✅ Risk Assessment: ${evaluation.riskAssessment}`);
        console.log(`📊 Risk Score: ${evaluation.riskScore}/100`);
        console.log(`🎯 Confidence: ${evaluation.confidence}%`);
        console.log(`⚡ Processing Time: ${evaluation.processingTime}`);
        console.log(`\n💬 Explanation: ${evaluation.explanation}`);
        
        if (evaluation.riskFactors && evaluation.riskFactors.length > 0) {
            console.log('\n⚠️  Risk Factors:');
            evaluation.riskFactors.forEach(factor => console.log(`   - ${factor}`));
        }
        
        if (evaluation.patterns && evaluation.patterns.length > 0) {
            console.log('\n🔍 Patterns Detected:');
            evaluation.patterns.forEach(pattern => console.log(`   - ${pattern}`));
        }
        
        if (evaluation.recommendations && evaluation.recommendations.length > 0) {
            console.log('\n📋 Recommendations:');
            evaluation.recommendations.forEach(rec => console.log(`   - ${rec}`));
        }
        
        if (similarSessions && similarSessions.length > 0) {
            console.log(`\n🔗 Found ${similarSessions.length} similar sessions`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

async function testFullAnalysis(sessionData, label) {
    console.log(`\n🧠 Testing Full Analysis - ${label}`);
    console.log('=' .repeat(50));
    
    try {
        // First find similar sessions
        const similarResponse = await axios.post(`${BASE_URL}/api/session/similar`, {
            sessionData,
            limit: 3
        });
        
        // Then evaluate
        const evalResponse = await axios.post(`${BASE_URL}/api/session/evaluate`, {
            currentSession: sessionData,
            similarSessions: similarResponse.data.similarSessions
        });
        
        const evaluation = evalResponse.data.evaluation;
        
        console.log(`✅ Risk Assessment: ${evaluation.riskAssessment}`);
        console.log(`🎯 Confidence: ${evaluation.confidence}%`);
        console.log(`\n💬 Explanation: ${evaluation.explanation}`);
        
        if (evaluation.technicalIndicators) {
            console.log('\n🔧 Technical Indicators:');
            Object.entries(evaluation.technicalIndicators).forEach(([category, indicators]) => {
                if (indicators && indicators.length > 0) {
                    console.log(`   ${category}:`);
                    indicators.forEach(ind => console.log(`     - ${ind}`));
                }
            });
        }
        
        if (evaluation.spoofingTechniques && evaluation.spoofingTechniques.length > 0) {
            console.log('\n🎭 Spoofing Techniques:');
            evaluation.spoofingTechniques.forEach(tech => console.log(`   - ${tech}`));
        }
        
        if (evaluation.recommendations && evaluation.recommendations.length > 0) {
            console.log('\n📋 Recommendations:');
            evaluation.recommendations.forEach(rec => console.log(`   - ${rec}`));
        }
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

async function runTests() {
    console.log('🚀 Pattern Analysis Test Suite');
    console.log('Testing both Lite and Full analysis modes\n');
    
    // Test lite analysis with normal session
    await testLiteAnalysis(sampleSessionData, 'Normal Session');
    
    // Test lite analysis with spoofed session
    await testLiteAnalysis(spoofedSessionData, 'Spoofed Session');
    
    // Test full analysis with normal session
    await testFullAnalysis(sampleSessionData, 'Normal Session');
    
    // Test full analysis with spoofed session
    await testFullAnalysis(spoofedSessionData, 'Spoofed Session');
    
    console.log('\n✅ All tests completed!');
}

// Run tests
runTests().catch(console.error); 