import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { QuestionService } from './question.service';
import {
  CheckPolicies,
  RequirePermission,
} from '../casl/decorators/check-policies.decorator';
import { CurrentAbility } from '../casl/decorators/current-ability.decorator';
import { AppAbility } from '../casl/casl-ability.factory';
import { CreateQuestionDto } from './dto/create-question';
import { UpdateQuestionDto } from './dto/update-question';
import { ListQuestionsQuery } from './dto/list-questions.query';
import { ReorderOptionsDto } from './dto/reorder-options.dto';
import {
  IMAGE_UPLOAD_LIMITS,
  QuestionImageStorage,
  type UploadedImage,
} from './question-image.storage';

@Controller('question')
export class QuestionController {
  constructor(
    private readonly questionService: QuestionService,
    private readonly images: QuestionImageStorage,
  ) {}

  @Get()
  @RequirePermission('read', 'Question')
  listQuestions(
    @Query() query: ListQuestionsQuery,
    @CurrentAbility() abilityParam: unknown,
  ) {
    return this.questionService.listQuestions(
      query,
      abilityParam as AppAbility,
    );
  }

  /**
   * Image upload for the question form (question or option images). Allowed for anyone who can
   * create *or* edit questions — the URL only takes effect once a create/update saves it.
   * Kept in memory (≤2 MB) so the file signature is checked before anything touches disk.
   */
  @Post('images')
  @CheckPolicies(
    (ability) =>
      ability.can('create', 'Question') || ability.can('update', 'Question'),
  )
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: IMAGE_UPLOAD_LIMITS.maxBytes, files: 1 },
    }),
  )
  uploadImage(@UploadedFile() file: UploadedImage | undefined) {
    return this.images.save(file);
  }

  @Get(':id')
  @RequirePermission('read', 'Question')
  getQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAbility() abilityParam: unknown,
  ) {
    return this.questionService.getQuestion(id, abilityParam as AppAbility);
  }

  @Post()
  @RequirePermission('create', 'Question')
  createQuestion(
    @Body() data: CreateQuestionDto,
    @CurrentAbility() abilityParam: unknown,
  ) {
    return this.questionService.createQuestion(
      data,
      abilityParam as AppAbility,
    );
  }

  @Put(':id')
  @RequirePermission('update', 'Question')
  updateQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateQuestionDto,
    @CurrentAbility() abilityParam: unknown,
  ) {
    return this.questionService.updateQuestion(
      id,
      data,
      abilityParam as AppAbility,
    );
  }

  /** Reorders options atomically — the body is the full ordered list of option ids. */
  @Put(':id/options/order')
  @RequirePermission('update', 'Question')
  reorderOptions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: ReorderOptionsDto,
    @CurrentAbility() abilityParam: unknown,
  ) {
    return this.questionService.reorderOptions(
      id,
      data.optionIds,
      abilityParam as AppAbility,
    );
  }

  @Delete(':id')
  @RequirePermission('delete', 'Question')
  deleteQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAbility() abilityParam: unknown,
  ) {
    return this.questionService.deleteQuestion(id, abilityParam as AppAbility);
  }
}
