import { Document, Schema, model } from 'mongoose';

export type BlogPostStatus = 'draft' | 'published';

export interface BlogPostDocument extends Document {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  content: string[];
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  focusKeyword?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  status: BlogPostStatus;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const blogPostSchema = new Schema<BlogPostDocument>(
  {
    slug: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: String,
      required: true,
      trim: true,
    },
    excerpt: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: [String],
      default: [],
    },
    seoTitle: {
      type: String,
      trim: true,
    },
    seoDescription: {
      type: String,
      trim: true,
    },
    seoKeywords: {
      type: String,
      trim: true,
    },
    focusKeyword: {
      type: String,
      trim: true,
    },
    canonicalUrl: {
      type: String,
      trim: true,
    },
    ogTitle: {
      type: String,
      trim: true,
    },
    ogDescription: {
      type: String,
      trim: true,
    },
    ogImage: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'published',
      index: true,
    },
    publishedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

blogPostSchema.index({ status: 1, publishedAt: -1, updatedAt: -1 });
blogPostSchema.index({ title: 'text', excerpt: 'text', content: 'text', seoKeywords: 'text', focusKeyword: 'text' });

export const BlogPostModel = model<BlogPostDocument>('BlogPost', blogPostSchema);
