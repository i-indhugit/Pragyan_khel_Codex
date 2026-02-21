// Video Temporal Error Detector - Client Script

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const videoInput = document.getElementById('videoInput');
const browseBtn = document.getElementById('browseBtn');
const selectedFile = document.getElementById('selectedFile');
const fileName = document.getElementById('fileName');
const analyzeBtn = document.getElementById('analyzeBtn');
const uploadSection = document.getElementById('uploadSection');
const loadingSection = document.getElementById('loadingSection');
const resultsSection = document.getElementById('resultsSection');
const loadingStatus = document.getElementById('loadingStatus');
const progressFill = document.getElementById('progressFill');
const newAnalysisBtn = document.getElementById('newAnalysisBtn');

// Current session data
let currentSessionId = null;
let currentReportData = null;

// Initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
    setupUploadArea();
    setupButtons();
});

// Setup drag and drop upload area
function setupUploadArea() {
    // Click to browse
    uploadArea.addEventListener('click', (e) => {
        if (e.target !== browseBtn) {
            videoInput.click();
        }
    });

    browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        videoInput.click();
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
    
    // Update UI
    fileName.textContent = file.name;
    uploadArea.style.display = 'none';
    selectedFile.style.display = 'flex';
}

// Setup button handlers
function setupButtons() {
    analyzeBtn.addEventListener('click', analyzeVideo);
    newAnalysisBtn.addEventListener('click', resetToUpload);
}

// Analyze video
async function analyzeVideo() {
    const file = videoInput.files[0];
    if (!file) {
        alert('Please select a video file first.');
        return;
    }
    
    // Show loading section
    uploadSection.style.display = 'none';
    loadingSection.style.display = 'block';
    resultsSection.style.display = 'none';
    
    // Update loading status
    loadingStatus.textContent = 'Uploading video...';
    progressFill.style.width = '20%';
    
    try {
        // Create form data
        const formData = new FormData();
        formData.append('video', file);
        
        // Send request
        loadingStatus.textContent = 'Analyzing frames...';
        progressFill.style.width = '50%';
        
        const response = await fetch('/analyze', {
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
        
        // Load report data
        await loadReportData(result.report);
        
        // Display results
        displayResults(result);
        
    } catch (error) {
        console.error('Analysis error:', error);
        alert('Error: ' + error.message);
        resetToUpload();
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
    
    // Set video source
    const video = document.getElementById('resultVideo');
    video.src = `/output_video/${result.output_video}`;
    
    // Draw timeline
    if (currentReportData && currentReportData.frames) {
        drawTimeline(currentReportData.frames);
    }
    
    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

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
    
    // Calculate bar width (1px minimum, scale to fit)
    const barWidth = Math.max(1, width / frames.length);
    const barHeight = height;
    
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
        ctx.fillRect(x, 0, Math.ceil(barWidth), barHeight);
    });
    
    // Update timeline end label
    document.getElementById('timelineEnd').textContent = `Frame ${frames.length - 1}`;
}

// Reset to upload section
function resetToUpload() {
    // Reset file input
    videoInput.value = '';
    currentSessionId = null;
    currentReportData = null;
    
    // Reset video
    const video = document.getElementById('resultVideo');
    video.src = '';
    
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
