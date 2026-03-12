import { All, Controller, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

@Controller('novu')
export class NovuProxyController {
  private readonly notificationServiceUrl: string;

  constructor(config: ConfigService) {
    this.notificationServiceUrl = config.get<string>(
      'NOTIFICATION_SERVICE_URL',
      'http://localhost:3002',
    );
  }

  @All()
  proxyRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxy(req, res);
  }

  @All('*path')
  proxySubpath(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.proxy(req, res);
  }

  private async proxy(@Req() req: Request, @Res() res: Response): Promise<void> {
    const targetUrl = `${this.notificationServiceUrl}${req.originalUrl}`;

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') {
        headers[key] = value;
      }
    }
    delete headers['host'];

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
    });

    res.status(response.status);
    for (const [key, value] of response.headers.entries()) {
      res.setHeader(key, value);
    }
    const body = await response.text();
    res.send(body);
  }
}
