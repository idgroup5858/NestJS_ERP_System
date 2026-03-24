import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({

    imports:[
        TypeOrmModule.forRoot({
            type:"mysql",
            host:"localhost",
            port:8889,
            username:"root",
            password:"root",
            database:"idgrouperp",
            autoLoadEntities:true,
            synchronize:true
        })
    ]
})
export class DatabaseModule {}
