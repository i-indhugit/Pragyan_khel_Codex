// Video Temporal Error Detector - Client Script

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const videoInput = document.getElementById('videoInput');
const browseBtn = document.getElementById('browseBtn');
const demoBtn = document.getElementById('demoBtn');
const selectedFile = document.getElementById('selectedFile');
const fileName = document.getElementById('fileName');
const analyzeBtn = document.getElementById('analyzeBtn');
const uploadSection = document.getElementById('uploadSection');
const loadingSection = document.getElementById('loadingSection');
const resultsSection = document.getElementById('resultsSection');
const loadingStatus = document.getElementById('loadingStatus');
const progressFill = document.getElementById('progressFill');
const newAnalysisBtn = document.getElementById('newAnalysisBtn');
const themeToggle = document.getElementById('themeToggle');

// Slider elements
const motionSlider = document.getElementById('motionSlider');
const sharpnessSlider = document.getElementById('sharpnessSlider');
const motionVal = document.getElementById('motionVal');
const sharpVal = document.getElementById('sharpVal');

// Current session data
let currentSessionId = null;
let currentReportData = null;
let currentVideoFile = null;
let currentFps = 30;
let fpsChart = null;
let densityChart = null;

// Initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
    setupUploadArea();
    setupButtons();
    setupSliders();
    setupThemeToggle();
});

// Setup theme toggle
function setupThemeToggle() {
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark');
        const isDark = document.body.classList.contains('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
    
    // Load saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark');
    }
}

// Setup sliders
function setupSliders() {
    motionSlider.addEventListener('input', () => {
        motionVal.textContent = motionSlider.value;
    });
    
    sharpnessSlider.addEventListener('input', () => {
        sharpVal.textContent = sharpnessSlider.value;
    });
}

// Setup drag and drop upload area
function setupUploadArea() {
    // Click to browse
    uploadArea.addEventListener('click', (e) => {
        if (e.target !== browseBtn && e.target !== demoBtn) {
            videoInput.click();
        }
    });

    browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        videoInput.click();
    });

    // Demo button
    demoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        loadDemo();
    });

    // File input change
    videoInput.addEventListener('change', handleFileSelect);

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });
}

// Handle file selection
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

// Process selected file
function handleFile(file) {
    // Validate file type
    const allowedTypes = ['video/mp4', 'video/avi', 'video/quicktime', 'video/x-matroska'];
    const allowedExtensions = ['.mp4', '.avi', '.mov', '.mkv'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(fileExtension)) {
        alert('Invalid file type. Please upload MP4, AVI, MOV, or MKV files.');
        return;
    }
    
    // Validate file size (50MB)
    if (file.size > 50 * 1024 * 1024) {
        alert('File too large. Maximum size is 50MB.');
        return;
    }
    
    // Store file for re-analysis
    currentVideoFile = file;
    
    // Update UI
    fileName.textContent = file.name;
    uploadArea.style.display = 'none';
    selectedFile.style.display = 'flex';
}

// Load demo video
window.loadDemo = function() {
    alert('Demo mode: Please upload a sample video file to test the detector.\n\nThe detector will analyze for frame drops and merges.');
};

// Setup button handlers
function setupButtons() {
    analyzeBtn.addEventListener('click', () => analyzeVideo(false));
    newAnalysisBtn.addEventListener('click', resetToUpload);
}

// Re-analyze with current slider values
window.reAnalyze = function() {
    if (currentVideoFile) {
        analyzeVideo(true);
    }
};

// Analyze video
async function analyzeVideo(isReanalysis = false) {
    const file = isReanalysis ? currentVideoFile : videoInput.files[0];
    if (!file) {
        alert('Please select a video file first.');
        return;
    }
    
    // Show loading section
    uploadSection.style.display = 'none';
    loadingSection.style.display = 'block';
    resultsSection.style.display = 'none';
    
    // Update loading status
    loadingStatus.textContent = isReanalysis ? 'Re-analyzing with new thresholds...' : 'Uploading video...';
    progressFill.style.width = '20%';
    
    try {
        // Create form data
        const formData = new FormData();
        formData.append('video', file);
        
        // Add threshold parameters
        const motionThresh = motionSlider.value;
        const sharpnessThresh = sharpnessSlider.value;
        
        // Send request with threshold params
        loadingStatus.textContent = isReanalysis ? 'Re-analyzing frames...' : 'Analyzing frames...';
        progressFill.style.width = '50%';
        
        const response = await fetch(`/analyze?motion_thresh=${motionThresh}&sharpness_thresh=${sharpnessThresh}`, {
            method: 'POST',
            body: formData
        });
        
        progressFill.style.width = '80%';
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Analysis failed');
        }
        
        const result = await response.json();
        
        progressFill.style.width = '100%';
        loadingStatus.textContent = 'Rendering results...';
        
        // Store session data
        currentSessionId = result.session_id;
        currentFps = result.fps || 30;
        
        // Load report data
        await loadReportData(result.report);
        
        // Display results
        displayResults(result);
        
    } catch (error) {
        console.error('Analysis error:', error);
        alert('Error: ' + error.message);
        if (!isReanalysis) {
            resetToUpload();
        }
    }
}

// Load report data
async function loadReportData(reportFilename) {
    try {
        const response = await fetch(`/output_report/${reportFilename}`);
        if (!response.ok) {
            throw new Error('Failed to load report');
        }
        currentReportData = await response.json();
    } catch (error) {
        console.error('Error loading report:', error);
        currentReportData = null;
    }
}

// Display results
function displayResults(result) {
    // Hide loading, show results
    loadingSection.style.display = 'none';
    resultsSection.style.display = 'block';
    
    // Update summary cards
    const stats = result.statistics;
    document.getElementById('totalFrames').textContent = stats.total_frames;
    document.getElementById('dropsDetected').textContent = stats.drops_detected;
    document.getElementById('mergesDetected').textContent = stats.merges_detected;
    document.getElementById('processingTime').textContent = stats.processing_time + 's';
    
    // Update performance badge
    const processingRate = (stats.total_frames / stats.processing_time).toFixed(0);
    document.getElementById('perfStats').textContent = `${stats.total_frames} frames in ${stats.processing_time}s (${processingRate} FPS)`;
    
    // Set video source
    const video = document.getElementById('resultVideo');
    video.src = `/output_video/${result.output_video}`;
    
    // Draw timeline and setup video sync
    if (currentReportData && currentReportData.frames) {
        setupVideoTimelineSync(video, currentReportData.frames, currentFps);
        drawTimeline(currentReportData.frames);
        drawFpsChart(currentReportData.frames, currentFps);
        drawDensityChart(currentReportData.frames);
        generateInsights(currentReportData, stats);
    }
    
    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// Setup video timeline synchronization
function setupVideoTimelineSync(video, frames, fps) {
    const canvas = document.getElementById('timelineCanvas');
    const playhead = document.getElementById('playhead');
    const totalFrames = frames.length;
    
    // Video timeupdate event - sync playhead with video
    video.addEventListener('timeupdate', () => {
        const currentTime = video.currentTime;
        const currentFrame = Math.floor(currentTime * fps);
        const progress = (currentFrame / totalFrames) * 100;
        playhead.style.left = Math.min(progress, 100) + '%';
    });
    
    // Canvas click - jump video to frame
    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const clickPosition = x / rect.width;
        const frameIndex = Math.floor(clickPosition * totalFrames);
        
        // Jump video to that frame
        const targetTime = frameIndex / fps;
        video.currentTime = targetTime;
        
        // Show frame inspector
        showFrameInspector(frameIndex);
    });
    
    // Video click to play/pause (optional - allows normal video controls)
    video.addEventListener('play', () => {
        playhead.classList.add('playing');
    });
    
    video.addEventListener('pause', () => {
        playhead.classList.remove('playing');
    });
}

// Show frame inspector modal
window.showFrameInspector = function(frameIndex) {
    if (!currentReportData || !currentReportData.frames) return;
    
    const frame = currentReportData.frames[frameIndex];
    if (!frame) return;
    
    const modal = document.getElementById('frameModal');
    const videoFilename = document.getElementById('resultVideo').src.split('/').pop();
    
    // Update modal content
    document.getElementById('frameNumber').textContent = frame.frame_index;
    document.getElementById('frameStatus').textContent = frame.status;
    document.getElementById('frameStatus').className = 'status-' + frame.status.toLowerCase();
    document.getElementById('frameConfidence').textContent = (frame.confidence * 100).toFixed(0) + '%';
    document.getElementById('frameTimestamp').textContent = frame.timestamp.toFixed(2) + 'ms';
    document.getElementById('frameSharpness').textContent = frame.sharpness.toFixed(2);
    
    // Set thumbnail - try to load from video at that frame
    const frameThumb = document.getElementById('frameThumb');
    frameThumb.src = `/thumbnails/${videoFilename}/${frameIndex}`;
    frameThumb.onerror = function() {
        // If thumbnail fails, show placeholder
        this.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect fill="%23333" width="320" height="180"/><text fill="%23999" x="50%" y="50%" text-anchor="middle" dy=".3em">Frame ' + frameIndex + '</text></svg>';
    };
    
    // Show modal
    modal.style.display = 'flex';
};

// Close modal
window.closeModal = function() {
    document.getElementById('frameModal').style.display = 'none';
};

// Close modal when clicking outside
document.getElementById('frameModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
});

// Draw timeline heatmap
function drawTimeline(frames) {
    const canvas = document.getElementById('timelineCanvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    const width = rect.width;
    const height = rect.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw each frame
    frames.forEach((frame, index) => {
        let color;
        switch (frame.status) {
            case 'Normal':
                color = '#10B981'; // Green
                break;
            case 'Drop':
                color = '#EF4444'; // Red
                break;
            case 'Merge':
                color = '#F59E0B'; // Yellow
                break;
            default:
                color = '#9CA3AF'; // Gray
        }
        
        ctx.fillStyle = color;
        const x = index * (width / frames.length);
        const barWidth = Math.max(1, width / frames.length);
        ctx.fillRect(x, 0, Math.ceil(barWidth), height);
    });
    
    // Update timeline end label
    document.getElementById('timelineEnd').textContent = `Frame ${frames.length - 1}`;
}

// Draw FPS chart using Chart.js - COMPACT VERSION
function drawFpsChart(frames, fps) {
    const ctx = document.getElementById('fpsChart').getContext('2d');
    
    // Destroy existing chart if any
    if (fpsChart) {
        fpsChart.destroy();
    }
    
    // Sample data - max 20 points for very compact display
    const maxPoints = 20;
    const step = Math.max(1, Math.floor(frames.length / maxPoints));
    
    const sampledData = [];
    for (let i = 0; i < frames.length; i += step) {
        const frame = frames[i];
        let calcFps = fps;
        if (i > 0) {
            const prevFrame = frames[Math.max(0, i - 1)];
            const tsGap = frame.ts_gap || (frame.timestamp - prevFrame.timestamp);
            if (tsGap > 0) calcFps = 1000 / tsGap;
        }
        sampledData.push({ index: i, fps: calcFps });
    }
    
    const labels = sampledData.map(d => d.index);
    const fpsData = sampledData.map(d => d.fps);
    
    // Create chart
    fpsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'FPS',
                data: fpsData,
                borderColor: '#4F46E5',
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: (items) => `Frame ${items[0].label}`,
                        label: (item) => `FPS: ${item.raw.toFixed(2)}`
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: { display: true, text: 'Frame' },
                    grid: { display: false },
                    ticks: { maxTicksLimit: 6 }
                },
                y: {
                    display: true,
                    title: { display: true, text: 'FPS' },
                    suggestedMin: 0,
                    suggestedMax: fps * 1.5
                }
            }
        }
    });
}

// Draw Error Density Chart (Bar Chart) - COMPACT VERSION
function drawDensityChart(frames) {
    const ctx = document.getElementById('densityChart').getContext('2d');
    
    // Destroy existing chart if any
    if (densityChart) {
        densityChart.destroy();
    }
    
    // Use larger windows for compact display
    const windowSize = Math.max(10, Math.floor(frames.length / 10));
    const numWindows = Math.ceil(frames.length / windowSize);
    const dropData = [];
    const mergeData = [];
    const labels = [];
    
    for (let i = 0; i < numWindows; i++) {
        const startFrame = i * windowSize;
        const endFrame = Math.min((i + 1) * windowSize, frames.length);
        const windowFrames = frames.slice(startFrame, endFrame);
        
        const drops = windowFrames.filter(f => f.status === 'Drop').length;
        const merges = windowFrames.filter(f => f.status === 'Merge').length;
        
        dropData.push(drops);
        mergeData.push(merges);
        labels.push(`${startFrame}-${endFrame - 1}`);
    }
    
    // Create stacked bar chart
    densityChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Drops',
                    data: dropData,
                    backgroundColor: '#EF4444',
                    borderColor: '#DC2626',
                    borderWidth: 1
                },
                {
                    label: 'Merges',
                    data: mergeData,
                    backgroundColor: '#F59E0B',
                    borderColor: '#D97706',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Frame Range'
                    },
                    stacked: true,
                    ticks: { maxTicksLimit: 8 }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Error Count'
                    },
                    stacked: true,
                    beginAtZero: true
                }
            }
        }
    });
}

// Generate Smart Insights
function generateInsights(reportData, stats) {
    const frames = reportData.frames;
    const totalFrames = stats.total_frames;
    const drops = stats.drops_detected;
    const merges = stats.merges_detected;
    const totalErrors = drops + merges;
    
    // Calculate error rate percentage
    const errorRate = ((totalErrors / totalFrames) * 100).toFixed(1);
    
    // Find frame range with most errors
    const windowSize = 10;
    let maxErrors = 0;
    let maxErrorRange = '0-0';
    
    for (let i = 0; i < Math.ceil(frames.length / windowSize); i++) {
        const startFrame = i * windowSize;
        const endFrame = Math.min((i + 1) * windowSize, frames.length);
        const windowFrames = frames.slice(startFrame, endFrame);
        const errors = windowFrames.filter(f => f.status !== 'Normal').length;
        
        if (errors > maxErrors) {
            maxErrors = errors;
            maxErrorRange = `${startFrame}-${endFrame - 1}`;
        }
    }
    
    // Calculate peak error density (errors per 10 frames)
    const peakDensity = maxErrors;
    
    // Generate insights HTML
    const insightsHTML = `
        <p>• <span class="insight-highlight">Total Errors:</span> ${totalErrors} (${errorRate}% error rate)</p>
        <p>• <span class="insight-highlight">Most Problematic Segment:</span> Frames ${maxErrorRange} (${maxErrors} errors)</p>
        <p>• <span class="insight-highlight">Peak Error Density:</span> ${peakDensity} errors per 10 frames</p>
        <p>• <span class="insight-highlight">Detection Summary:</span> ${drops} frame drops + ${merges} frame merges</p>
    `;
    
    document.getElementById('insightsContent').innerHTML = insightsHTML;
}

// Reset to upload section
function resetToUpload() {
    // Reset file input
    videoInput.value = '';
    currentSessionId = null;
    currentReportData = null;
    currentVideoFile = null;
    
    // Reset video
    const video = document.getElementById('resultVideo');
    video.src = '';
    
    // Destroy charts
    if (fpsChart) {
        fpsChart.destroy();
        fpsChart = null;
    }
    if (densityChart) {
        densityChart.destroy();
        densityChart = null;
    }
    
    // Reset UI
    uploadSection.style.display = 'block';
    uploadArea.style.display = 'block';
    selectedFile.style.display = 'none';
    loadingSection.style.display = 'none';
    resultsSection.style.display = 'none';
    
    // Reset progress
    progressFill.style.width = '0%';
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Handle window resize for canvas
window.addEventListener('resize', () => {
    if (currentReportData && currentReportData.frames) {
        drawTimeline(currentReportData.frames);
    }
});
