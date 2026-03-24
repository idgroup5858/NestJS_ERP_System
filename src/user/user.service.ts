import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';

import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login-user.dto';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class UserService {

  constructor(
    @InjectRepository(User)
    private readonly userRepository:Repository<User>,
    private readonly jwtService:JwtService,
  ) {}

  async create(createUserDto: CreateUserDto) {
     const checkUser = await this.userRepository.findOne({
      
       where:{email:createUserDto.email},
    
    });
    if(checkUser) throw new ConflictException("Сотрудник уже ест !");
    const hashedPassword = await bcrypt.hash(createUserDto.password,10);
    const user = this.userRepository.create({
      ...createUserDto,
      password:hashedPassword
    });

    const isPasswordValid = await bcrypt.compare( createUserDto.password,hashedPassword,);
    console.log(isPasswordValid);
    
    await this.userRepository.save(user);
    return user;
  }

  async findAll() {

    return this.userRepository.find({
      //relations:["sale","purchase","returns"]
    });
  }

  async findAllPag(page:number,limit:number) {

    page = page > 0 ? page : 1;
    limit = limit > 0 ? limit : 10;

    const skip = (page - 1) * limit;

    const [data, total] = await this.userRepository.findAndCount({
      skip,
      take: limit,
      order: { id: 'DESC' }, // ixtiyoriy
     // relations:["sale","purchase","returns"]
    });

    return {
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      data
    };

    
  }

  async findOne(authorization:string) {
    const token = authorization?.split(' ')[1];
    const tokenVerify=this.jwtService.verify<JwtPayload>(token);
    const access_id:number= tokenVerify.id
    
    console.log(tokenVerify);
    
    const checkUser = await this.userRepository.findOne({
      
       where:{id:access_id},
       relations:["sale","purchase","returns"]
    
    });
    if(!checkUser) throw new NotFoundException("Не найден сотрудник с таким адресом электронной почты и паролем.");

    return checkUser;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const checkUser = await this.userRepository.findOneBy({id});
    if(!checkUser) throw new NotFoundException("Не найден сотрудник с таким адресом электронной почты и паролем.");

    let hashedPassword = checkUser.password;
    if(updateUserDto.password){
      hashedPassword = await bcrypt.hash(updateUserDto.password,10);
    }

    const user = await this.userRepository.preload({
      id,
      ...updateUserDto,
      password:hashedPassword
    });

    if(!user) throw new NotFoundException()
    
    await this.userRepository.save(user) 

    return user;
  }

  async remove(id: number) {
    const checkUser = await this.userRepository.findOneBy({id});
    if(!checkUser) throw new NotFoundException("Не найден сотрудник с таким адресом электронной почты и паролем.");
    await this.userRepository.remove(checkUser)
    return {message:"Сотрудник удален"};
  }



  //AUTH

  async login(loginDto:LoginDto){

  const user = await this.userRepository.findOneBy({
    email: loginDto.email,
  });

  if (!user) throw new NotFoundException("Сотрудник не найден");
  

  const isMatch = await bcrypt.compare (loginDto.password, user.password);

  if (!isMatch) throw new NotFoundException("Неверный пароль");

   const accessTokenPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      tokenType: 'access',
    };
    const accessToken = this.jwtService.sign(accessTokenPayload, {
      expiresIn: '15d',
    });

    //Generate refresh token
    const refreshTokenPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      tokenType: 'refresh',
    };
    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      expiresIn: '30d',
    });



    return {
      accessToken,
      exspiresIn_accessToken:"15d",
      refreshToken,
      exspiresIn_refreshToken:"30d",
    };
  

 
   
  }

verifyToken(token: string) {
    try {
      const tokenVerify=this.jwtService.verify<JwtPayload>(token);
      const expDate=new Date(Number(tokenVerify.exp)*1000); //milli second

      const remainingTime=(expDate.getTime()-new Date().getTime()); //ms
      const hours = Math.floor(remainingTime / (1000 * 60 * 60));
      const minutes = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remainingTime % (1000 * 60)) / 1000);

      //expDate millisecondga o`tkazilib keyin tekshirildi
      if(expDate<new Date()){
        return {message:"Token expired",date:new Date().toLocaleString()};
      }
      return {
        expDate:expDate.toLocaleString("uz-UZ"),
        dateNow:new Date().toLocaleString("uz-UZ"),
        remainingTime:`${hours}:${minutes}:${seconds}`,
         id: tokenVerify.id,
          username: tokenVerify.username,
          email: tokenVerify.email,
        tokenType:tokenVerify.tokenType
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async refreshToken(token: string){
   
    try {
    //const refreshTokenVerify = this.jwtService.verify<JwtPayload>(token);
    const refreshTokenVerify =await this.jwtService.verifyAsync<JwtPayload>(token);
    if(new Date(Number(Number(refreshTokenVerify.exp)*1000))<new Date()){
      console.log(true); 
    }

    const accessTokenPayload = {
      id: refreshTokenVerify.id,
      username: refreshTokenVerify.username,
      email: refreshTokenVerify.email,
      tokenType: 'access',
    };
    const accessToken = this.jwtService.sign(accessTokenPayload, {
      expiresIn: '15d',
    });


    const refreshTokenPayload = {
      id: refreshTokenVerify.id,
      username: refreshTokenVerify.username,
      email: refreshTokenVerify.email,
      tokenType: 'refresh',
    };
    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      expiresIn: '30d',
    });



    
      return {accessToken,refreshToken}
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }



 
}

export interface JwtPayload {
  id: number;
  username: string;
  email: string;
  tokenType: string;

  // iat, exp optional
  iat?: number;
  exp?: number;
}

 