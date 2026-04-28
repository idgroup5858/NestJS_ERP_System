import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { TelegramModule } from 'src/telegram/telegram.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]),TelegramModule,
  JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
      }),
    })  
],
  controllers: [UserController],
  providers: [UserService,JwtStrategy],
})
export class UserModule {}
