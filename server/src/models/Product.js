import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    offerType: { type: String, enum: ['product', 'service'], default: 'product' },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    variety: { type: String, trim: true },
    category: { type: String, trim: true, default: 'Crops' },
    pricePerKg: { type: Number, required: true, min: 0.01 },
    availableQty: { type: Number, required: true, default: 0, min: 0 },
    unit: { type: String, default: 'kg', trim: true },
    location: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    listingType: { type: String, enum: ['retail', 'bulk'], default: 'retail' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    // Listings are approved by default — trust is established once at the
    // account level (see User.approvalStatus), not re-checked per listing.
    // Admins flag a listing reactively by setting this to 'rejected', which
    // also hides it; clearing the flag (back to 'approved') restores it.
    moderationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
  },
  { timestamps: true }
);

export default mongoose.model('Product', productSchema);
