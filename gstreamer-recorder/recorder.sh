#!/bin/bash
set -e

# --- 設定 ---
MINIO_ALIAS="myminio"
MINIO_SERVER="http://minio:9000"
MINIO_USER="minioadmin"
MINIO_PASSWORD="minioadmin123" # docker-compose.ymlと合わせる
BUCKET_NAME="camera1"
VIDEO_DIR="/app/videos"

echo "[Recorder] 起動しました。MinIOが利用可能になるのを待ちます..."
for i in {1..30}; do
  mc alias set $MINIO_ALIAS $MINIO_SERVER $MINIO_USER $MINIO_PASSWORD && break
  echo "[Recorder] MinIOがまだ準備できていません。再試行します ($i/30)..."
  sleep 1
done
if [ $i -eq 30 ]; then
  echo "[Recorder] MinIOが準備できませんでした。スクリプトを終了します。" >&2
  exit 1
fi

echo "[Recorder] MinIOクライアントを設定します..."
mc alias set $MINIO_ALIAS $MINIO_SERVER $MINIO_USER $MINIO_PASSWORD

echo "[Recorder] バケット '$BUCKET_NAME' を作成します（存在しない場合）..."
mc mb $MINIO_ALIAS/$BUCKET_NAME || true

echo "[Recorder] バケット '$BUCKET_NAME' に1日のライフサイクルルールを設定します..."
mc ilm add $MINIO_ALIAS/$BUCKET_NAME --expire-days "1"

mkdir -p $VIDEO_DIR

# --- GStreamerでの録画をバックグラウンドで開始 ---
echo "[Recorder] GStreamerパイプラインをバックグラウンドで開始します..."
# UDPポート5000で受信したMPEG-TSストリームを、60秒ごとにMP4ファイルとして保存する
gst-launch-1.0 -v udpsrc port=5000 ! \
tsdemux ! \
h264parse ! \
splitmuxsink location="$VIDEO_DIR/video_%05d.mp4" max-size-time=60000000000 &

# --- ファイルを監視してアップロードするループ処理 ---
echo "[Recorder] ファイル生成の監視を開始します..."
inotifywait -m -e close_write --format '%w%f' "$VIDEO_DIR" | while read FILENAME
do
  echo "  [Uploader] 新しいファイル検知: $FILENAME"
  echo "  [Uploader] MinIOバケット '$BUCKET_NAME' へアップロードを開始します..."
  
  # mc cpでファイルをアップロードし、成功したら(&&)ローカルのファイルを削除(rm)する
  mc cp "$FILENAME" "$MINIO_ALIAS/$BUCKET_NAME/" && rm "$FILENAME"
  
  echo "  [Uploader] アップロード完了、ローカルファイルを削除しました: $FILENAME"
done
