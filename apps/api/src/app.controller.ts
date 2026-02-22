import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Alive check' })
  @ApiResponse({ status: 200, description: 'API is running' })
  getAlive(): { status: string } {
    return this.appService.getHealth();
  }
}
