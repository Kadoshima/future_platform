import dotenv from 'dotenv';
import { IsInt, IsString, Min, validateSync } from 'class-validator';
import { plainToClass } from 'class-transformer';

dotenv.config();

class EnvironmentVariables {
  @IsString()
  MQTT_BROKER_URL: string = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';

  @IsString()
  MQTT_CLIENT_ID: string = process.env.MQTT_CLIENT_ID || 'integration-controller';

  MQTT_USERNAME: string = process.env.MQTT_USERNAME || '';
  MQTT_PASSWORD: string = process.env.MQTT_PASSWORD || '';

  @IsString()
  MQTT_STATE_TOPIC: string = process.env.MQTT_STATE_TOPIC || 'sensor/+/state';

  @IsString()
  MQTT_EVENT_TOPIC: string = process.env.MQTT_EVENT_TOPIC || 'sensor/+/event';

  @IsString()
  NODE_ENV: string = process.env.NODE_ENV || 'development';

  @IsString()
  LOG_LEVEL: string = process.env.LOG_LEVEL || 'info';

  @IsString()
  VIDEO_PLAYER_API_URL: string = process.env.VIDEO_PLAYER_API_URL || 'http://localhost:8080';

  @IsString()
  AUDIO_PLAYER_API_URL: string = process.env.AUDIO_PLAYER_API_URL || 'http://localhost:8081';

  @IsInt()
  @Min(1)
  MAJORITY_VOTE_THRESHOLD: number = parseInt(process.env.MAJORITY_VOTE_THRESHOLD || '3', 10);
}

function validateConfig(config: Record<string, any>): EnvironmentVariables {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}

export const config = validateConfig(process.env);