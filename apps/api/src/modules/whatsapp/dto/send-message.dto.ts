import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class SendTextMessageDto {
  @IsString()
  @IsNotEmpty()
  to: string;

  @IsString()
  @IsNotEmpty()
  text: string;
}

export class SendTemplateMessageDto {
  @IsString()
  @IsNotEmpty()
  to: string;

  @IsString()
  @IsNotEmpty()
  templateName: string;

  @IsString()
  @IsNotEmpty()
  languageCode: string;

  @IsOptional()
  @IsObject({ each: true })
  components?: Record<string, unknown>[];
}

export class SendInteractiveMessageDto {
  @IsString()
  @IsNotEmpty()
  to: string;

  @IsObject()
  interactive: Record<string, unknown>;
}
