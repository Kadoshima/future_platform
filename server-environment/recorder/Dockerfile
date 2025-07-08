# Dockerfile
FROM python:3.9-slim

# GStreamer, MinIO Client (mc), そしてファイル監視ツール(inotify-tools)をインストール
RUN apt-get update && apt-get install -y \
    gstreamer1.0-tools \
    gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad \
    gstreamer1.0-libav \
    curl \
    inotify-tools \
    && apt-get clean

# MinIOクライアント(mc)をダウンロードして実行可能にします
RUN curl https://dl.min.io/client/mc/release/linux-amd64/mc \
    --create-dirs \
    -o /usr/local/bin/mc && \
    chmod +x /usr/local/bin/mc

# 作業ディレクトリを設定
WORKDIR /app

# recorder.shをコンテナ内にコピーして実行可能にします
COPY recorder.sh .
RUN chmod +x recorder.sh

# コンテナ起動時にrecorder.shを実行します
CMD ["./recorder.sh"]
