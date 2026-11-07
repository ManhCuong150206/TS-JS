import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, publicUser, type UserDocument } from '../login/user.schema.js';
import { AuditService } from '../login/audit.service.js';
import { Dataset } from '../datasets/schemas/dataset.schema.js';
import { Experiment } from '../experiments/schemas/experiment.schema.js';
import { TrainingRun } from '../training-runs/schemas/training-run.schema.js';
import type { RequestUser } from '../common/auth.guard.js';
import type {
  AdminUpdateUserDto,
  ChangePasswordDto,
  ListUsersDto,
} from './users.dto.js';

@Injectable()
export class UsersService {
  private mutationQueue: Promise<void> = Promise.resolve();
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Dataset.name) private readonly datasets: Model<Dataset>,
    @InjectModel(Experiment.name)
    private readonly experiments: Model<Experiment>,
    @InjectModel(TrainingRun.name) private readonly runs: Model<TrainingRun>,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Không tìm thấy user');
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException('Không tìm thấy user');
    return user;
  }
  async list(query: ListUsersDto) {
    const { page, limit, search } = query;
    // Escape regex để search được coi là văn bản, không phải biểu thức do client chạy.
    const escaped = search?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = escaped
      ? {
          $or: [
            { email: { $regex: escaped, $options: 'i' } },
            { displayName: { $regex: escaped, $options: 'i' } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      this.users
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.users.countDocuments(filter),
    ]);
    return {
      items: items.map(publicUser),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
  async updateProfile(user: RequestUser, displayName: string) {
    const updated = await this.users.findOneAndUpdate(
      {
        _id: user.userId,
        status: 'active',
        sessionVersion: user.account.sessionVersion,
      },
      { $set: { displayName } },
      { returnDocument: 'after', runValidators: true },
    );
    if (!updated) throw new UnauthorizedException('Vui lòng đăng nhập');
    return publicUser(updated);
  }
  async verifyPassword(user: RequestUser, password: string) {
    const account = await this.users
      .findOne({
        _id: user.userId,
        status: 'active',
        sessionVersion: user.account.sessionVersion,
      })
      .select('+passwordHash');
    if (!account || !(await bcrypt.compare(password, account.passwordHash)))
      throw new UnauthorizedException('Mật khẩu không đúng');
    return account;
  }
  async changePassword(user: RequestUser, dto: ChangePasswordDto, ip: string) {
    const account = await this.verifyPassword(user, dto.currentPassword);
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    const updated = await this.users.findOneAndUpdate(
      {
        _id: account._id,
        sessionVersion: account.sessionVersion,
        status: 'active',
      },
      { $set: { passwordHash }, $inc: { sessionVersion: 1 } },
      { returnDocument: 'after' },
    );
    if (!updated) throw new UnauthorizedException('Vui lòng đăng nhập lại');
    await this.audit.record('password.change', user.userId, user.userId, ip);
    return updated;
  }

  // Mongo standalone không có transaction. Xếp hàng các thao tác admin trong một
  // tiến trình để hai admin không đồng thời tự hạ quyền rồi bỏ hệ thống không có admin.
  private async serializeMutation<T>(action: () => Promise<T>): Promise<T> {
    const previous = this.mutationQueue;
    let release!: () => void;
    this.mutationQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await action();
    } finally {
      release();
    }
  }
  private async protectLastAdmin(user: UserDocument, removingAdmin: boolean) {
    if (
      removingAdmin &&
      user.role === 'admin' &&
      user.status === 'active' &&
      (await this.users.countDocuments({ role: 'admin', status: 'active' })) <=
        1
    ) {
      throw new BadRequestException(
        'Không thể xóa, khóa hoặc hạ quyền admin cuối cùng',
      );
    }
  }
  async adminUpdate(
    id: string,
    dto: AdminUpdateUserDto,
    actor: RequestUser,
    ip: string,
  ) {
    return this.serializeMutation(async () => {
      const user = await this.findOne(id);
      await this.protectLastAdmin(
        user,
        dto.role === 'user' || dto.status === 'disabled',
      );
      const roleChanged = dto.role !== undefined && dto.role !== user.role;
      const statusChanged =
        dto.status !== undefined && dto.status !== user.status;
      const changes: Record<string, string> = {};
      if (dto.displayName !== undefined) changes.displayName = dto.displayName;
      if (dto.role !== undefined) changes.role = dto.role;
      if (dto.status !== undefined) changes.status = dto.status;
      const updated = await this.users.findByIdAndUpdate(
        user._id,
        {
          $set: changes,
          ...(roleChanged || statusChanged
            ? { $inc: { sessionVersion: 1 } }
            : {}),
        },
        { returnDocument: 'after', runValidators: true },
      );
      if (!updated) throw new NotFoundException('Không tìm thấy user');
      if (roleChanged)
        await this.audit.record('user.role.change', actor.userId, id, ip);
      if (statusChanged)
        await this.audit.record('user.status.change', actor.userId, id, ip);
      return publicUser(updated);
    });
  }
  async deleteAccount(id: string, actor: RequestUser, ip: string) {
    return this.serializeMutation(async () => {
      const user = await this.findOne(id);
      await this.protectLastAdmin(user, true);
      const targetId = user._id.toString();
      // Nếu DB lỗi giữa chừng, tài khoản đã bị khóa; admin có thể gọi xóa lại.
      await this.users.updateOne(
        { _id: user._id },
        { $set: { status: 'disabled' }, $inc: { sessionVersion: 1 } },
      );
      const filter = { ownerId: targetId, deletedAt: { $exists: false } };
      const update = {
        $set: { deletedAt: new Date() },
        $inc: { syncVersion: 1 },
      };
      await Promise.all([
        this.datasets.updateMany(filter, update),
        this.experiments.updateMany(filter, update),
        this.runs.updateMany(filter, update),
      ]);
      await this.users.deleteOne({ _id: user._id });
      await this.audit.record('account.delete', actor.userId, targetId, ip);
      return { success: true };
    });
  }
}
