import mongoose from 'mongoose';

const cropRecordSchema = new mongoose.Schema(
  {
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    crop: { type: String, required: true },
    variety: { type: String },
    areaRopani: { type: Number, required: true },
    productionKg: { type: Number, required: true },
    avgPrice: { type: Number, required: true },
    expense: { type: Number, default: 0, min: 0 },
    trend: { type: String, enum: ['up', 'down', 'flat'], default: 'flat' },
    season: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model('CropRecord', cropRecordSchema);
