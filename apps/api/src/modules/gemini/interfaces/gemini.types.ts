/** Formato nativo do SDK Gemini para histórico de conversa */
export interface ChatMessage {
  role: 'user' | 'model';
  parts: [{ text: string }];
}

/** Contexto adicional passado ao método chat */
export interface ChatContext {
  userName?: string;
  currentList?: string[];
}

/** Item individual de uma lista de compras estruturada */
export interface ShoppingItem {
  name: string;
  quantity: number;
  unit: string;
  priority: 'high' | 'medium' | 'low';
  estimatedPrice?: number;
}

/** Resultado de geração de lista estruturada */
export interface ShoppingListOutput {
  items: ShoppingItem[];
  totalEstimated?: number;
  suggestions?: string[];
}

/** Resultado interno do método chat com metadados */
export interface GeminiChatResult {
  text: string;
  tokensUsed?: number;
  modelUsed: string;
}
