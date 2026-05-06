import { Module } from '@nestjs/common';
import { QrMenuController } from './qr-menu.controller';

@Module({
  controllers: [QrMenuController],
})
export class QrMenuModule {}
