import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AiService } from './ai.service';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private ai: AiService) {}

  @Post('describe-product')
  @ApiOperation({ summary: 'AI ile ürün açıklaması üret' })
  async describeProduct(@Body() body: { name: string; category: string; lang?: string }) {
    if (!this.ai.isEnabled()) {
      return { enabled: false, description: '', message: 'AI yapılandırılmamış (ANTHROPIC_API_KEY)' };
    }
    const description = await this.ai.generateProductDescription(body.name, body.category, body.lang || 'tr');
    return { enabled: true, description };
  }

  @Post('campaign')
  @ApiOperation({ summary: 'AI ile kampanya metni üret' })
  async campaign(@Body() body: { occasion: string; audience: string; lang?: string }) {
    if (!this.ai.isEnabled()) {
      return { enabled: false, title: '', message: '' };
    }
    return { enabled: true, ...await this.ai.generateCampaign(body.occasion, body.audience, body.lang) };
  }

  @Post('parse-voice-order')
  @ApiOperation({ summary: 'Sesli siparişi yapılandırılmış JSON\'a çevir' })
  async parseVoice(@Body() body: { transcript: string; menuItems: any[] }) {
    if (!this.ai.isEnabled()) {
      return { enabled: false, items: [], total: 0 };
    }
    return { enabled: true, ...await this.ai.parseVoiceOrder(body.transcript, body.menuItems) };
  }

  @Post('analyze-review')
  @ApiOperation({ summary: 'Müşteri yorumu duygu analizi' })
  async analyzeReview(@Body() body: { text: string }) {
    if (!this.ai.isEnabled()) {
      return { enabled: false, sentiment: 'neutral', score: 5 };
    }
    return { enabled: true, ...await this.ai.analyzeReview(body.text) };
  }
}
