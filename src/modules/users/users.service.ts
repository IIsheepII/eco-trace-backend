import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(organisationId: string) {
    return this.prisma.user.findMany({
      where: { organisationId, deletedAt: null },
      select: { id: true, email: true, fullName: true, isActive: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(organisationId: string, dto: CreateUserDto) {
    const role = await this.prisma.role.findFirst({ where: { id: dto.roleId, OR: [{ organisationId }, { organisationId: null }] } });
    if (!role) throw new BadRequestException('Invalid role');

    return this.prisma.user.create({
      data: {
        email: dto.email,
        fullName: dto.fullName,
        passwordHash: await argon2.hash(dto.password),
        organisationId,
        roleId: role.id,
      },
      select: { id: true, email: true, fullName: true, role: true, createdAt: true },
    });
  }

  async update(organisationId: string, id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findFirst({ where: { id, organisationId, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');
    if (dto.roleId) {
      const role = await this.prisma.role.findFirst({ where: { id: dto.roleId, OR: [{ organisationId }, { organisationId: null }] } });
      if (!role) throw new BadRequestException('Invalid role');
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        email: dto.email,
        fullName: dto.fullName,
        roleId: dto.roleId,
        passwordHash: dto.password ? await argon2.hash(dto.password) : undefined,
      },
      select: { id: true, email: true, fullName: true, role: true, updatedAt: true },
    });
  }
}
