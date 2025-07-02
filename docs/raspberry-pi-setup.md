# Raspberry Pi セットアップガイド

最終更新日: 2025年7月2日

## 概要

このドキュメントでは、センサーノードとして使用するRaspberry Piの環境構築手順を説明します。

## 必要なハードウェア

- Raspberry Pi 4 Model B (4GB以上推奨)
- カメラモジュール (Raspberry Pi Camera Module v2 または USB Webカメラ)
- microSDカード (32GB以上)
- 電源アダプター (5V 3A)
- 冷却ファン付きケース（推奨）

## OSのインストール

### 1. Raspberry Pi OSのダウンロード

```bash
# Raspberry Pi Imagerを使用（推奨）
# https://www.raspberrypi.org/software/

# または直接ダウンロード
wget https://downloads.raspberrypi.org/raspios_lite_arm64/images/raspios_lite_arm64-2023-05-03/2023-05-03-raspios-bullseye-arm64-lite.img.xz
```

### 2. SDカードへの書き込み

```bash
# macOS/Linux
sudo dd if=2023-05-03-raspios-bullseye-arm64-lite.img of=/dev/sdX bs=4M status=progress
```

### 3. 初期設定

```bash
# SSH有効化（bootパーティションに空のsshファイルを作成）
touch /Volumes/boot/ssh

# Wi-Fi設定（オプション）
cat > /Volumes/boot/wpa_supplicant.conf << EOF
country=JP
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1

network={
    ssid="YourWiFiSSID"
    psk="YourWiFiPassword"
}
EOF
```

## 基本セットアップ

### 1. システムの更新

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. 必要なパッケージのインストール

```bash
# 基本パッケージ
sudo apt install -y \
    python3-pip \
    python3-venv \
    git \
    vim \
    htop \
    build-essential \
    cmake \
    pkg-config \
    libjpeg-dev \
    libtiff5-dev \
    libpng-dev \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    libv4l-dev \
    libxvidcore-dev \
    libx264-dev \
    libfontconfig1-dev \
    libcairo2-dev \
    libgdk-pixbuf2.0-dev \
    libpango1.0-dev \
    libgtk2.0-dev \
    libgtk-3-dev \
    libatlas-base-dev \
    gfortran \
    libhdf5-dev \
    libhdf5-serial-dev \
    libqt5gui5 \
    libqt5webkit5 \
    libqt5test5 \
    python3-pyqt5
```

### 3. カメラの有効化

```bash
# raspi-configでカメラを有効化
sudo raspi-config
# Interface Options → Camera → Enable

# カメラの動作確認
raspistill -o test.jpg
```

## Python環境のセットアップ

### 1. 仮想環境の作成

```bash
# プロジェクトディレクトリ作成
mkdir -p ~/future_platform_sensor
cd ~/future_platform_sensor

# 仮想環境作成
python3 -m venv venv
source venv/bin/activate
```

### 2. 必要なPythonパッケージのインストール

```bash
# requirements.txt作成
cat > requirements.txt << EOF
opencv-python==4.8.0.74
numpy==1.24.3
paho-mqtt==1.6.1
ultralytics==8.0.200
mediapipe==0.10.5
pyyaml==6.0.1
python-dotenv==1.0.0
EOF

# インストール
pip install --upgrade pip
pip install -r requirements.txt
```

## センサーノードアプリケーションの設定

### 1. アプリケーションコードの配置

```python
# sensor_node.py
import cv2
import json
import time
import os
from datetime import datetime
from ultralytics import YOLO
import mediapipe as mp
import paho.mqtt.client as mqtt
from dotenv import load_dotenv
import threading
import subprocess

load_dotenv()

class SensorNode:
    def __init__(self, camera_id):
        self.camera_id = camera_id
        self.mqtt_client = None
        self.cap = None
        self.yolo_model = None
        self.pose_detector = None
        self.setup()
        
    def setup(self):
        # MQTT設定
        self.mqtt_client = mqtt.Client()
        self.mqtt_client.connect(
            os.getenv('MQTT_BROKER_HOST', 'localhost'),
            int(os.getenv('MQTT_BROKER_PORT', '1883')),
            60
        )
        
        # カメラ設定
        self.cap = cv2.VideoCapture(0)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        
        # YOLOモデル
        self.yolo_model = YOLO('yolov8n.pt')
        
        # MediaPipe
        mp_pose = mp.solutions.pose
        self.pose_detector = mp_pose.Pose(
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # GStreamerストリーミング開始
        self.start_streaming()
        
    def start_streaming(self):
        # GStreamerパイプライン
        gst_pipeline = f"""
            appsrc ! 
            videoconvert ! 
            x264enc tune=zerolatency bitrate=500 ! 
            rtph264pay config-interval=1 pt=96 ! 
            udpsink host={os.getenv('STREAM_HOST', 'localhost')} 
            port={5000 + int(self.camera_id[-1])}
        """
        
        # 別スレッドでストリーミング開始
        # 実装は省略
        
    def detect_people(self, frame):
        results = self.yolo_model(frame, classes=[0])  # person class only
        people = []
        
        for r in results:
            for box in r.boxes:
                x1, y1, x2, y2 = box.xyxy[0]
                conf = box.conf[0]
                
                # 姿勢推定
                person_img = frame[int(y1):int(y2), int(x1):int(x2)]
                posture = self.estimate_posture(person_img)
                
                people.append({
                    'id': f'person_{int(time.time())}_{len(people)}',
                    'posture': posture,
                    'confidence': float(conf)
                })
                
        return people
        
    def estimate_posture(self, person_img):
        # MediaPipeで姿勢推定
        # 簡略化のため詳細は省略
        return 'STANDING'  # or 'SITTING', 'WALKING', 'UNKNOWN'
        
    def publish_state(self, people):
        state_msg = {
            'type': 'state',
            'camera_id': self.camera_id,
            'timestamp': int(time.time() * 1000),
            'data': {
                'person_count': len(people),
                'people': people
            }
        }
        
        topic = f'sensor/{self.camera_id}/state'
        self.mqtt_client.publish(topic, json.dumps(state_msg))
        
    def run(self):
        try:
            while True:
                ret, frame = self.cap.read()
                if not ret:
                    continue
                    
                # 人物検出
                people = self.detect_people(frame)
                
                # 状態送信（1秒ごと）
                self.publish_state(people)
                
                time.sleep(1)
                
        except KeyboardInterrupt:
            print("Shutting down...")
        finally:
            self.cleanup()
            
    def cleanup(self):
        if self.cap:
            self.cap.release()
        if self.mqtt_client:
            self.mqtt_client.disconnect()

if __name__ == '__main__':
    camera_id = os.getenv('CAMERA_ID', 'camera1')
    node = SensorNode(camera_id)
    node.run()
```

### 2. 環境変数の設定

```bash
# .env ファイル作成
cat > .env << EOF
CAMERA_ID=camera1
MQTT_BROKER_HOST=192.168.1.100
MQTT_BROKER_PORT=1883
STREAM_HOST=192.168.1.100
EOF
```

### 3. systemdサービスの設定

```bash
# サービスファイル作成
sudo cat > /etc/systemd/system/sensor-node.service << EOF
[Unit]
Description=Future Platform Sensor Node
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/future_platform_sensor
Environment="PATH=/home/pi/future_platform_sensor/venv/bin"
ExecStart=/home/pi/future_platform_sensor/venv/bin/python sensor_node.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# サービスの有効化と起動
sudo systemctl daemon-reload
sudo systemctl enable sensor-node.service
sudo systemctl start sensor-node.service

# ログ確認
sudo journalctl -u sensor-node.service -f
```

## GStreamerの設定

### 1. GStreamerのインストール

```bash
sudo apt install -y \
    gstreamer1.0-tools \
    gstreamer1.0-plugins-base \
    gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad \
    gstreamer1.0-plugins-ugly \
    gstreamer1.0-libav \
    gstreamer1.0-rtsp \
    python3-gst-1.0
```

### 2. ストリーミングテスト

```bash
# カメラからのストリーミングテスト
gst-launch-1.0 v4l2src device=/dev/video0 ! \
    video/x-raw,width=640,height=480,framerate=30/1 ! \
    videoconvert ! \
    x264enc tune=zerolatency bitrate=500 ! \
    rtph264pay config-interval=1 pt=96 ! \
    udpsink host=192.168.1.100 port=5000
```

## パフォーマンスチューニング

### 1. GPU メモリの割り当て

```bash
# /boot/config.txt を編集
sudo nano /boot/config.txt

# 以下を追加または変更
gpu_mem=128
```

### 2. CPU ガバナーの設定

```bash
# パフォーマンスモードに設定
echo performance | sudo tee /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor
```

### 3. スワップの調整

```bash
# スワップサイズ変更
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile
# CONF_SWAPSIZE=2048 に変更
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

## トラブルシューティング

### カメラが認識されない

```bash
# カメラデバイスの確認
ls -la /dev/video*

# v4l2で確認
v4l2-ctl --list-devices

# dmesgでエラー確認
dmesg | grep -i camera
```

### MQTT接続エラー

```bash
# ネットワーク接続確認
ping 192.168.1.100

# MQTTポート確認
telnet 192.168.1.100 1883

# ファイアウォール確認
sudo iptables -L
```

### CPU温度が高い

```bash
# 温度確認
vcgencmd measure_temp

# 冷却ファンの設定
# /boot/config.txt に追加
dtoverlay=gpio-fan,gpiopin=14,temp=60000
```

## 監視とメンテナンス

### 1. 監視スクリプト

```bash
#!/bin/bash
# monitor.sh

# CPU使用率
echo "CPU Usage:"
top -bn1 | grep "Cpu(s)" | awk '{print $2 + $4"%"}'

# メモリ使用率
echo "Memory Usage:"
free -m | awk 'NR==2{printf "%.2f%%\n", $3*100/$2}'

# 温度
echo "Temperature:"
vcgencmd measure_temp

# サービス状態
echo "Service Status:"
systemctl is-active sensor-node.service
```

### 2. 自動再起動設定

```bash
# watchdogの設定
sudo apt install watchdog
sudo systemctl enable watchdog

# /etc/watchdog.conf を編集
echo "watchdog-device = /dev/watchdog" | sudo tee -a /etc/watchdog.conf
echo "max-load-1 = 24" | sudo tee -a /etc/watchdog.conf
```

## セキュリティ設定

### 1. ユーザー権限の制限

```bash
# 専用ユーザー作成
sudo useradd -m -s /bin/bash sensornode
sudo usermod -a -G video,gpio sensornode
```

### 2. ファイアウォール設定

```bash
# ufw設定
sudo apt install ufw
sudo ufw allow from 192.168.1.0/24 to any port 22
sudo ufw allow from 192.168.1.100 to any port 5000:5003/udp
sudo ufw enable
```

### 3. 自動アップデート

```bash
# unattended-upgradesの設定
sudo apt install unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```