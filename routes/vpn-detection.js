const axios = require('axios');
const { getThresholds } = require('./threshold-config');

// VPN Detection Services Configuration
const VPN_DETECTION_SERVICES = {
    // Free tier available
    IPINFO: {
        enabled: process.env.IPINFO_TOKEN ? true : false,
        token: process.env.IPINFO_TOKEN,
        endpoint: 'https://ipinfo.io/{ip}?token={token}'
    },
    
    // Free tier: 1000 requests/month
    IPAPI: {
        enabled: process.env.IPAPI_KEY ? true : false,
        key: process.env.IPAPI_KEY,
        endpoint: 'https://ipapi.co/{ip}/json/?key={key}'
    },
    
    // Free tier: 1000 requests/day
    VPNAPI: {
        enabled: process.env.VPNAPI_KEY ? true : false,
        key: process.env.VPNAPI_KEY,
        endpoint: 'https://vpnapi.io/api/{ip}?key={key}'
    },
    
    // Free tier available
    IPQUALITYSCORE: {
        enabled: process.env.IPQUALITYSCORE_KEY ? true : false,
        key: process.env.IPQUALITYSCORE_KEY,
        endpoint: 'https://ipqualityscore.com/api/json/ip/{key}/{ip}'
    },
    
    // Free lookup (limited)
    IPHUB: {
        enabled: process.env.IPHUB_KEY ? true : false,
        key: process.env.IPHUB_KEY,
        endpoint: 'https://v2.api.iphub.info/ip/{ip}'
    },
    
    // Free tier: 500 requests/day
    ABSTRACTAPI: {
        enabled: process.env.ABSTRACTAPI_KEY ? true : false,
        key: process.env.ABSTRACTAPI_KEY,
        endpoint: 'https://ipgeolocation.abstractapi.com/v1/?api_key={key}&ip_address={ip}'
    },
    
    // Free service - No API key required (limited to 100 requests/day per IP)
    IPAPI_FREE: {
        enabled: true, // Always enabled as fallback
        endpoint: 'https://ipapi.co/{ip}/json/'
    }
};

/**
 * Detect VPN using multiple services
 */
async function detectVPN(ip) {
    const results = {
        ip: ip,
        isVPN: false,
        confidence: 0,
        detections: [],
        details: {}
    };
    
    // Skip private IPs
    if (isPrivateIP(ip)) {
        results.details.error = 'Private IP address';
        return results;
    }
    
    const detectionPromises = [];
    
    // IPInfo.io Detection
    if (VPN_DETECTION_SERVICES.IPINFO.enabled) {
        detectionPromises.push(
            checkIPInfo(ip).catch(err => ({ error: err.message }))
        );
    }
    
    // VPN API Detection (most accurate for VPN detection)
    if (VPN_DETECTION_SERVICES.VPNAPI.enabled) {
        detectionPromises.push(
            checkVPNAPI(ip).catch(err => ({ error: err.message }))
        );
    }
    
    // IPQualityScore Detection
    if (VPN_DETECTION_SERVICES.IPQUALITYSCORE.enabled) {
        detectionPromises.push(
            checkIPQualityScore(ip).catch(err => ({ error: err.message }))
        );
    }
    
    // IPHub Detection
    if (VPN_DETECTION_SERVICES.IPHUB.enabled) {
        detectionPromises.push(
            checkIPHub(ip).catch(err => ({ error: err.message }))
        );
    }
    
    // Free IPAPI Detection (always try as fallback)
    detectionPromises.push(
        checkIPAPIFree(ip).catch(err => ({ error: err.message }))
    );
    
    // Wait for all checks to complete
    const detectionResults = await Promise.all(detectionPromises);
    
    // Aggregate results
    let vpnDetections = 0;
    let totalChecks = 0;
    
    detectionResults.forEach(result => {
        if (!result.error) {
            totalChecks++;
            if (result.isVPN) {
                vpnDetections++;
                results.detections.push(result);
            }
        }
    });
    
    const thresholds = getThresholds();
    
    // Calculate confidence based on how many services detected VPN
    results.confidence = Math.round((vpnDetections / totalChecks) * 100);
    
    // Consider it a VPN if confidence meets threshold
    results.isVPN = results.confidence >= thresholds.vpn.confidence.detected;
    
    results.details = {
        totalChecks,
        vpnDetections,
        services: detectionResults
    };
    
    return results;
}

/**
 * Check if IP is private
 */
function isPrivateIP(ip) {
    const parts = ip.split('.');
    return (
        ip.startsWith('10.') ||
        ip.startsWith('172.16.') ||
        ip.startsWith('172.17.') ||
        ip.startsWith('172.18.') ||
        ip.startsWith('172.19.') ||
        ip.startsWith('172.20.') ||
        ip.startsWith('172.21.') ||
        ip.startsWith('172.22.') ||
        ip.startsWith('172.23.') ||
        ip.startsWith('172.24.') ||
        ip.startsWith('172.25.') ||
        ip.startsWith('172.26.') ||
        ip.startsWith('172.27.') ||
        ip.startsWith('172.28.') ||
        ip.startsWith('172.29.') ||
        ip.startsWith('172.30.') ||
        ip.startsWith('172.31.') ||
        ip.startsWith('192.168.') ||
        ip.startsWith('127.')
    );
}

/**
 * IPInfo.io check
 */
async function checkIPInfo(ip) {
    const url = VPN_DETECTION_SERVICES.IPINFO.endpoint
        .replace('{ip}', ip)
        .replace('{token}', VPN_DETECTION_SERVICES.IPINFO.token);
    
    const response = await axios.get(url, { timeout: 5000 });
    const data = response.data;
    
    return {
        service: 'IPInfo',
        isVPN: data.privacy?.vpn || false,
        isProxy: data.privacy?.proxy || false,
        isTor: data.privacy?.tor || false,
        isHosting: data.privacy?.hosting || false,
        org: data.org,
        asn: data.asn,
        location: {
            city: data.city,
            region: data.region,
            country: data.country
        }
    };
}

/**
 * VPNAPI.io check (specialized for VPN detection)
 */
async function checkVPNAPI(ip) {
    const url = VPN_DETECTION_SERVICES.VPNAPI.endpoint
        .replace('{ip}', ip)
        .replace('{key}', VPN_DETECTION_SERVICES.VPNAPI.key);
    
    const response = await axios.get(url, { timeout: 5000 });
    const data = response.data;
    
    return {
        service: 'VPNAPI',
        isVPN: data.security?.vpn || false,
        isProxy: data.security?.proxy || false,
        isTor: data.security?.tor || false,
        isRelay: data.security?.relay || false,
        riskScore: data.risk?.score || 0,
        network: data.network,
        location: data.location
    };
}

/**
 * IPQualityScore check
 */
async function checkIPQualityScore(ip) {
    const url = VPN_DETECTION_SERVICES.IPQUALITYSCORE.endpoint
        .replace('{key}', VPN_DETECTION_SERVICES.IPQUALITYSCORE.key)
        .replace('{ip}', ip);
    
    const response = await axios.get(url, { timeout: 5000 });
    const data = response.data;
    
    return {
        service: 'IPQualityScore',
        isVPN: data.vpn || false,
        isProxy: data.proxy || false,
        isTor: data.tor || false,
        isCrawler: data.is_crawler || false,
        fraudScore: data.fraud_score || 0,
        abuseVelocity: data.abuse_velocity || 'none',
        ISP: data.ISP,
        organization: data.organization,
        ASN: data.ASN,
        country: data.country_code,
        city: data.city,
        recentAbuse: data.recent_abuse || false
    };
}

/**
 * IPHub check
 */
async function checkIPHub(ip) {
    const url = VPN_DETECTION_SERVICES.IPHUB.endpoint.replace('{ip}', ip);
    
    const response = await axios.get(url, {
        headers: {
            'X-Key': VPN_DETECTION_SERVICES.IPHUB.key
        },
        timeout: 5000
    });
    
    const data = response.data;
    
    // IPHub block levels:
    // 0 - Residential/Unclassified IP (Good)
    // 1 - Non-residential IP (Hosting/Business)
    // 2 - Non-residential & residential proxy (VPN)
    return {
        service: 'IPHub',
        isVPN: data.block >= 1,
        blockLevel: data.block,
        isp: data.isp,
        asn: data.asn,
        hostname: data.hostname,
        countryCode: data.countryCode,
        countryName: data.countryName
    };
}

/**
 * Free IPAPI check (no API key required)
 */
async function checkIPAPIFree(ip) {
    const url = VPN_DETECTION_SERVICES.IPAPI_FREE.endpoint.replace('{ip}', ip);
    
    const response = await axios.get(url, { 
        timeout: 5000,
        headers: {
            'User-Agent': 'Geo-Spoofer-Detector/1.0'
        }
    });
    
    const data = response.data;
    
    // IPAPI provides basic info but doesn't explicitly flag VPNs
    // We can infer based on organization name and ASN
    const orgLower = (data.org || '').toLowerCase();
    const vpnKeywords = ['vpn', 'proxy', 'hosting', 'datacenter', 'cloud', 'server'];
    const isLikelyVPN = vpnKeywords.some(keyword => orgLower.includes(keyword));
    
    return {
        service: 'IPAPI-Free',
        isVPN: isLikelyVPN,
        isProxy: isLikelyVPN,
        org: data.org,
        asn: data.asn,
        location: {
            city: data.city,
            region: data.region,
            country: data.country_name,
            countryCode: data.country_code
        },
        note: 'Basic detection based on organization name'
    };
}

/**
 * Get VPN detection explanation based on results
 */
function getVPNExplanation(results) {
    if (!results.isVPN) {
        return 'No VPN or proxy detected. This appears to be a regular residential or business connection.';
    }
    
    const detectedBy = results.detections.map(d => d.service).join(', ');
    let explanation = `VPN/Proxy detected by: ${detectedBy}. `;
    
    // Add specific details
    const details = [];
    results.detections.forEach(detection => {
        if (detection.fraudScore && detection.fraudScore > 75) {
            details.push(`High fraud score: ${detection.fraudScore}/100`);
        }
        if (detection.org && detection.org.toLowerCase().includes('vpn')) {
            details.push(`Organization: ${detection.org}`);
        }
        if (detection.isHosting) {
            details.push('Hosted on datacenter infrastructure');
        }
        if (detection.isTor) {
            details.push('Tor exit node detected');
        }
    });
    
    if (details.length > 0) {
        explanation += details.join('. ') + '.';
    }
    
    explanation += ` Confidence: ${results.confidence.toFixed(0)}%`;
    
    return explanation;
}

module.exports = {
    detectVPN,
    getVPNExplanation,
    VPN_DETECTION_SERVICES
}; 