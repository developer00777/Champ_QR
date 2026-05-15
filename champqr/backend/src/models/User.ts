import mongoose, { Document, Schema } from 'mongoose'

export interface IUser extends Document {
  email: string
  passwordHash: string
  name: string
  plan: 'free' | 'pro' | 'business'
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name:         { type: String, required: true, trim: true },
    plan:         { type: String, enum: ['free', 'pro', 'business'], default: 'free' },
  },
  { timestamps: true }
)

UserSchema.index({ email: 1 })

export default mongoose.model<IUser>('User', UserSchema)
