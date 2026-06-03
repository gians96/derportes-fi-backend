import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { FacultiesService } from './faculties.service';
import {
  CreateFacultyDto,
  CreateSchoolDto,
  UpdateFacultyDto,
  UpdateSchoolDto,
} from './dto/faculty.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class FacultiesController {
  constructor(private readonly faculties: FacultiesService) {}

  @Get('faculties')
  findAll() {
    return this.faculties.findAll();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.OWNER_SYSTEM, Role.ADMIN_SYSTEM)
  @Post('faculties')
  createFaculty(@Body() dto: CreateFacultyDto) {
    return this.faculties.createFaculty(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.OWNER_SYSTEM, Role.ADMIN_SYSTEM)
  @Patch('faculties/:id')
  updateFaculty(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFacultyDto,
  ) {
    return this.faculties.updateFaculty(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.OWNER_SYSTEM, Role.ADMIN_SYSTEM)
  @Delete('faculties/:id')
  deleteFaculty(@Param('id', ParseIntPipe) id: number) {
    return this.faculties.deleteFaculty(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.OWNER_SYSTEM, Role.ADMIN_SYSTEM)
  @Post('schools')
  createSchool(@Body() dto: CreateSchoolDto) {
    return this.faculties.createSchool(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.OWNER_SYSTEM, Role.ADMIN_SYSTEM)
  @Patch('schools/:id')
  updateSchool(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSchoolDto,
  ) {
    return this.faculties.updateSchool(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.OWNER_SYSTEM, Role.ADMIN_SYSTEM)
  @Delete('schools/:id')
  deleteSchool(@Param('id', ParseIntPipe) id: number) {
    return this.faculties.deleteSchool(id);
  }
}
