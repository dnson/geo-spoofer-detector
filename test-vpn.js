#!/usr/bin/env node
/**
 * Test VPN Detection
 * Usage: node test-vpn.js [ip-address]
 * 
 * Tests the VPN detection functionality with sample IPs
 */

const axios = require('axios');

const TEST_IPS = {
    'Regular ISP (Comcast)': '73.162.112.208',
    'Known VPN (NordVPN)': '45.83.91.36',
    'Tor Exit Node': '185.220.101.46',
    'Cloudflare WARP': '104.28.16.96',
    'AWS Datacenter': '52.44.235.61',
    'Google Cloud': '35.199.27.101',
    'Residential Proxy': '47.252.102.50'
};

async function testVPN(ip, description) {
    try {
        console.log(`\n🔍 Testing: ${description}`);
        console.log(`   IP: ${ip}`);
        
        const response = await axios.get(`http://localhost:3000/api/vpn/check/${ip}`);
        const data = response.data;
        
        console.log(`   Result: ${data.isVPN ? '🚫 VPN/Proxy Detected' : '✅ Clean IP'}`);
        console.log(`   Confidence: ${data.confidence}%`);
        console.log(`   Explanation: ${data.explanation}`);
        
        if (data.details && data.details.services) {
            console.log(`   Checked Services: ${data.details.totalChecks}`);
            data.details.services.forEach(service => {
                if (!service.error) {
                    console.log(`   - ${service.service}: ${service.isVPN ? 'VPN' : 'Clean'}`);
                }
            });
        }
    } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
    }
}

async function runTests() {
    console.log('VPN Detection Test Suite');
    console.log('========================');
    console.log('Make sure the server is running: npm run dev');
    
    // Test provided IP or run all tests
    const args = process.argv.slice(2);
    if (args[0]) {
        await testVPN(args[0], 'Custom IP');
    } else {
        for (const [description, ip] of Object.entries(TEST_IPS)) {
            await testVPN(ip, description);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
        }
    }
    
    console.log('\n✨ Test complete!');
}

runTests(); 