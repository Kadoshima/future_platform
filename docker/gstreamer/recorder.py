#!/usr/bin/env python3

import os
import sys
import time
import threading
from datetime import datetime
from minio import Minio
from minio.error import S3Error
import gi
gi.require_version('Gst', '1.0')
from gi.repository import Gst, GLib

class VideoRecorder:
    def __init__(self, camera_id, port):
        self.camera_id = camera_id
        self.port = port
        self.pipeline = None
        self.recording = False
        self.segment_duration = 60  # 60 seconds per file
        self.current_segment = 0
        
        # MinIO configuration
        self.minio_client = Minio(
            os.environ.get('MINIO_ENDPOINT', 'localhost:9000'),
            access_key=os.environ.get('MINIO_ACCESS_KEY', 'minioadmin'),
            secret_key=os.environ.get('MINIO_SECRET_KEY', 'minioadmin123'),
            secure=False
        )
        
        # Ensure bucket exists
        self.bucket_name = f"camera-{camera_id}"
        self.ensure_bucket()
        
    def ensure_bucket(self):
        try:
            if not self.minio_client.bucket_exists(self.bucket_name):
                self.minio_client.make_bucket(self.bucket_name)
                print(f"Created bucket: {self.bucket_name}")
        except S3Error as e:
            print(f"Error creating bucket: {e}")
            
    def create_pipeline(self):
        # Create GStreamer pipeline for UDP to MP4 recording
        pipeline_str = f"""
            udpsrc port={self.port} ! 
            application/x-rtp,media=video,encoding-name=H264 ! 
            rtph264depay ! 
            h264parse ! 
            mp4mux fragment-duration={self.segment_duration * 1000} ! 
            filesink location=/tmp/recording_{self.camera_id}_%d.mp4
        """
        
        self.pipeline = Gst.parse_launch(pipeline_str)
        
        # Set up bus to listen for messages
        bus = self.pipeline.get_bus()
        bus.add_signal_watch()
        bus.connect("message", self.on_message)
        
    def on_message(self, bus, message):
        t = message.type
        if t == Gst.MessageType.EOS:
            print(f"End of stream for camera {self.camera_id}")
            self.stop_recording()
        elif t == Gst.MessageType.ERROR:
            err, debug = message.parse_error()
            print(f"Error for camera {self.camera_id}: {err}, {debug}")
            self.stop_recording()
            
    def start_recording(self):
        if not self.recording:
            self.create_pipeline()
            self.pipeline.set_state(Gst.State.PLAYING)
            self.recording = True
            print(f"Started recording for camera {self.camera_id} on port {self.port}")
            
            # Start upload thread
            self.upload_thread = threading.Thread(target=self.upload_segments)
            self.upload_thread.daemon = True
            self.upload_thread.start()
            
    def stop_recording(self):
        if self.recording and self.pipeline:
            self.pipeline.set_state(Gst.State.NULL)
            self.recording = False
            print(f"Stopped recording for camera {self.camera_id}")
            
    def upload_segments(self):
        while self.recording:
            time.sleep(self.segment_duration + 5)  # Wait for segment + buffer
            
            # Check for completed segments
            for i in range(self.current_segment, self.current_segment + 10):
                filename = f"/tmp/recording_{self.camera_id}_{i}.mp4"
                if os.path.exists(filename) and os.path.getsize(filename) > 0:
                    # Upload to MinIO
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    object_name = f"{timestamp}_{self.camera_id}_segment_{i}.mp4"
                    
                    try:
                        self.minio_client.fput_object(
                            self.bucket_name,
                            object_name,
                            filename
                        )
                        print(f"Uploaded {object_name} to MinIO")
                        
                        # Delete local file after upload
                        os.remove(filename)
                        self.current_segment = i + 1
                    except S3Error as e:
                        print(f"Error uploading to MinIO: {e}")

def main():
    Gst.init(None)
    
    # Camera configurations (camera_id: port)
    cameras = {
        "camera1": 5000,
        "camera2": 5001,
        "camera3": 5002,
        "camera4": 5003
    }
    
    recorders = []
    
    # Start recorders for all cameras
    for camera_id, port in cameras.items():
        recorder = VideoRecorder(camera_id, port)
        recorder.start_recording()
        recorders.append(recorder)
    
    # Run main loop
    try:
        loop = GLib.MainLoop()
        loop.run()
    except KeyboardInterrupt:
        print("Stopping all recorders...")
        for recorder in recorders:
            recorder.stop_recording()

if __name__ == "__main__":
    main()