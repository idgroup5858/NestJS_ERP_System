import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({

    imports:[
        TypeOrmModule.forRoot({
            type:"mysql",
            host:"109.196.103.18",
            port:3306,
            username:"root",
            password:"",
            database:"idgrouperp",
            autoLoadEntities:true,
            synchronize:true
        })
    ]
})
export class DatabaseModule {}
