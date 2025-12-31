/**
 * Telegram Client
 * Handles communication with Telegram Bot API
 */

import axios from 'axios';

/**
 * Telegram Message Parameters
 */
export interface TelegramMessage {
  chat_id: string;
  text: string;
  parse_mode?: 'Markdown' | 'HTML';
}

/**
 * Telegram Send Response
 */
export interface TelegramSendResponse {
  message_id: number;
}

/**
 * Telegram Client
 */
export class TelegramClient {
  private apiUrl: string;

  constructor(botToken: string) {
    this.apiUrl = `https://api.telegram.org/bot${botToken}`;
  }

  /**
   * Send a message via Telegram
   *
   * @param message - Message parameters
   * @returns Message ID from Telegram
   * @throws Error if send fails
   */
  async sendMessage(message: TelegramMessage): Promise<TelegramSendResponse> {
    try {
      const response = await axios.post(`${this.apiUrl}/sendMessage`, {
        chat_id: message.chat_id,
        text: message.text,
        parse_mode: message.parse_mode || 'Markdown',
      });

      if (!response.data.ok) {
        throw new Error(`Telegram API error: ${response.data.description}`);
      }

      return {
        message_id: response.data.result.message_id,
      };
    } catch (error: any) {
      if (error.response) {
        // Telegram API returned an error
        const errorMsg = error.response.data?.description || error.message;
        throw new Error(`Telegram send failed: ${errorMsg}`);
      } else if (error.request) {
        // Request was made but no response received
        throw new Error('Telegram send failed: No response from server');
      } else {
        // Something else happened
        throw new Error(`Telegram send failed: ${error.message}`);
      }
    }
  }

  /**
   * Test bot connection
   *
   * @returns true if bot token is valid
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.apiUrl}/getMe`);
      return response.data.ok === true;
    } catch (error) {
      console.error('Telegram connection test failed:', error);
      return false;
    }
  }

  /**
   * Get bot information
   *
   * @returns Bot information
   */
  async getBotInfo(): Promise<any> {
    try {
      const response = await axios.get(`${this.apiUrl}/getMe`);
      if (response.data.ok) {
        return response.data.result;
      }
      throw new Error('Failed to get bot info');
    } catch (error: any) {
      throw new Error(`Get bot info failed: ${error.message}`);
    }
  }
}
