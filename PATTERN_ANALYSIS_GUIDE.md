# Pattern Analysis with Gemini & Qdrant

## Overview

The Pattern Analysis feature uses Google's Gemini AI and Qdrant vector database to:
1. Generate embeddings of detection sessions
2. Find similar spoofing patterns across sessions
3. Use LLM evaluation for risk assessment
4. Provide recommendations based on patterns

## Architecture

```
Detection Session → Session Fingerprint → Gemini Embedding → Qdrant Storage
                                                                    ↓
User Query → Similar Session Search ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ┘
                    ↓
              LLM Evaluation → Risk Assessment & Recommendations
```

## Setup Guide

### 1. Get a Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add to your `.env` file:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

### 2. Setup Qdrant

#### Option A: Local Qdrant (Recommended for Development)

1. Using Docker:
   ```bash
   docker run -p 6333:6333 \
     -v $(pwd)/qdrant_storage:/qdrant/storage \
     qdrant/qdrant
   ```

2. Or download from [Qdrant releases](https://github.com/qdrant/qdrant/releases)

#### Option B: Qdrant Cloud

1. Sign up at [cloud.qdrant.io](https://cloud.qdrant.io)
2. Create a cluster
3. Get your URL and API key
4. Update `.env`:
   ```
   QDRANT_URL=https://your-cluster.qdrant.io
   QDRANT_API_KEY=your_api_key_here
   ```

### 3. Install Dependencies

```bash
npm install
```

## How It Works

### Session Fingerprinting

Each detection session creates a comprehensive fingerprint including:

- **Location Data**: Coordinates, accuracy, response time, VPN detection
- **Environment Data**: Screen resolution, GPU, platform, color depth
- **Network Data**: IPs, user agent, browser properties
- **Detection Results**: Scores, flags, spoofing indicators

### Embedding Generation

The fingerprint is converted to text and embedded using Gemini's `embedding-001` model:

```javascript
Location: 37.7749, -122.4194
Accuracy: 10m
Platform: MacIntel
Screen: 1920x1080
GPU: Intel Iris Pro
Risk Level: medium
Location Score: 60
Environment Score: 75
Spoofing Indicators: VPN detected; Suspicious response time
```

### Similarity Search

Qdrant performs cosine similarity search to find sessions with similar patterns:
- Similar location spoofing techniques
- Common VPN/proxy configurations
- Matching environment characteristics

### LLM Evaluation

Gemini Pro analyzes the current session and similar sessions to provide:
1. **Risk Assessment**: High/Medium/Low with explanation
2. **Pattern Identification**: Common techniques across sessions
3. **Specific Techniques**: Detailed spoofing methods detected
4. **Recommendations**: Actions to take based on risk

## API Endpoints

### Store Session
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

### Find Similar Sessions
```http
POST /api/session/similar
Content-Type: application/json

{
  "sessionData": {...},
  "limit": 5
}
```

### Evaluate with LLM
```http
POST /api/session/evaluate
Content-Type: application/json

{
  "currentSession": {...},
  "similarSessions": [...]
}
```

## Using the UI

1. Click "Locate Me" to run detection
2. After detection completes, the "Pattern Analysis" card appears
3. Click "Run Analysis" to:
   - Find similar sessions in the database
   - Get AI-powered risk assessment
   - View detected patterns and recommendations

## Example Output

### AI Analysis
- **Risk Level**: High
- **Explanation**: "Multiple indicators suggest coordinated spoofing attempt using NordVPN with location set to San Francisco datacenter."

### Patterns Detected
- Consistent use of VPN exit nodes in specific regions
- Round GPS coordinates indicating manual input
- Fast response times suggesting browser extension spoofing

### Similar Sessions
- Session 1: 95.2% similarity - Same VPN provider, similar coordinates
- Session 2: 87.5% similarity - Identical GPU spoofing technique

### Recommendations
- Block access from detected VPN ranges
- Require additional verification for suspicious patterns
- Monitor for repeated attempts from similar configurations

## Privacy & Security

- Session data is stored with generated IDs (no PII)
- Embeddings don't contain reversible information
- API keys should be kept secure
- Consider data retention policies

## Troubleshooting

### "Error running pattern analysis"
- Check Gemini API key is valid
- Ensure Qdrant is running and accessible
- Check browser console for specific errors

### No similar sessions found
- System needs time to build pattern database
- Try running multiple detections with different configurations

### Slow analysis
- First embedding generation can be slow
- Consider caching embeddings for repeated analysis
- Ensure good connectivity to Gemini API

## Advanced Configuration

### Adjusting Similarity Threshold
Modify the search parameters in `session-fingerprint.js`:
```javascript
const searchResult = await qdrantClient.search(COLLECTION_NAME, {
    vector: embedding,
    limit: limit,
    score_threshold: 0.7  // Adjust this value
});
```

### Custom Fingerprint Fields
Add additional fields to `generateSessionFingerprint()`:
```javascript
fingerprint.custom = {
    browserPlugins: navigator.plugins.length,
    screenOrientation: screen.orientation?.type,
    // Add more fields
};
```

### Fine-tuning LLM Prompts
Modify the evaluation prompt in `evaluateSimilarity()` to focus on specific aspects or get different output formats.

## Best Practices

1. **Regular Analysis**: Run pattern analysis on suspicious sessions
2. **Database Maintenance**: Periodically clean old sessions
3. **Threshold Tuning**: Adjust similarity thresholds based on false positive rates
4. **Combined Signals**: Use pattern analysis alongside other security measures

## Future Enhancements

- Real-time pattern matching
- Automated blocking based on risk scores
- Pattern visualization dashboard
- Cross-session behavior analysis
- Integration with threat intelligence feeds 