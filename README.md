# Geo Spoofer Detector

A sophisticated Location Authenticity & Environment Detector that helps identify spoofed locations and remote desktop environments using browser-based detection techniques.

## Features

- **Location Authenticity Detection**: Verifies if GPS coordinates are genuine or spoofed
- **Remote Environment Detection**: Identifies RDP, VNC, and virtual machine usage
- **Browser Fingerprinting**: Analyzes browser characteristics for anomalies
- **Real-time Analysis**: Instant detection with visual feedback
- **RESTful API**: Backend API for location verification and environment analysis

## Tech Stack

- **Backend**: Node.js, Express.js
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Security**: Helmet.js, CORS, Rate Limiting
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

## Detection Methods

### Location Spoofing Detection
- Null Island coordinate check (0,0)
- Suspiciously round coordinates
- Location accuracy analysis
- Timestamp freshness verification
- WebRTC IP leak detection

### Remote Environment Detection
- Screen resolution pattern analysis
- Color depth verification
- WebGL renderer identification
- Touch support anomalies
- Timing irregularities
- Virtual display adapter detection

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
├── routes/
│   └── api.js         # API route handlers
└── public/
    └── index.html     # Frontend application
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