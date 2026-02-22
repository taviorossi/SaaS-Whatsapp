export type WhatsAppMessageType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contacts'
  | 'interactive'
  | 'button'
  | 'order'
  | 'system'
  | 'unknown';

export interface WhatsAppTextBody {
  body: string;
}

export interface WhatsAppMediaBody {
  id: string;
  mime_type?: string;
  sha256?: string;
  caption?: string;
}

export interface WhatsAppInteractiveReply {
  type: 'button_reply' | 'list_reply';
  button_reply?: { id: string; title: string };
  list_reply?: { id: string; title: string; description?: string };
}

export interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: WhatsAppMessageType;
  text?: WhatsAppTextBody;
  image?: WhatsAppMediaBody;
  audio?: WhatsAppMediaBody;
  video?: WhatsAppMediaBody;
  document?: WhatsAppMediaBody;
  interactive?: WhatsAppInteractiveReply;
  referral?: Record<string, unknown>;
  context?: {
    from: string;
    id: string;
  };
}

export interface WhatsAppContact {
  profile: { name: string };
  wa_id: string;
}

export interface WhatsAppStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string }>;
}

export interface WhatsAppValue {
  messaging_product: 'whatsapp';
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
  errors?: Array<{ code: number; title: string; message: string }>;
}

export interface WhatsAppChange {
  value: WhatsAppValue;
  field: string;
}

export interface WhatsAppEntry {
  id: string;
  changes: WhatsAppChange[];
}

export interface WhatsAppWebhookPayload {
  object: 'whatsapp_business_account';
  entry: WhatsAppEntry[];
}

/** Job payload enfileirado no BullMQ */
export interface WhatsAppMessageJob {
  messageId: string;
  from: string;
  message: WhatsAppMessage;
  contact?: WhatsAppContact;
  phoneNumberId: string;
  receivedAt: string;
}
