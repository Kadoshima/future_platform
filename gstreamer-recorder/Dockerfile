# Dockerfile

# ベースとなる軽量なPython環境のイメージを指定
FROM python:3.9-slim

# 必要なソフトウェアをインストール
# GStreamer: 映像の受信・録画用
# mc: MinIOへのアップロード用
# inotify-tools: ファイルの生成を監視するため
RUN apt-get update && apt-get install -y \
    gstreamer1.0-tools \
    gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad \
    gstreamer1.0-libav \
    curl \
    inotify-tools \
    && apt-get clean

# MinIOクライアント(mc)をダウンロードして実行可能にする
RUN curl https://dl.min.io/client/mc/release/linux-amd64/mc \
    --create-dirs \
    -o /usr/local/bin/mc && \
    chmod +x /usr/local/bin/mc

# コンテナ内の作業場所を設定
WORKDIR /app

# recorder.shをコンテナ内にコピーして実行権限を与える
COPY recorder.sh .
RUN chmod +x recorder.sh

# コンテナ起動時にrecorder.shを実行する
CMD ["./recorder.sh"]
