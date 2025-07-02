export interface ActionRequest {
  type: 'VIDEO_PLAY' | 'AUDIO_PLAY' | 'CUSTOM';
  payload: Record<string, any>;
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
}

export interface VideoPlayAction {
  videoId: string;
  loop?: boolean;
  volume?: number;
}

export interface AudioPlayAction {
  audioId: string;
  text?: string;
  volume?: number;
}