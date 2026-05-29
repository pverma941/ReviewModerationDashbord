// creating schema and model for review data
import mongoose, { Schema, Document } from 'mongoose'
import { z } from 'zod'

export const reviewDataValidationSchema = z.object({
  productId: z.string().min(1),
  author: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  text: z.string().min(1)
})

export type ReviewDataInput = z.infer<typeof reviewDataValidationSchema>

interface IReviewData extends Document {
  productId: string
  author: string
  rating: number
  text: string
  status: 'pending' | 'approved' | 'rejected'
  riskScore?: number
  flag: string[]
  moderatorReason?: string
  createdAt: Date
}

const reviewDataSchema: Schema<IReviewData> = new Schema({
  productId: { type: String, required: true },
  author: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  text: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  riskScore: { type: Number, min: 0, max: 100 },
  flag: { type: [String], default: [] },
  moderatorReason: { type: String }
})

export default mongoose.model<IReviewData>('ReviewData', reviewDataSchema)