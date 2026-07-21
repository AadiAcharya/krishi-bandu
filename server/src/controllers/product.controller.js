import Product from '../models/Product.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

const EDITABLE_FIELDS = [
  'offerType',
  'name',
  'description',
  'variety',
  'category',
  'pricePerKg',
  'availableQty',
  'unit',
  'location',
  'imageUrl',
  'listingType',
];

const PRODUCT_CATEGORIES = ['Crops', 'Seeds', 'Organic', 'Tools'];
const SERVICE_CATEGORIES = ['Tractor Service', 'Labor', 'Irrigation', 'Veterinary', 'Consultation', 'Other'];

function pickEditableFields(body) {
  const data = {};
  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  return data;
}

function validateListingInput(data, { partial = false } = {}) {
  if (data.offerType !== undefined && !['product', 'service'].includes(data.offerType)) {
    throw new AppError('Offer type must be either "product" or "service"', 400);
  }

  if (!partial || data.name !== undefined) {
    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      throw new AppError('Title is required', 400);
    }
  }
  if (!partial || data.description !== undefined) {
    if (!data.description || typeof data.description !== 'string' || !data.description.trim()) {
      throw new AppError('Description is required', 400);
    }
  }
  if (!partial || data.category !== undefined) {
    const allowedCategories = data.offerType === 'service' ? SERVICE_CATEGORIES : PRODUCT_CATEGORIES;
    if (!data.category || !allowedCategories.includes(data.category)) {
      throw new AppError(`Category must be one of: ${allowedCategories.join(', ')}`, 400);
    }
  }
  if (!partial || data.pricePerKg !== undefined) {
    const price = Number(data.pricePerKg);
    if (data.pricePerKg === undefined || Number.isNaN(price) || price <= 0) {
      throw new AppError('Price must be a positive number', 400);
    }
    data.pricePerKg = price;
  }
  if (!partial || data.availableQty !== undefined) {
    const qty = Number(data.availableQty);
    if (data.availableQty === undefined || Number.isNaN(qty) || qty < 0) {
      throw new AppError('Available quantity must be zero or a positive number', 400);
    }
    data.availableQty = qty;
  }
}

export const listProducts = asyncHandler(async (req, res) => {
  const { category, search, offerType } = req.query;
  const filter = { status: 'active', availableQty: { $gt: 0 } };
  if (offerType && offerType !== 'All') filter.offerType = offerType;
  if (category && category !== 'All') filter.category = category;
  if (search) filter.name = { $regex: search, $options: 'i' };

  const products = await Product.find(filter).populate('seller', 'name location').sort({ createdAt: -1 });
  res.json(products);
});

export const myProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({ seller: req.user._id }).sort({ createdAt: -1 });
  res.json(products);
});

export const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('seller', 'name location phone');
  if (!product) throw new AppError('Product not found', 404);
  res.json(product);
});

export const createProduct = asyncHandler(async (req, res) => {
  const data = pickEditableFields(req.body);
  validateListingInput(data);

  // Listings go live immediately (moderationStatus defaults to 'approved' at
  // the schema level) — sellers are already vetted at the account level, so
  // re-reviewing every individual post would just be busywork. Admins flag
  // (reject) listings reactively instead of pre-approving each one.
  // moderationStatus itself is never seller-editable (excluded from EDITABLE_FIELDS).
  const product = await Product.create({ ...data, seller: req.user._id });
  res.status(201).json(product);
});

export const updateProduct = asyncHandler(async (req, res) => {
  const data = pickEditableFields(req.body);
  validateListingInput(data, { partial: true });

  const product = await Product.findOneAndUpdate({ _id: req.params.id, seller: req.user._id }, data, {
    new: true,
    runValidators: true,
  });
  if (!product) throw new AppError('Product not found', 404);
  res.json(product);
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOneAndDelete({ _id: req.params.id, seller: req.user._id });
  if (!product) throw new AppError('Product not found', 404);
  res.json({ message: 'Product deleted' });
});
