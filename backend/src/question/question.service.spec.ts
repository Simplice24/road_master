import { BadRequestException } from '@nestjs/common';
import { QuestionService } from './question.service';
import { QuestionImageStorage } from './question-image.storage';
import type { PrismaService } from '../prisma/prisma.service';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';

const OPTIONS = [
  { id: 'opt-a', text: 'Stop', imageUrl: null, isCorrect: true, position: 0 },
  { id: 'opt-b', text: 'Go', imageUrl: null, isCorrect: false, position: 1 },
  {
    id: 'opt-c',
    text: 'Slow down',
    imageUrl: null,
    isCorrect: false,
    position: 2,
  },
];
const QUESTION = {
  id: 'q-1',
  text: 'What does a red light mean?',
  imageUrl: null,
  allowMultiple: false,
  options: OPTIONS,
};

function setup() {
  const prisma = {
    question: {
      findFirst: jest.fn().mockResolvedValue(QUESTION),
      findUniqueOrThrow: jest.fn().mockResolvedValue(QUESTION),
      update: jest.fn().mockResolvedValue(QUESTION),
      delete: jest.fn().mockResolvedValue(QUESTION),
      count: jest.fn().mockResolvedValue(0),
    },
    option: {
      update: jest.fn((args: unknown) => args),
      count: jest.fn().mockResolvedValue(0),
    },
    category: { findUnique: jest.fn().mockResolvedValue({ id: 'cat' }) },
    examAttemptQuestion: { count: jest.fn().mockResolvedValue(0) },
    examAttemptAnswerOption: { count: jest.fn().mockResolvedValue(0) },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };
  const images = { deleteIfUnreferenced: jest.fn() };
  const service = new QuestionService(
    prisma as unknown as PrismaService,
    images as unknown as QuestionImageStorage,
  );
  const adminAbility = () =>
    new CaslAbilityFactory({
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'admin',
          isActive: true,
          userRoles: [{ role: { isSuperAdmin: true, rolePermissions: [] } }],
        }),
      },
    } as unknown as PrismaService).createForUser({ id: 'admin' });
  return { service, prisma, images, adminAbility };
}

describe('QuestionService option ordering', () => {
  it('reorders options atomically by the full list of ids', async () => {
    const { service, prisma, adminAbility } = setup();
    await service.reorderOptions(
      'q-1',
      ['opt-c', 'opt-a', 'opt-b'],
      await adminAbility(),
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.option.update.mock.calls.map(([args]) => args)).toEqual([
      { where: { id: 'opt-c' }, data: { position: 0 } },
      { where: { id: 'opt-a' }, data: { position: 1 } },
      { where: { id: 'opt-b' }, data: { position: 2 } },
    ]);
  });

  it('never touches isCorrect when reordering', async () => {
    const { service, prisma, adminAbility } = setup();
    await service.reorderOptions(
      'q-1',
      ['opt-b', 'opt-c', 'opt-a'],
      await adminAbility(),
    );
    for (const [args] of prisma.option.update.mock.calls) {
      expect(Object.keys((args as { data: object }).data)).toEqual([
        'position',
      ]);
    }
  });

  it('rejects a partial, duplicated or foreign id list', async () => {
    const { service, prisma, adminAbility } = setup();
    const ability = await adminAbility();
    await expect(
      service.reorderOptions('q-1', ['opt-a', 'opt-b'], ability),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.reorderOptions('q-1', ['opt-a', 'opt-b', 'opt-x'], ability),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('applies the submitted option order as positions when the question is saved', async () => {
    const { service, prisma, adminAbility } = setup();
    await service.updateQuestion(
      'q-1',
      {
        options: [
          { id: 'opt-b' },
          { text: 'Turn left', isCorrect: false },
          { id: 'opt-a' },
          { id: 'opt-c' },
        ],
      },
      await adminAbility(),
    );
    const write = prisma.question.update.mock.calls[0][0].data.options;
    expect(
      write.update.map(
        (u: { where: { id: string }; data: { position: number } }) => [
          u.where.id,
          u.data.position,
        ],
      ),
    ).toEqual([
      ['opt-b', 0],
      ['opt-a', 2],
      ['opt-c', 3],
    ]);
    expect(write.create).toEqual([
      { text: 'Turn left', imageUrl: null, isCorrect: false, position: 1 },
    ]);
    expect(write.deleteMany).toEqual({ id: { in: [] } });
  });
});

describe('QuestionService validation', () => {
  it('requires at least two options and exactly one correct one for single-answer questions', async () => {
    const { service, adminAbility } = setup();
    const ability = await adminAbility();
    await expect(
      service.updateQuestion('q-1', { options: [{ id: 'opt-a' }] }, ability),
    ).rejects.toThrow(/at least 2 options/);
    await expect(
      service.updateQuestion(
        'q-1',
        { options: [{ id: 'opt-a' }, { id: 'opt-b', isCorrect: true }] },
        ability,
      ),
    ).rejects.toThrow(/Only one option can be marked as correct/);
    await expect(
      service.updateQuestion(
        'q-1',
        { options: [{ id: 'opt-a', isCorrect: false }, { id: 'opt-b' }] },
        ability,
      ),
    ).rejects.toThrow(/At least one option/);
  });

  it('refuses to delete an option that past attempts selected', async () => {
    const { service, prisma, adminAbility } = setup();
    prisma.examAttemptAnswerOption.count.mockResolvedValue(1);
    await expect(
      service.updateQuestion(
        'q-1',
        { options: [{ id: 'opt-a' }, { id: 'opt-b' }] },
        await adminAbility(),
      ),
    ).rejects.toThrow(/chosen in past exam attempts/);
    expect(prisma.question.update).not.toHaveBeenCalled();
  });
});

describe('QuestionService.deleteQuestion', () => {
  it('soft-deletes a question that appeared in exam attempts', async () => {
    const { service, prisma, adminAbility } = setup();
    prisma.examAttemptQuestion.count.mockResolvedValue(3);
    await expect(
      service.deleteQuestion('q-1', await adminAbility()),
    ).resolves.toEqual({
      id: 'q-1',
      mode: 'soft',
    });
    expect(prisma.question.update).toHaveBeenCalledWith({
      where: { id: 'q-1' },
      data: { deletedAt: expect.any(Date), isActive: false },
    });
    expect(prisma.question.delete).not.toHaveBeenCalled();
  });

  it('hard-deletes a never-used question and cleans up its images', async () => {
    const { service, prisma, images, adminAbility } = setup();
    await expect(
      service.deleteQuestion('q-1', await adminAbility()),
    ).resolves.toEqual({
      id: 'q-1',
      mode: 'hard',
    });
    expect(prisma.question.delete).toHaveBeenCalledWith({
      where: { id: 'q-1' },
    });
    expect(images.deleteIfUnreferenced).toHaveBeenCalled();
  });
});

describe('QuestionImageStorage.save', () => {
  const storage = new QuestionImageStorage({} as unknown as PrismaService);
  const file = (bytes: number[], mimetype = 'image/png') => ({
    buffer: Buffer.from(bytes),
    mimetype,
    size: bytes.length,
  });

  it('rejects files whose bytes are not PNG/JPEG/WebP, whatever the declared type', async () => {
    await expect(
      storage.save(file([0x3c, 0x73, 0x76, 0x67], 'image/png')),
    ).rejects.toThrow(/Only PNG, JPEG or WebP/);
  });

  it('rejects oversized files and missing files', async () => {
    await expect(
      storage.save({
        buffer: Buffer.alloc(4),
        mimetype: 'image/png',
        size: 3 * 1024 * 1024,
      }),
    ).rejects.toThrow(/2 MB/);
    await expect(storage.save(undefined)).rejects.toThrow(/Attach an image/);
  });
});
