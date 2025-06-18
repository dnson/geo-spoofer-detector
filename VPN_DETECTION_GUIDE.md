# VPN Detection Services Guide

## Overview

This guide explains the VPN/Proxy detection services integrated into the Geo Spoofer Detector. These services maintain databases of known VPN, proxy, and datacenter IP addresses.

## Service Comparison

| Service | Free Tier | Accuracy | Features | Best For |
|---------|-----------|----------|----------|----------|
| **VPNAPI.io** | 1,000/day | Excellent | VPN/Proxy/Tor/Relay detection | Primary VPN detection |
| **IPInfo.io** | 50,000/month | Very Good | VPN/Proxy/Hosting detection + Geolocation | General purpose |
| **IPQualityScore** | 5,000/month | Excellent | Fraud scoring, abuse detection | Security focus |
| **IPHub** | 1,000/day | Good | Simple block levels | Quick checks |
| **Abstract API** | 20,000/month | Good | Geolocation + VPN detection | Combined data |
| **IPapi** | 1,000/month | Fair | Basic VPN detection | Backup option |

## Getting Started

### 1. Sign up for Free API Keys

1. **VPNAPI.io** (Recommended - Best for VPN detection)
   - Visit: https://vpnapi.io
   - Sign up for free account
   - Get your API key from dashboard
   - Add to `.env`: `VPNAPI_KEY=your_key_here`

2. **IPInfo.io** (Recommended - Best overall)
   - Visit: https://ipinfo.io/signup
   - Create free account
   - Copy your token
   - Add to `.env`: `IPINFO_TOKEN=your_token_here`

3. **IPQualityScore** (Optional - Best for fraud detection)
   - Visit: https://www.ipqualityscore.com/create-account
   - Register for free
   - Get API key from dashboard
   - Add to `.env`: `IPQUALITYSCORE_KEY=your_key_here`

### 2. Configure Services

Create or update your `.env` file:
```bash
# At minimum, configure one service:
VPNAPI_KEY=your_vpnapi_key
IPINFO_TOKEN=your_ipinfo_token

# Optional additional services:
IPQUALITYSCORE_KEY=your_ipqs_key
IPHUB_KEY=your_iphub_key
```

### 3. How It Works

When a user's location is verified, the system:

1. **Extracts the client IP** from the request
2. **Queries enabled services** in parallel
3. **Aggregates results** from all services
4. **Calculates confidence** based on consensus
5. **Provides detailed explanation** of findings

## Detection Logic

### VPN Detection Criteria

An IP is flagged as VPN/Proxy if:
- 50% or more services identify it as VPN/Proxy
- Any service identifies it as Tor
- Fraud score exceeds 90 (if available)
- IP belongs to known VPN provider ASN

### Confidence Scoring

- **100%**: All services agree it's a VPN
- **75%**: Most services detect VPN
- **50%**: Half of services detect VPN
- **25%**: Few services detect VPN
- **0%**: No VPN detected

## API Response Examples

### Clean IP (No VPN)
```json
{
  "ip": "73.162.112.123",
  "isVPN": false,
  "confidence": 0,
  "explanation": "No VPN or proxy detected. This appears to be a regular residential or business connection.",
  "details": {
    "totalChecks": 3,
    "vpnDetections": 0
  }
}
```

### VPN Detected
```json
{
  "ip": "45.83.91.123",
  "isVPN": true,
  "confidence": 100,
  "explanation": "VPN/Proxy detected by: IPInfo, VPNAPI, IPQualityScore. Organization: ExpressVPN. Hosted on datacenter infrastructure. Confidence: 100%",
  "details": {
    "totalChecks": 3,
    "vpnDetections": 3,
    "services": [
      {
        "service": "VPNAPI",
        "isVPN": true,
        "isProxy": false,
        "isTor": false,
        "riskScore": 85
      }
    ]
  }
}
```

### Tor Exit Node
```json
{
  "ip": "185.220.101.123",
  "isVPN": true,
  "confidence": 100,
  "explanation": "VPN/Proxy detected by: IPInfo, VPNAPI. Tor exit node detected. Confidence: 100%",
  "details": {
    "totalChecks": 2,
    "vpnDetections": 2,
    "isTor": true
  }
}
```

## Best Practices

1. **Use Multiple Services**: Configure at least 2 services for better accuracy
2. **Handle Failures Gracefully**: Don't penalize users if API calls fail
3. **Cache Results**: Consider caching VPN checks for same IPs (not implemented)
4. **Monitor Usage**: Track API usage to stay within free tiers
5. **Update Regularly**: VPN providers constantly change IPs

## Privacy Considerations

- Only check public IPs (private IPs are skipped)
- Don't store IP addresses unless necessary
- Consider user privacy laws in your jurisdiction
- Be transparent about VPN detection in your privacy policy

## Troubleshooting

### No VPN Detection Working
- Check if API keys are correctly set in `.env`
- Verify services are enabled (keys present)
- Check console for API errors
- Ensure server has internet access

### False Positives
- Business/University networks may be flagged
- Some mobile carriers use proxy-like infrastructure
- Adjust confidence threshold if needed

### Rate Limiting
- Implement caching to reduce API calls
- Use fewer services if hitting limits
- Upgrade to paid tiers for production use

## Advanced Usage

### Custom Service Integration

To add a new VPN detection service:

1. Add service configuration to `VPN_DETECTION_SERVICES`
2. Create a check function (e.g., `checkNewService()`)
3. Add to detection promises in `detectVPN()`
4. Update explanation logic if needed

### Webhook Integration

For real-time monitoring, consider:
- Sending alerts for high-risk IPs
- Logging VPN usage patterns
- Integrating with fraud prevention systems

## Cost Optimization

For production use with high traffic:

1. **Start with free tiers** during development
2. **Monitor usage** via service dashboards
3. **Implement caching** to reduce redundant checks
4. **Choose paid tier** based on your needs:
   - IPInfo: $99/month for 250k requests
   - VPNAPI: $49/month for 100k requests
   - IPQualityScore: $99/month for 50k requests

## Conclusion

VPN detection significantly improves location verification accuracy. By combining multiple detection services, the system can reliably identify when users are masking their true location, making it valuable for:

- Fraud prevention
- Compliance verification
- Content geo-restrictions
- Security applications

Remember to balance security needs with user privacy and always be transparent about your detection methods. 