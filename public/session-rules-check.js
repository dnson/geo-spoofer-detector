// Session Rules Check Module
// Performs rule-based validation on detection sessions

window.SessionRulesCheck = (function() {
    'use strict';

    // Check if accuracy is an integer
    function checkIntAccuracy(data) {
        let errorMessage = '';
        if (!data?.multiDetectionSession?.detections) {
            return { result: false, message: errorMessage };
        }
        
        for (const entry of data.multiDetectionSession.detections) {
            if (entry.location && Number.isInteger(entry.location.accuracy)) {
                errorMessage = '[Json check] Accuracy is an integer';
                return { result: true, message: errorMessage };
            }
        }
        return { result: false, message: errorMessage };
    }

    // Check if all accuracies are empty
    function checkIfAllEmptyAccuracy(data) {
        let errorMessage = '';
        if (!data?.multiDetectionSession?.detections) {
            return { result: false, message: errorMessage };
        }
        
        let allEmpty = true;
        for (const entry of data.multiDetectionSession.detections) {
            if (entry.location && entry.location.accuracy !== null && entry.location.accuracy !== undefined) {
                allEmpty = false;
                break;
            }
        }
        
        if (allEmpty) {
            errorMessage = '[Json check] All accuracies are empty';
            return { result: true, message: errorMessage };
        }
        return { result: false, message: errorMessage };
    }

    // Check if all accuracies are 150
    function checkIfDevtool(data) {
        let errorMessage = '';
        if (!data?.multiDetectionSession?.detections) {
            return { result: false, message: errorMessage };
        }
        
        // Get list of accuracies
        const accuracies = data.multiDetectionSession.detections
            .filter(entry => entry.location && entry.location.accuracy !== null && entry.location.accuracy !== undefined)
            .map(entry => entry.location.accuracy);
        
        // Check if all accuracies are 150
        if (accuracies.length > 0 && accuracies.every(accuracy => accuracy === 150)) {
            errorMessage = '[Json check] All accuracies are 150';
            return { result: true, message: errorMessage };
        }
        return { result: false, message: errorMessage };
    }

    // Check if all accuracies are the same
    function checkIfAllAccuracySame(data) {
        let errorMessage = '';
        if (!data?.multiDetectionSession?.detections) {
            return { result: false, message: errorMessage };
        }
        
        // Get list of accuracies
        const accuracies = data.multiDetectionSession.detections
            .filter(entry => entry.location && entry.location.accuracy !== null && entry.location.accuracy !== undefined)
            .map(entry => entry.location.accuracy);
        
        // Get unique accuracies
        const uniqueAccuracies = [...new Set(accuracies)];
        
        if (accuracies.length > 0 && uniqueAccuracies.length === 1) {
            errorMessage = '[Json check] All accuracies are the same';
            return { result: true, message: errorMessage };
        }
        return { result: false, message: errorMessage };
    }

    // Check if all latitude and longitude are empty
    function checkIfAllLatLongEmpty(data) {
        let errorMessage = '';
        if (!data?.multiDetectionSession?.detections) {
            return { result: false, message: errorMessage };
        }
        
        let allEmpty = true;
        for (const entry of data.multiDetectionSession.detections) {
            if (entry.location && (
                (entry.location.latitude !== null && entry.location.latitude !== undefined) ||
                (entry.location.longitude !== null && entry.location.longitude !== undefined)
            )) {
                allEmpty = false;
                break;
            }
        }
        
        if (allEmpty) {
            errorMessage = '[Json check] All latitude and longitude are empty';
            return { result: true, message: errorMessage };
        }
        return { result: false, message: errorMessage };
    }

    // Check if all latitude and longitude are the same
    function checkIfAllLatLongSame(data) {
        let errorMessage = '';
        if (!data?.multiDetectionSession?.detections) {
            return { result: false, message: errorMessage };
        }
        
        // Get list of coordinates
        const coordinates = data.multiDetectionSession.detections
            .filter(entry => entry.location && 
                entry.location.latitude !== null && entry.location.latitude !== undefined &&
                entry.location.longitude !== null && entry.location.longitude !== undefined)
            .map(entry => `${entry.location.latitude},${entry.location.longitude}`);
        
        // Get unique coordinates
        const uniqueCoordinates = [...new Set(coordinates)];
        
        if (coordinates.length > 0 && uniqueCoordinates.length === 1) {
            errorMessage = '[Json check] All latitude and longitude are the same';
            return { result: true, message: errorMessage };
        }
        return { result: false, message: errorMessage };
    }

    // Check for virtual machine
    function checkVirtualMachine(data) {
        let errorMessage = '';
        if (!data?.multiDetectionSession?.detections) {
            // Also check currentSession for single detection
            if (data?.currentSession?.environment) {
                const env = data.currentSession.environment;
                const webglRenderer = (env.webglRenderer || '').toLowerCase();
                const platform = (env.platform || '').toLowerCase();
                
                if (webglRenderer.includes('angle') && webglRenderer.includes('intel') && webglRenderer.includes('mesa')) {
                    errorMessage = '[Json check] Virtual machine';
                    return { result: true, message: errorMessage };
                }
                
                if (platform.includes('linux')) {
                    errorMessage = '[Json check] Virtual machine is Linux';
                    return { result: true, message: errorMessage };
                }
            }
            return { result: false, message: errorMessage };
        }
        
        for (const entry of data.multiDetectionSession.detections) {
            if (entry.environment) {
                const webglRenderer = (entry.environment.webglRenderer || '').toLowerCase();
                if (webglRenderer.includes('angle') && webglRenderer.includes('intel') && webglRenderer.includes('mesa')) {
                    errorMessage = '[Json check] Virtual machine';
                    return { result: true, message: errorMessage };
                }
                
                const platform = (entry.environment.platform || '').toLowerCase();
                if (platform.includes('linux')) {
                    errorMessage = '[Json check] Virtual machine is Linux';
                    return { result: true, message: errorMessage };
                }
            }
        }
        return { result: false, message: errorMessage };
    }

    // Check user agent GPU match
    function userAgentGpuMatch(data) {
        const USER_AGENT_KEYWORDS = ['linux', 'windows', 'mac', 'android', 'iphone', 'ipad'];
        
        let detection = null;
        if (data?.multiDetectionSession?.detections?.[0]) {
            detection = data.multiDetectionSession.detections[0];
        } else if (data?.currentSession) {
            detection = data.currentSession;
        }
        
        if (!detection || !detection.environment) {
            return { result: false, message: 'No detection data found' };
        }
        
        const userAgent = (detection.environment.userAgent || detection.metadata?.userAgent || '').toLowerCase();
        const webglRenderer = (detection.environment.webglRenderer || '').toLowerCase();
        
        // Find which platform keyword is in the user agent
        let detectedPlatform = '';
        for (const keyword of USER_AGENT_KEYWORDS) {
            if (userAgent.includes(keyword)) {
                detectedPlatform = keyword;
                break;
            }
        }
        
        if (!detectedPlatform) {
            return { result: true, message: 'No platform detected in user agent' };
        }
        
        // Check if the platform keyword appears in the GPU renderer string
        if (!webglRenderer.includes(detectedPlatform)) {
            // Special case: 'mac' in user agent should match 'apple' in renderer
            if (detectedPlatform === 'mac' && webglRenderer.includes('apple')) {
                return { result: false, message: '' };
            }
            // Special case: 'windows' might appear as 'direct3d' or 'nvidia/amd' without 'windows'
            if (detectedPlatform === 'windows' && (webglRenderer.includes('direct3d') || webglRenderer.includes('nvidia') || webglRenderer.includes('amd'))) {
                return { result: false, message: '' };
            }
            
            return { result: true, message: 'User agent GPU mismatch' };
        }
        
        return { result: false, message: '' };
    }

    // Check for RDP based on response time
    function rdpCheck(data) {
        if (!data?.multiDetectionSession?.detections) {
            return { result: false, message: 'No detection data found' };
        }
        
        const latencies = [];
        for (const value of data.multiDetectionSession.detections) {
            if (value.location && value.location.responseTime !== null && value.location.responseTime !== undefined) {
                latencies.push(value.location.responseTime);
            }
        }
        
        if (latencies.length === 0) {
            return { result: false, message: 'No latency data found' };
        }
        
        const averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
        
        if (averageLatency > 15) {
            return { result: true, message: 'RDP detected (average response time > 15ms)' };
        } else {
            return { result: false, message: 'No RDP detected' };
        }
    }

    // All check functions
    const checkAllFunctions = [
        // checkIntAccuracy,
        checkIfAllEmptyAccuracy,
        checkIfAllLatLongEmpty,
        checkIfDevtool,
        // checkIfAllAccuracySame,
        // checkIfAllLatLongSame,
        checkVirtualMachine,
        rdpCheck,
        userAgentGpuMatch
    ];

    // Run all checks
    function runAllChecks(data) {
        const results = [];
        const errorMessages = [];
        let hasAnyIssues = false;
        
        for (const checkFunction of checkAllFunctions) {
            const { result, message } = checkFunction(data);
            results.push({
                checkName: checkFunction.name,
                result: result,
                message: message
            });
            
            if (result) {
                hasAnyIssues = true;
                if (message) {
                    errorMessages.push(message);
                }
            }
        }
        
        return {
            hasIssues: hasAnyIssues,
            results: results,
            errorMessages: errorMessages,
            summary: {
                totalChecks: checkAllFunctions.length,
                failedChecks: results.filter(r => r.result).length,
                passedChecks: results.filter(r => !r.result).length
            }
        };
    }

    // Export public API
    return {
        runAllChecks: runAllChecks,
        checks: {
            // checkIntAccuracy,
            checkIfAllEmptyAccuracy,
            checkIfAllLatLongEmpty,
            checkIfDevtool,
            // checkIfAllAccuracySame,
            // checkIfAllLatLongSame,
            checkVirtualMachine,
            rdpCheck,
            userAgentGpuMatch
        }
    };
})(); 