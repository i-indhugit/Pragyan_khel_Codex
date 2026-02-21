"""
Video Temporal Error Detector - Flask Application
"""

import os
import uuid
import json
import cv2
from flask import Flask, render_template, request, jsonify, send_file, after_this_request
from werkzeug.utils import secure_filename
from datetime import datetime
import detector

app = Flask(__name__)

# Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
OUTPUT_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'outputs')
THUMBNAILS_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'thumbnails')
ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv'}
MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['OUTPUT_FOLDER'] = OUTPUT_FOLDER
app.config['THUMBNAILS_FOLDER'] = THUMBNAILS_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

# Ensure directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)
os.makedirs(THUMBNAILS_FOLDER, exist_ok=True)


def allowed_file(filename):
    """Check if file extension is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/')
def index():
    """Render the main page."""
    return render_template('index.html')


@app.route('/analyze', methods=['POST'])
def analyze_video():
    """
    Analyze uploaded video for temporal errors.
    Accepts video file, processes it, and returns results.
    """
    start_time = datetime.now()
    
    # Check if video file is present
    if 'video' not in request.files:
        return jsonify({'error': 'No video file provided'}), 400
    
    file = request.files['video']
    
    if file.filename == '':
        return jsonify({'error': 'No video file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type. Allowed: mp4, avi, mov, mkv'}), 400
    
    try:
        # Generate unique filename to prevent conflicts
        session_id = str(uuid.uuid4())
        original_filename = secure_filename(file.filename)
        name, ext = os.path.splitext(original_filename)
        
        input_filename = f"{session_id}{ext}"
        output_filename = f"{session_id}_annotated.mp4"
        report_filename = f"{session_id}_report.json"
        
        input_path = os.path.join(app.config['UPLOAD_FOLDER'], input_filename)
        output_path = os.path.join(app.config['OUTPUT_FOLDER'], output_filename)
        report_path = os.path.join(app.config['OUTPUT_FOLDER'], report_filename)
        
        # Save uploaded file
        file.save(input_path)
        
        # Get threshold parameters from request
        motion_thresh = float(request.args.get('motion_thresh', 1.5))
        sharpness_thresh = float(request.args.get('sharpness_thresh', 100))
        
        # Process video
        print(f"Starting analysis at {start_time}")
        print(f"Using thresholds - motion: {motion_thresh}, sharpness: {sharpness_thresh}")
        report = detector.process_video(input_path, output_path, report_path, motion_thresh, sharpness_thresh)
        
        processing_time = (datetime.now() - start_time).total_seconds()
        print(f"Analysis complete in {processing_time:.2f}s")
        
        # Clean up upload file after processing
        @after_this_request
        def remove_upload_file(response):
            try:
                if os.path.exists(input_path):
                    os.remove(input_path)
            except Exception as e:
                print(f"Error removing upload file: {e}")
            return response
        
        # Return results with fps
        return jsonify({
            'success': True,
            'session_id': session_id,
            'output_video': output_filename,
            'report': report_filename,
            'statistics': report['statistics'],
            'processing_time': round(processing_time, 2),
            'fps': report['video_info']['fps'],
            'total_frames': report['video_info']['frame_count']
        })
        
    except Exception as e:
        print(f"Error during analysis: {str(e)}")
        return jsonify({'error': f'Analysis failed: {str(e)}'}), 500


@app.route('/output_video/<filename>')
def get_output_video(filename):
    """Serve the annotated output video."""
    return send_file(
        os.path.join(app.config['OUTPUT_FOLDER'], filename),
        mimetype='video/mp4',
        as_attachment=False
    )


@app.route('/output_report/<filename>')
def get_output_report(filename):
    """Serve the JSON report file."""
    return send_file(
        os.path.join(app.config['OUTPUT_FOLDER'], filename),
        mimetype='application/json',
        as_attachment=False
    )


@app.route('/thumbnails/<path:filename>/<int:frame_idx>')
def get_thumbnail(filename, frame_idx):
    """Extract and serve a single frame as a thumbnail."""
    try:
        # Get the original video path from the output folder
        video_path = os.path.join(app.config['OUTPUT_FOLDER'], filename)
        
        if not os.path.exists(video_path):
            return jsonify({'error': 'Video not found'}), 404
        
        # Open video and extract frame
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return jsonify({'error': 'Could not open video'}), 400
        
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        cap.release()
        
        if not ret:
            return jsonify({'error': 'Could not extract frame'}), 400
        
        # Save thumbnail
        thumbnail_filename = f"{filename}_frame_{frame_idx}.png"
        thumbnail_path = os.path.join(app.config['THUMBNAILS_FOLDER'], thumbnail_filename)
        cv2.imwrite(thumbnail_path, frame)
        
        return send_file(
            thumbnail_path,
            mimetype='image/png',
            as_attachment=False
        )
        
    except Exception as e:
        print(f"Error extracting thumbnail: {str(e)}")
        return jsonify({'error': f'Failed to extract thumbnail: {str(e)}'}), 500


@app.errorhandler(413)
def request_entity_too_large(error):
    """Handle file too large error."""
    return jsonify({'error': 'File too large. Maximum size is 50MB.'}), 413


@app.errorhandler(500)
def internal_error(error):
    """Handle internal server errors."""
    return jsonify({'error': 'Internal server error occurred.'}), 500


if __name__ == '__main__':
    print("=" * 60)
    print("Video Temporal Error Detector")
    print("=" * 60)
    print("Starting server at http://127.0.0.1:5000")
    print("Press Ctrl+C to stop")
    print("=" * 60)
    app.run(debug=True, host='0.0.0.0', port=5000)
