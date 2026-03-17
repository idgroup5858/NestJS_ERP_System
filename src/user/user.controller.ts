import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { LoginDto } from './dto/login-user.dto';
import { AuthGuard } from '@nestjs/passport'; 


@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post("add")
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get("all")
  findAll() {
    return this.userService.findAll();
  }
  
  @Get("allpag")
  findAllPag(
    @Query("page") page:string,
    @Query("limit") limit:string
  ) {
    return this.userService.findAllPag(+page,+limit);
  }

  
  @Get('getby/:id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(+id);
  }

  @Patch('update/:id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(+id, updateUserDto);
  }

  @Delete('delete/:id')
  remove(@Param('id') id: string) {
    return this.userService.remove(+id);
  }

  @Post("login")
  login(@Body() loginDto:LoginDto){
    return this.userService.login(loginDto)
  }

  
  @Post("verify")
  verifyToken(@Body("token") accessToken:string){
    return this.userService.verifyToken(accessToken)
  }

  @Post("refresh")
  refreshToken(@Body("refreshToken") refreshToken:string){
    return this.userService.refreshToken(refreshToken)
  }
}


