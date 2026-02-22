import { IsArray, IsString } from 'class-validator';

/**
 * DTO mínimo para validação de entrada do webhook da Meta.
 * A estrutura profunda é validada via tipagem TypeScript (WhatsAppWebhookPayload)
 * pois a Meta pode adicionar campos sem aviso.
 */
export class WebhookPayloadDto {
  @IsString()
  object: string;

  @IsArray()
  entry: unknown[];
}
