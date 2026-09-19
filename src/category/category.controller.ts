import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category';
import { UpdateCategoryDto } from './dto/update-category';
import { CategoryService } from './category.service';
import { RequirePermission } from '../casl/decorators/check-policies.decorator';
import { CurrentAbility } from '../casl/decorators/current-ability.decorator';
import { AppAbility } from '../casl/casl-ability.factory';

@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @RequirePermission('read', 'Category')
  listCategories(@CurrentAbility() abilityParam: unknown) {
    return this.categoryService.listCategories(abilityParam as AppAbility);
  }

  @Post()
  @RequirePermission('create', 'Category')
  createCategory(
    @Body() data: CreateCategoryDto,
    @CurrentAbility() abilityParam: unknown,
  ) {
    return this.categoryService.createCategory(
      data,
      abilityParam as AppAbility,
    );
  }

  @Put(':id')
  @RequirePermission('update', 'Category')
  updateCategory(
    @Param('id') id: string,
    @Body() data: UpdateCategoryDto,
    @CurrentAbility() abilityParam: unknown,
  ) {
    return this.categoryService.updateCategory(
      id,
      data,
      abilityParam as AppAbility,
    );
  }

  @Delete(':id')
  @RequirePermission('delete', 'Category')
  deleteCategory(
    @Param('id') id: string,
    @CurrentAbility() abilityParam: unknown,
  ) {
    return this.categoryService.deleteCategory(id, abilityParam as AppAbility);
  }
}
