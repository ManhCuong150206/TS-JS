import mongoose from 'mongoose';

const { Schema, model } = mongoose;

export type LessonCategory = 'foundations' | 'regression' | 'data-preparation' | 'model-evaluation';
export type LessonLevel = 'beginner' | 'intermediate' | 'advanced';
export type AlgorithmType = 'linear' | 'polynomial' | 'ridge' | 'lasso' | 'neural-network';

export interface LessonRecord {
  slug: string;
  title: string;
  summary: string;
  category: LessonCategory;
  level: LessonLevel;
  estimatedMinutes?: number;
  algorithmType?: AlgorithmType;
  thumbnailKey?: string;
  content?: { explanation?: string; steps?: Array<{ title?: string; body?: string }>; visualizationPreset?: string };
  tags?: string[];
  sortOrder?: number;
  isPublished?: boolean;
}

const lessonStepSchema = new Schema({
  title: { type: String, trim: true },
  body: { type: String, trim: true }
}, { _id: false });

const lessonContentSchema = new Schema({
  explanation: { type: String, default: '' },
  steps: { type: [lessonStepSchema], default: [] },
  visualizationPreset: { type: String, trim: true }
}, { _id: false });

const lessonSchema = new Schema<LessonRecord>({
  slug: { type: String, required: true, trim: true, unique: true, lowercase: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  summary: { type: String, required: true, trim: true, maxlength: 400 },
  category: { type: String, required: true, enum: ['foundations', 'regression', 'data-preparation', 'model-evaluation'] },
  level: { type: String, required: true, enum: ['beginner', 'intermediate', 'advanced'] },
  estimatedMinutes: { type: Number, min: 1, default: 5 },
  algorithmType: { type: String, enum: ['linear', 'polynomial', 'ridge', 'lasso', 'neural-network'] },
  thumbnailKey: { type: String, trim: true },
  content: { type: lessonContentSchema, default: () => ({}) },
  tags: { type: [String], default: [] },
  sortOrder: { type: Number, default: 0 },
  isPublished: { type: Boolean, default: false }
}, { timestamps: true, collection: 'lessons' });

lessonSchema.index({ isPublished: 1, category: 1, level: 1, sortOrder: 1 });
lessonSchema.index({ title: 'text', summary: 'text', tags: 'text' });

export const Lesson = model<LessonRecord>('Lesson', lessonSchema);
