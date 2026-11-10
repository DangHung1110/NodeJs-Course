import { Body, Controller, Get, INestApplication, Post } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IsNotEmpty, IsString } from 'class-validator';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';

class ProbeRequestDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

@Controller('foundation-probe')
class FoundationProbeController {
  @Get()
  getStatus(): { status: string } {
    return { status: 'ok' };
  }

  @Post()
  echo(@Body() requestBody: ProbeRequestDto): ProbeRequestDto {
    return requestBody;
  }
}

describe('Foundation (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [FoundationProbeController],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('applies the configured API prefix', async () => {
    await request(app.getHttpServer())
      .get('/api/foundation-probe')
      .expect(200)
      .expect({ status: 'ok' });

    await request(app.getHttpServer()).get('/foundation-probe').expect(404);
  });

  it('accepts a valid request body', async () => {
    await request(app.getHttpServer())
      .post('/api/foundation-probe')
      .send({ name: 'foundation' })
      .expect(201)
      .expect({ name: 'foundation' });
  });

  it('rejects missing required properties', async () => {
    await request(app.getHttpServer())
      .post('/api/foundation-probe')
      .send({})
      .expect(422);
  });

  it('rejects unknown properties', async () => {
    await request(app.getHttpServer())
      .post('/api/foundation-probe')
      .send({ name: 'foundation', unexpected: true })
      .expect(422);
  });
});
