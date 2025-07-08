export interface CameraEvent {
  name: 'PERSON_ENTERED' | 'SITTING_CONFIRMED' | 'PERSON_STOOD_UP' | 'ALL_PEOPLE_LEFT';
  command_request?: string;
}

export interface EventMessage {
  type: 'event';
  camera_id: string;
  timestamp: number;
  event: CameraEvent;
}

export interface Person {
  id: string;
  posture: 'SITTING' | 'STANDING' | 'WALKING' | 'UNKNOWN';
  confidence: number;
}

export interface StateMessage {
  type: 'state';
  camera_id: string;
  timestamp: number;
  data: {
    person_count: number;
    people: Person[];
  };
}

export type SensorMessage = EventMessage | StateMessage;