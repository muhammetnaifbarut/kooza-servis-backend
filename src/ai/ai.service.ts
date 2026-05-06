import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * AI Service — kooza ekosistem standardı (Anthropic Claude)
 *
 * Kullanım alanları (kooza Hizmet):
 *   - Sesli sipariş → metin + sipariş yapısı
 *   - Menü açıklaması üretimi
 *   - Müşteri yorum analizi (sentiment)
 *   - Yoğun saat tahmini
 *   - Stok dolum tahmini (talep forecast)
 *   - Kampanya metni üretimi
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly apiKey: string;
  private readonly model: string;

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get<string>('ANTHROPIC_API_KEY') || '';
    this.model = this.config.get<string>('AI_MODEL') || 'claude-sonnet-4-5-20250929';
  }

  isEnabled(): boolean {
    return !!this.apiKey;
  }

  /**
   * Genel mesajlaşma — system + user prompt
   */
  async chat(systemPrompt: string, userPrompt: string, opts?: {
    maxTokens?: number;
    temperature?: number;
  }): Promise<string> {
    if (!this.apiKey) {
      this.logger.warn('Anthropic API key yok, AI çağrısı atlandı');
      return '';
    }

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: opts?.maxTokens || 1024,
          temperature: opts?.temperature ?? 0.7,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        this.logger.error(`Anthropic API error: ${err}`);
        return '';
      }

      const data: any = await res.json();
      return data.content?.[0]?.text || '';
    } catch (err) {
      this.logger.error('AI chat exception', err);
      return '';
    }
  }

  /**
   * Menü ürün açıklaması üret
   */
  async generateProductDescription(productName: string, category: string, lang: string = 'tr'): Promise<string> {
    const langName = lang === 'en' ? 'İngilizce' : lang === 'de' ? 'Almanca' : lang === 'ru' ? 'Rusça' : 'Türkçe';
    return this.chat(
      `Sen bir restoran menü yazarısın. ${langName} dilinde, iştah açıcı, 1-2 cümlelik kısa ürün açıklamaları yazıyorsun. Sadece açıklama metnini döndür, ek yorum yapma.`,
      `Ürün: "${productName}" (kategori: ${category}). Açıklamayı yaz.`,
      { maxTokens: 200, temperature: 0.8 },
    );
  }

  /**
   * Sesli sipariş → yapılandırılmış JSON
   */
  async parseVoiceOrder(transcript: string, menuItems: Array<{ id: string; name: string; price: number }>): Promise<any> {
    const menuText = menuItems.map(m => `- ${m.name} (${m.id}, ₺${m.price})`).join('\n');
    const result = await this.chat(
      `Sen bir restoran sesli sipariş asistanısın. Müşterinin sözlü siparişini menü ile eşleştirip JSON olarak döndür. Format: { "items": [{ "id": "...", "qty": 1, "notes": "..." }], "total": 0 }. Sadece geçerli JSON döndür.`,
      `Menü:\n${menuText}\n\nMüşteri sözleri: "${transcript}"`,
      { maxTokens: 500, temperature: 0.2 },
    );
    try {
      return JSON.parse(result);
    } catch {
      return { items: [], total: 0, error: 'Sipariş anlaşılamadı' };
    }
  }

  /**
   * Müşteri yorumu duygu analizi
   */
  async analyzeReview(text: string): Promise<{ sentiment: 'positive' | 'neutral' | 'negative'; score: number; summary: string }> {
    const result = await this.chat(
      `Sen müşteri yorumu analiz uzmanısın. JSON döndür: { "sentiment": "positive|neutral|negative", "score": 0-10, "summary": "kısa özet" }`,
      `Yorum: "${text}"`,
      { maxTokens: 300, temperature: 0.3 },
    );
    try {
      return JSON.parse(result);
    } catch {
      return { sentiment: 'neutral', score: 5, summary: '' };
    }
  }

  /**
   * Kampanya başlığı + mesajı üret
   */
  async generateCampaign(occasion: string, audience: string, lang: string = 'tr'): Promise<{ title: string; message: string }> {
    const langName = lang === 'en' ? 'İngilizce' : lang === 'de' ? 'Almanca' : lang === 'ru' ? 'Rusça' : 'Türkçe';
    const result = await this.chat(
      `Sen bir restoran pazarlama uzmanısın. ${langName} dilinde, kısa ve etkili kampanya metinleri yazıyorsun. JSON döndür: { "title": "...", "message": "..." }`,
      `Vesile: ${occasion}, Hedef kitle: ${audience}. WhatsApp'a uygun kısa kampanya yaz.`,
      { maxTokens: 400, temperature: 0.9 },
    );
    try {
      return JSON.parse(result);
    } catch {
      return { title: occasion, message: '' };
    }
  }
}
