import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({

    imports:[
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                type: 'postgres',
                host: config.get<string>('DB_HOST', 'localhost'),
                port: config.get<number>('DB_PORT', 5432),
                username: config.get<string>('DB_USER', 'postgres'),
                password: config.get<string>('DB_PASSWORD', 'root'),
                database: config.get<string>('DB_NAME', 'idgrouperp'),
                autoLoadEntities: true,
                synchronize: true,
            }),
        }),
    ]
})
export class DatabaseModule {}
