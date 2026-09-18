import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({

    imports:[
        TypeOrmModule.forRoot({
            type:"postgres",
            host: process.env.DB_HOST ?? "localhost",
            port: Number(process.env.DB_PORT ?? 5433),
            username: process.env.DB_USER ?? "postgres",
            password: process.env.DB_PASSWORD ?? "root",
            database: process.env.DB_NAME ?? "idgrouperp",
            autoLoadEntities:true,
            synchronize:true
        })
    ]
})
export class DatabaseModule {}
