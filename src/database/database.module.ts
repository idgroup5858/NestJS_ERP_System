import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { prepareSchema } from './prepare-schema';

@Module({

    imports:[
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (config: ConfigService) => {
                const connection = {
                    host: config.get<string>('DB_HOST', 'localhost'),
                    port: Number(config.get<string>('DB_PORT', '5432')),
                    username: config.get<string>('DB_USER', 'postgres'),
                    password: config.get<string>('DB_PASSWORD', 'root'),
                    database: config.get<string>('DB_NAME', 'idgrouperp'),
                };

                await prepareSchema({
                    host: connection.host,
                    port: connection.port,
                    user: connection.username,
                    password: connection.password,
                    database: connection.database,
                });

                return {
                    type: 'postgres' as const,
                    ...connection,
                    autoLoadEntities: true,
                    synchronize: true,
                };
            },
        }),
    ]
})
export class DatabaseModule {}
