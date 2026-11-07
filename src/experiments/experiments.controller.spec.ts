import { RequestUser } from '../common/auth.guard.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ExperimentsController } from './experiments.controller.js';
import { ExperimentsService } from './experiments.service.js';
import { CreateExperimentDto } from './dto/create-experiment.dto.js';
import { NotFoundException } from '@nestjs/common';

describe('ExperimentsController', () => {
  let controller: ExperimentsController;
  let service: ExperimentsService;

  const mockExperiment: CreateExperimentDto = {
    clientId: 'exp-1',
    name: 'Linear #1',
    datasetId: '652f1234567890abcdef1234',
    algorithm: {
      type: 'linear',
      version: '1.0.0',
      config: { solver: 'gradient-descent' },
    },
    targetColumn: 'y',
    featureColumns: ['x1', 'x2'],
  };

  const user = { userId: 'test-user', role: 'user' } as RequestUser;

  const mockService = {
    create: vi.fn(),
    bulkUpsert: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExperimentsController],
      providers: [
        {
          provide: ExperimentsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<ExperimentsController>(ExperimentsController);
    service = module.get<ExperimentsService>(ExperimentsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create with dto and userId', async () => {
      mockService.create.mockResolvedValue(mockExperiment);
      const result = await controller.create(mockExperiment, user);
      expect(mockService.create).toHaveBeenCalledWith(mockExperiment, user);
      expect(result).toEqual(mockExperiment);
    });
  });

  describe('bulkUpsert', () => {
    it('should call service.bulkUpsert and return result', async () => {
      mockService.bulkUpsert.mockResolvedValue({ success: true, count: 1 });
      const result = await controller.bulkUpsert(
        [mockExperiment as unknown as Record<string, unknown>],
        user,
      );
      expect(mockService.bulkUpsert).toHaveBeenCalledWith(
        [mockExperiment],
        user,
      );
      expect(result).toEqual({ success: true, count: 1 });
    });
  });

  describe('findAll', () => {
    it('should return paginated list of experiments', async () => {
      const mockResult = {
        items: [mockExperiment],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      mockService.findAll.mockResolvedValue(mockResult);
      const result = await controller.findAll(user);
      expect(mockService.findAll).toHaveBeenCalledWith(user, 1, 20);
      expect(result).toEqual(mockResult);
    });
  });

  describe('findOne', () => {
    it('should return single experiment if found', async () => {
      mockService.findOne.mockResolvedValue(mockExperiment);
      const result = await controller.findOne('exp-1', user);
      expect(mockService.findOne).toHaveBeenCalledWith('exp-1', user);
      expect(result).toEqual(mockExperiment);
    });

    it('should throw NotFoundException if experiment not found', async () => {
      mockService.findOne.mockRejectedValue(
        new NotFoundException('Không tìm thấy thí nghiệm'),
      );
      await expect(controller.findOne('non-existent', user)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete experiment if found', async () => {
      mockService.remove.mockResolvedValue({
        success: true,
        message: 'Đã xóa',
      });
      const result = await controller.remove('exp-1', user);
      expect(mockService.remove).toHaveBeenCalledWith('exp-1', user);
      expect(result).toEqual({ success: true, message: 'Đã xóa' });
    });

    it('should throw NotFoundException if not found on delete', async () => {
      mockService.remove.mockRejectedValue(
        new NotFoundException('Không tìm thấy thí nghiệm'),
      );
      await expect(controller.remove('non-existent', user)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
