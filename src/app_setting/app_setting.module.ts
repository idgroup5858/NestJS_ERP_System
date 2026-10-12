import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/user/entities/user.entity';
import { AppSettingController } from './app_setting.controller';
import { AppSettingService } from './app_setting.service';
import { AppSetting } from './entities/app_setting.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AppSetting, User])],
  controllers: [AppSettingController],
  providers: [AppSettingService],
})
export class AppSettingModule {}
