# Video Temporal Error Detector

A hackathon-ready web application that detects frame drops and frame merges in video files using Python Flask and OpenCV.

## Features

- **Upload & Analyze**: Drag & drop or browse to upload video files (MP4, AVI, MOV, MKV)
- **Frame Drop Detection**: Identifies missing frames through timestamp gaps and motion discontinuity
- **Frame Merge Detection**: Detects duplicated/blended frames using Laplacian variance analysis
- **Visual Annotations**: Color-coded output video (Green=Normal, Red=Drop, Yellow=Merge)
- **Timeline Heatmap**: Canvas-based visualization showing error distribution across all frames
- **Summary Statistics**: Total frames, drops detected, merges detected, processing time

## Tech Stack

- **Backend**: Python Flask + OpenCV + NumPy
- **Frontend**: Vanilla HTML/CSS/JS
- **No external dependencies**: Simple pip install

## Quick Start

### 1. Install Dependencies

```
bash
pip install -r requirements.txt
```

### 2. Run the Application

```
bash
python app.py
```

### 3. Open in Browser

Navigate to: http://127.0.0.1:5000

## Usage

1. **Upload**: Drag & drop a video file or click "Browse Video"
2. **Analyze**: Click "Analyze Video" button
3. **View Results**: 
   - Watch the annotated output video
   - See the timeline heatmap showing frame errors
   - Review summary statistics

## Detection Logic

### Frame Drop Detection
- **Timestamp Gaps**: Frames with irregular time intervals exceeding 1.5× the expected FPS interval
- **Motion Discontinuity**: Sudden unnatural jumps in frame-to-frame pixel differences

### Frame Merge Detection
- **Low Sharpness**: Uses Laplacian variance to measure image clarity
- **Threshold**: Frames with variance below 100 are flagged as potential merges

## Project Structure

```
video-temporal-error-detector/
├── app.py                 # Flask application & routes
├── detector.py           # Video processing & error detection
├── requirements.txt      # Python dependencies
├── uploads/              # Temporary upload storage
├── outputs/              # Processed videos & reports
├── templates/
│   └── index.html        # Main UI template
├── static/
│   ├── style.css         # Styling
│   └── script.js         # Frontend logic
└── README.md             # This file
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Main page |
| `/analyze` | POST | Upload and analyze video |
| `/output_video/<filename>` | GET | Serve annotated video |
| `/output_report/<filename>` | GET | Serve JSON report |

## Demo

1. Upload any short video (10-30 seconds recommended)
2. Click "Analyze Video"
3. View results:
   - Annotated video plays with color overlays
   - Timeline shows green/red/yellow bars per frame
   - Stats show error counts and processing time

## Limitations

- Maximum file size: 50MB
- Supported formats: MP4, AVI, MOV, MKV
- Processing time varies based on video length and resolution
- For best results: Use short videos (<30 seconds)

## Hackathon Tips

- **Fast Demo**: Pre-record a short video with intentional frame issues
- **Explain to Judges**: Use the "How It Works" section
- **Visual Clarity**: Red/Yellow markers make errors immediately visible
- **No Setup**: Single `pip install` + `python app.py` gets you running

## License

MIT License - Feel free to use for your hackathon projects!
