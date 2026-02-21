"""
Video Temporal Error Detector
Detects frame drops and frame merges in video files using OpenCV.
"""

import cv2
import numpy as np
import json
import os
from datetime import datetime


def calculate_sharpness(frame):
    """
    Calculate frame sharpness using Laplacian variance.
    Higher values indicate sharper images.
    """
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    return laplacian.var()


def calculate_frame_difference(prev_frame, curr_frame):
    """
    Calculate motion discontinuity between frames using frame difference.
    """
    if prev_frame is None:
        return 0
    
    # Resize for faster processing
    prev_resized = cv2.resize(prev_frame, (320, 240))
    curr_resized = cv2.resize(curr_frame, (320, 240))
    
    # Convert to grayscale
    prev_gray = cv2.cvtColor(prev_resized, cv2.COLOR_BGR2GRAY)
    curr_gray = cv2.cvtColor(curr_resized, cv2.COLOR_BGR2GRAY)
    
    # Calculate absolute difference
    diff = cv2.absdiff(prev_gray, curr_gray)
    
    # Return mean difference as a measure of motion
    return np.mean(diff)


def get_status_color(status):
    """
    Returns BGR color for each status.
    Green = Normal, Red = Drop, Yellow = Merge
    """
    if status == "Normal":
        return (0, 255, 0)    # Green
    elif status == "Drop":
        return (0, 0, 255)    # Red
    elif status == "Merge":
        return (0, 255, 255)  # Yellow
    return (255, 255, 255)    # White


def process_video(input_path, output_path, report_path, motion_thresh=1.5, sharpness_thresh=100):
    """
    Process video and detect temporal errors.
    
    Args:
        input_path: Path to input video
        output_path: Path to save annotated output video
        report_path: Path to save JSON report
        motion_thresh: Motion discontinuity threshold multiplier (default: 1.5)
        sharpness_thresh: Sharpness threshold for merge detection (default: 100)
    
    Returns:
        dict: Processing results including frame data and statistics
    """
    start_time = datetime.now()
    
    # Open video capture
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        raise ValueError(f"Could not open video file: {input_path}")
    
    # Get video properties
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    # Calculate expected frame interval in milliseconds
    expected_interval = 1000.0 / fps if fps > 0 else 33.33
    
    # Thresholds - use parameters with fallbacks
    drop_threshold = expected_interval * motion_thresh
    merge_sharpness_threshold = sharpness_thresh
    motion_discontinuity_threshold = 30.0
    
    # Initialize video writer
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    
    # Results storage
    frame_results = []
    prev_frame = None
    prev_timestamp = 0
    drop_count = 0
    merge_count = 0
    
    frame_idx = 0
    
    print(f"Processing video: {fps} FPS, {frame_count} frames")
    print(f"Thresholds - Motion: {motion_thresh}, Sharpness: {sharpness_thresh}")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        # Get current timestamp
        timestamp = cap.get(cv2.CAP_PROP_POS_MSEC)
        
        # Calculate metrics
        sharpness = calculate_sharpness(frame)
        frame_diff = calculate_frame_difference(prev_frame, frame)
        
        # Determine status
        status = "Normal"
        
        # Check for frame drop (irregular timestamp gap)
        time_gap = timestamp - prev_timestamp
        if frame_idx > 0 and time_gap > drop_threshold:
            status = "Drop"
            drop_count += 1
        # Check for frame drop (motion discontinuity)
        elif frame_idx > 1 and frame_diff > motion_discontinuity_threshold * 3:
            # Additional check: if there's a sudden large jump in frame difference
            status = "Drop"
            drop_count += 1
        # Check for frame merge (low sharpness)
        elif sharpness < merge_sharpness_threshold:
            status = "Merge"
            merge_count += 1
        
        # Store frame result
        confidence = min(1.0, max(0.0, sharpness / 200.0))
        frame_results.append({
            "frame_index": frame_idx,
            "status": status,
            "confidence": round(confidence, 2),
            "timestamp": round(timestamp, 2),
            "sharpness": round(sharpness, 2),
            "frame_diff": round(frame_diff, 2),
            "ts_gap": round(time_gap, 2) if frame_idx > 0 else 0
        })
        
        # Add color overlay to frame
        color = get_status_color(status)
        
        # Draw overlay rectangle
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (width, 60), color, -1)
        cv2.addWeighted(overlay, 0.3, frame, 0.7, 0, frame)
        
        # Draw frame label
        label = f"Frame {frame_idx}: {status}"
        cv2.putText(frame, label, (10, 35), 
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        
        # Draw status indicator
        cv2.circle(frame, (width - 40, 30), 15, color, -1)
        
        # Write annotated frame
        out.write(frame)
        
        prev_frame = frame.copy()
        prev_timestamp = timestamp
        frame_idx += 1
    
    # Release resources
    cap.release()
    out.release()
    
    # Calculate processing time
    processing_time = (datetime.now() - start_time).total_seconds()
    
    # Prepare report
    report = {
        "video_info": {
            "fps": fps,
            "frame_count": frame_count,
            "width": width,
            "height": height,
            "duration": frame_count / fps if fps > 0 else 0
        },
        "statistics": {
            "total_frames": frame_count,
            "drops_detected": drop_count,
            "merges_detected": merge_count,
            "normal_frames": frame_count - drop_count - merge_count,
            "processing_time": round(processing_time, 2)
        },
        "frames": frame_results
    }
    
    # Save report
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"Processing complete in {processing_time:.2f}s")
    print(f"Drops: {drop_count}, Merges: {merge_count}, Normal: {frame_count - drop_count - merge_count}")
    
    return report


def get_report_data(report_path):
    """
    Load and return report data from JSON file.
    """
    with open(report_path, 'r') as f:
        return json.load(f)
