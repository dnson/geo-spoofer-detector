# Geo Spoofer Detector

A sophisticated Location Authenticity & Environment Detector that helps identify spoofed locations and remote desktop environments using browser-based detection techniques.

## Features

- **Location Authenticity Detection**: Verifies if GPS coordinates are genuine or spoofed
- **VPN/Proxy Detection**: Identifies VPN, proxy, and Tor connections using multiple services
- **Remote Environment Detection**: Identifies RDP, VNC, and virtual machine usage
- **Browser Fingerprinting**: Analyzes browser characteristics for anomalies
- **Real-time Analysis**: Instant detection with visual feedback
- **RESTful API**: Backend API for location verification and environment analysis
- **Free VPN Detection**: Works out-of-the-box without API keys (with option to add services for better accuracy)
- **Pattern Analysis**: AI-powered session fingerprinting with Gemini embeddings and Qdrant vector search

## Tech Stack

- **Backend**: Node.js, Express.js
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Security**: Helmet.js, CORS, Rate Limiting
- **AI/ML**: Google Gemini for embeddings and LLM evaluation
- **Vector Database**: Qdrant for similarity search
- **Deployment**: Docker-ready (optional)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/dnson/geo-spoofer-detector.git
cd geo-spoofer-detector
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# API Configuration
API_RATE_LIMIT_WINDOW=15
API_RATE_LIMIT_MAX=100

# Security
SESSION_SECRET=your-secret-key-here

# Optional: VPN Detection API Keys (see VPN_DETECTION_GUIDE.md)
# The app includes a free VPN detection service that works without API keys
# For better accuracy, sign up for free API keys from:
# IPINFO_TOKEN=your-token-here  # https://ipinfo.io
# VPNAPI_KEY=your-key-here      # https://vpnapi.io
```

4. Start the server:
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

5. Open your browser and navigate to:
```
http://localhost:3000
```

## API Documentation

### Location Verification

#### Verify Location Authenticity
```http
POST /api/location/verify
Content-Type: application/json

{
  "latitude": 37.7749,
  "longitude": -122.4194,
  "accuracy": 10,
  "timestamp": 1234567890
}
```

**Response:**
```json
{
  "status": "authentic",
  "score": 85,
  "flags": [],
  "analysis": {
    "coordinates": {...},
    "accuracy": 10,
    "timestamp": "2023-...",
    "age": 1000
  }
}
```

#### Get Location Metadata
```http
GET /api/location/metadata?lat=37.7749&lon=-122.4194
```

**Response:**
```json
{
  "coordinates": {...},
  "timezone": "UTC-8",
  "country": "Unknown",
  "region": "Unknown",
  "vpnProbability": 15
}
```

### Environment Analysis

#### Analyze Client Environment
```http
POST /api/environment/analyze
Content-Type: application/json

{
  "screenResolution": {"width": 1920, "height": 1080},
  "colorDepth": 24,
  "touchSupport": false,
  "webglRenderer": "NVIDIA GeForce GTX 1080",
  "timezone": "America/Los_Angeles",
  "language": "en-US",
  "platform": "Win32"
}
```

**Response:**
```json
{
  "environmentType": "local_desktop",
  "score": 95,
  "flags": [],
  "details": {...}
}
```

### VPN/Proxy Detection

#### Check IP for VPN/Proxy
```http
GET /api/vpn/check
GET /api/vpn/check/1.2.3.4
```

**Response:**
```json
{
  "ip": "1.2.3.4",
  "isVPN": true,
  "confidence": 75,
  "explanation": "VPN/Proxy detected by: IPInfo, VPNAPI. Organization: NordVPN. Hosted on datacenter infrastructure. Confidence: 75%",
  "details": {
    "totalChecks": 3,
    "vpnDetections": 2,
    "services": [...]
  }
}
```

### Detection Storage

#### Store Detection Results
```http
POST /api/detection/store
Content-Type: application/json

{
  "sessionId": "abc123",
  "results": {
    "location": {...},
    "environment": {...}
  }
}
```

**Response:**
```json
{
  "success": true,
  "detectionId": "xyz789"
}
```

### Health Check
```http
GET /health
```

### Pattern Analysis

#### Store Session Fingerprint
```http
POST /api/session/store
Content-Type: application/json

{
  "location": {...},
  "environment": {...},
  "network": {...},
  "detectionResults": {...}
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "abc123...",
  "fingerprint": {...}
}
```

#### Find Similar Sessions
```http
POST /api/session/similar
Content-Type: application/json

{
  "sessionData": {...},
  "limit": 5
}
```

**Response:**
```json
{
  "success": true,
  "similarSessions": [
    {
      "score": 0.95,
      "payload": {...}
    }
  ]
}
```

#### AI Evaluation
```http
POST /api/session/evaluate
Content-Type: application/json

{
  "currentSession": {...},
  "similarSessions": [...]
}
```

**Response:**
```json
{
  "success": true,
  "evaluation": {
    "riskAssessment": "High",
    "explanation": "...",
    "patterns": [...],
    "recommendations": [...]
  }
}
```

#### Lite Analysis
```http
POST /api/session/analyze-lite
Content-Type: application/json

{
  "sessionData": {
    "location": {...},
    "environment": {...},
    "network": {...},
    "detectionResults": {...}
  }
}
```

**Response:**
```json
{
  "success": true,
  "fingerprint": {...},
  "evaluation": {
    "riskAssessment": "MEDIUM",
    "riskScore": 45,
    "confidence": 80,
    "explanation": "...",
    "riskFactors": [...],
    "patterns": [...],
    "recommendations": [...],
    "processingTime": "fast"
  },
  "similarSessions": [...]
}
```

#### Store Grouped Sessions
```http
POST /api/session/store-group
Content-Type: application/json

{
  "sessions": [...],
  "metadata": {
    "detectionCount": 3,
    "delay": 1000
  }
}
```

**Response:**
```json
{
  "success": true,
  "groupSessionId": "abc123...",
  "sessionCount": 3,
  "storedSessionIds": [...],
  "groupSummary": {
    "analysis": {...},
    "consistencyMetrics": {...}
  }
}
```

#### Retrieve Grouped Sessions
```http
GET /api/session/group/:groupSessionId
```

**Response:**
```json
{
  "success": true,
  "groupSessionId": "abc123...",
  "sessions": [...],
  "metadata": {...},
  "analysis": {...}
}
```

### Thresholds Configuration

#### Get Current Thresholds
```http
GET /api/thresholds
```

**Response:**
```json
{
  "location": {
    "responseTime": { "suspicious": 10 },
    "accuracy": { "low": 1000 },
    "score": { "likelySpoofed": 60, "suspicious": 80 }
  },
  "environment": {
    "score": { "likelyRemote": 50, "possiblyRemote": 75 },
    "colorDepth": { "rdpIndicator": 24 }
  },
  "vpn": {
    "confidence": { "detected": 50 }
  },
  ...
}
```

#### Update Thresholds (Admin Only)
```http
PUT /api/thresholds
Content-Type: application/json

{
  "location": { ... },
  "environment": { ... },
  "vpn": { ... },
  "riskAssessment": { ... },
  "patternAnalysis": { ... },
  "scoring": { ... }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Thresholds updated successfully",
  "thresholds": { ... }
}
```

### Configuration File

The application uses a `thresholds.json` file to define detection thresholds. This file is loaded on startup and can be modified to adjust detection sensitivity:

```json
{
  "location": {
    "responseTime": {
      "suspicious": 10,
      "description": "Response time in ms below which is suspicious"
    },
    "accuracy": {
      "low": 1000,
      "description": "GPS accuracy in meters above which is considered low"
    },
    "score": {
      "likelySpoofed": 60,
      "suspicious": 80
    }
  },
  "environment": {
    "score": {
      "likelyRemote": 50,
      "possiblyRemote": 75
    },
    "colorDepth": {
      "rdpIndicator": 24
    }
  },
  "vpn": {
    "confidence": {
      "detected": 50
    }
  }
}
```

Key threshold settings:
- **Location Response Time**: Fast responses (<10ms) may indicate cached/spoofed coordinates
- **GPS Accuracy**: Values >1000m suggest IP-based geolocation instead of GPS
- **Score Thresholds**: Control when locations/environments are flagged as suspicious
- **VPN Confidence**: Percentage of detection services needed to confirm VPN usage
- **Risk Scoring**: Bonuses added for various spoofing indicators

The thresholds are automatically reloaded when the file is modified, allowing real-time tuning without server restart.

## Detection Runner

The Detection Runner module (`public/detection-runner.js`) provides a reusable API for running detections programmatically:

### Features
- **Session-Based Detection**: Store multiple detections in a single session as an array
- **Multiple Detection Runs**: Compare consistency across multiple detection attempts
- **Session Export**: Export detection sessions for further analysis
- **Consistency Analysis**: Automatically detect inconsistencies between runs
- **Programmatic API**: Run detections from your own code

### Session-Based Detection (NEW)

The new session-based approach allows you to run multiple detections and store them as an array within a single session:

```javascript
// Start a new session
const sessionId = window.DetectionRunner.startSession({
    purpose: 'user-verification',
    notes: 'Testing location consistency'
});

// Run multiple detections in the same session
await window.DetectionRunner.runDetectionInSession({ 
    includeLocation: true,
    includeEnvironment: true,
    autoSession: false  // We already started a session
});

// Wait a bit and run another detection
await new Promise(resolve => setTimeout(resolve, 2000));

await window.DetectionRunner.runDetectionInSession({ 
    includeLocation: true,
    includeEnvironment: true,
    autoSession: false
});

// End the session and get all detections
const session = window.DetectionRunner.endSession();

console.log(session.sessionId);          // Single session ID
console.log(session.detections.length);  // Number of detections (2)
console.log(session.summary);            // Analysis of all detections
console.log(session.detections);         // Array of all detection data

// Store the complete session
await window.DetectionRunner.storeSession(session);
```

### Run Multiple Detections in One Call

For convenience, you can also run multiple detections automatically:

```javascript
// Run 3 detections with 1.5 second delay between each
const session = await window.DetectionRunner.runSessionWithMultipleDetections(
    3,      // Number of detections
    1500,   // Delay between runs (ms)
    {       // Options
        includeLocation: true,
        includeEnvironment: true,
        includeNetwork: true,
        metadata: {
            purpose: 'consistency-check',
            userAgent: navigator.userAgent
        }
    }
);

// Session object contains:
// - sessionId: Unique session identifier
// - startTime/endTime: Session timespan
// - detections: Array of all detection results
// - summary: Aggregated analysis
// - metadata: Custom metadata

// Store the session
await window.DetectionRunner.storeSession(session);
```

### Session Object Structure

Each session contains multiple detections in an array:

```json
{
  "sessionId": "unique-session-id",
  "startTime": "2024-01-01T00:00:00.000Z",
  "endTime": "2024-01-01T00:01:00.000Z",
  "detections": [
    {
      "detectionIndex": 0,
      "detectionTimestamp": "2024-01-01T00:00:00.000Z",
      "location": { ... },
      "environment": { ... },
      "network": { ... },
      "scores": { ... },
      "fingerprint": "abc123"
    },
    {
      "detectionIndex": 1,
      "detectionTimestamp": "2024-01-01T00:00:30.000Z",
      "location": { ... },
      "environment": { ... },
      "network": { ... },
      "scores": { ... },
      "fingerprint": "def456"
    }
  ],
  "summary": {
    "detectionCount": 2,
    "timespan": { ... },
    "averageScores": { ... },
    "consistency": { ... }
  },
  "metadata": { ... }
}
```

### Single Detection

You can still run single detections without session management:

```javascript
// Run a single detection
const session = await window.DetectionRunner.runDetection({
    includeLocation: true,
    includeEnvironment: true,
    includeNetwork: true,
    silent: false  // Set to true to suppress console logs
});

console.log(session.sessionId);      // Unique session identifier
console.log(session.scores);         // Detection scores
console.log(session.fingerprint);    // Session fingerprint
```

## Detection Methods

### Location Spoofing Detection
- Null Island coordinate check (0,0)
- Suspiciously round coordinates
- Location accuracy analysis
- Timestamp freshness verification
- WebRTC IP leak detection

### VPN/Proxy Detection
- **IP Database Checks**: Cross-references IP against known VPN/proxy databases
- **Organization Analysis**: Identifies datacenter and hosting providers
- **Multi-Service Verification**: Aggregates results from multiple detection services
- **Tor Exit Node Detection**: Identifies connections from Tor network
- **Fraud Score Analysis**: Evaluates IP reputation and abuse history
- **Free Fallback Service**: Basic detection without API keys

### Remote Environment Detection
- Screen resolution pattern analysis
- Color depth verification
- WebGL renderer identification
- Touch support anomalies
- Timing irregularities
- Virtual display adapter detection

### Pattern Analysis with AI
- Session fingerprinting with comprehensive characteristics
- Vector embeddings using Google Gemini
- Similarity search with Qdrant vector database
- AI-powered risk assessment and recommendations
- Pattern identification across multiple sessions

## Security Considerations

- Rate limiting on API endpoints
- CORS configuration
- Helmet.js security headers
- Input validation and sanitization
- Environment variable protection

## Development

### Project Structure
```
geo-spoofer-detector/
├── server.js           # Main server file
├── package.json        # Dependencies
├── .gitignore         # Git ignore rules
├── thresholds.json    # Detection threshold configuration
├── routes/
│   ├── api.js         # API route handlers
│   ├── session-fingerprint.js  # Session analysis
│   ├── vpn-detection.js       # VPN detection logic
│   └── threshold-config.js    # Threshold management
└── public/
    ├── index.html     # Frontend application
    ├── api-integration.js    # API client
    ├── config.js            # Frontend config
    ├── thresholds-config.js # Frontend threshold loader
    └── detection-runner.js  # Detection runner module
```

### Adding New Detection Methods

1. Frontend detection (in `public/index.html`):
   - Add new detection function
   - Update `detectionState` structure
   - Modify `analyzeResults()` function

2. Backend verification (in `routes/api.js`):
   - Add new endpoint or modify existing
   - Implement verification logic
   - Update response format

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.

## Acknowledgments

- Uses browser APIs for geolocation and WebRTC
- Inspired by anti-fraud detection techniques
- Built with security best practices

## Troubleshooting

### Common Issues

1. **Geolocation permission denied**
   - Ensure HTTPS is used in production
   - Check browser permissions

2. **Port already in use**
   - Change PORT in .env file
   - Kill process using the port

3. **Module not found errors**
   - Run `npm install` again
   - Delete node_modules and reinstall

### Support

For issues and feature requests, please open an issue on GitHub.

#### Store Session with Multiple Detections
```http
POST /api/session/store-multi
Content-Type: application/json

{
  "sessionId": "unique-session-id",
  "startTime": "2024-01-01T00:00:00.000Z",
  "endTime": "2024-01-01T00:01:00.000Z",
  "detections": [
    {
      "location": {...},
      "environment": {...},
      "network": {...},
      "scores": {...},
      "timestamp": "2024-01-01T00:00:00.000Z"
    },
    {
      "location": {...},
      "environment": {...},
      "network": {...},
      "scores": {...},
      "timestamp": "2024-01-01T00:00:30.000Z"
    }
  ],
  "metadata": {
    "purpose": "consistency-check"
  },
  "summary": {
    "detectionCount": 2,
    "averageScores": {...},
    "consistency": {...}
  }
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "unique-session-id",
  "storedId": "qdrant-point-id",
  "detectionCount": 2,
  "summary": {
    "totalSessions": 2,
    "locationVariance": {...},
    "scoreStatistics": {...},
    "consistencyMetrics": {...}
  }
}
```

#### Retrieve Session with Multiple Detections
```http
GET /api/session/multi/:sessionId
```

**Response:**
```json
{
  "success": true,
  "sessionId": "unique-session-id",
  "detections": [...],
  "summary": {...},
  "metadata": {...}
}
```

#### Store Grouped Sessions
```http
POST /api/session/store-group
Content-Type: application/json

{
  "sessions": [...],
  "metadata": {
    "detectionCount": 3,
    "delay": 1000
  }
}
```

**Response:**
```json
{
  "success": true,
  "groupSessionId": "abc123...",
  "sessionCount": 3,
  "storedSessionIds": [...],
  "groupSummary": {
    "analysis": {...},
    "consistencyMetrics": {...}
  }
}
```

#### Retrieve Grouped Sessions
```http
GET /api/session/group/:groupSessionId
```

**Response:**
```json
{
  "success": true,
  "groupSessionId": "abc123...",
  "sessions": [...],
  "metadata": {...},
  "analysis": {...}
}
```

### Thresholds Configuration

#### Get Current Thresholds
```http
GET /api/thresholds
```

**Response:**
```json
{
  "location": {
    "responseTime": { "suspicious": 10 },
    "accuracy": { "low": 1000 },
    "score": { "likelySpoofed": 60, "suspicious": 80 }
  },
  "environment": {
    "score": { "likelyRemote": 50, "possiblyRemote": 75 },
    "colorDepth": { "rdpIndicator": 24 }
  },
  "vpn": {
    "confidence": { "detected": 50 }
  },
  ...
}
```

#### Update Thresholds (Admin Only)
```http
PUT /api/thresholds
Content-Type: application/json

{
  "location": { ... },
  "environment": { ... },
  "vpn": { ... },
  "riskAssessment": { ... },
  "patternAnalysis": { ... },
  "scoring": { ... }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Thresholds updated successfully",
  "thresholds": { ... }
}
```

### Configuration File

The application uses a `thresholds.json` file to define detection thresholds. This file is loaded on startup and can be modified to adjust detection sensitivity:

```json
{
  "location": {
    "responseTime": {
      "suspicious": 10,
      "description": "Response time in ms below which is suspicious"
    },
    "accuracy": {
      "low": 1000,
      "description": "GPS accuracy in meters above which is considered low"
    },
    "score": {
      "likelySpoofed": 60,
      "suspicious": 80
    }
  },
  "environment": {
    "score": {
      "likelyRemote": 50,
      "possiblyRemote": 75
    },
    "colorDepth": {
      "rdpIndicator": 24
    }
  },
  "vpn": {
    "confidence": {
      "detected": 50
    }
  }
}
```

Key threshold settings:
- **Location Response Time**: Fast responses (<10ms) may indicate cached/spoofed coordinates
- **GPS Accuracy**: Values >1000m suggest IP-based geolocation instead of GPS
- **Score Thresholds**: Control when locations/environments are flagged as suspicious
- **VPN Confidence**: Percentage of detection services needed to confirm VPN usage
- **Risk Scoring**: Bonuses added for various spoofing indicators

The thresholds are automatically reloaded when the file is modified, allowing real-time tuning without server restart. 