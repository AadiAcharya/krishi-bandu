import User from '../models/User.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Setting from '../models/Setting.js';
import ActivityLog from '../models/ActivityLog.js';
import { logActivity } from '../utils/logActivity.js';

export async function overview(_req, res) {
  const [totalUsers, totalSellers, totalBuyers, totalOrders, totalProducts] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'farmer' }),
    User.countDocuments({ role: 'buyer' }),
    Order.countDocuments(),
    Product.countDocuments(),
  ]);

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const recentOrders = await Order.find({ createdAt: { $gte: since } }).select('createdAt totalAmount');

  const byDay = {};
  for (const order of recentOrders) {
    const key = order.createdAt.toISOString().slice(0, 10);
    byDay[key] = (byDay[key] || 0) + 1;
  }
  const ordersLast30Days = Object.entries(byDay)
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([date, count]) => ({ date, count }));

  res.json({ totalUsers, totalSellers, totalBuyers, totalOrders, totalProducts, ordersLast30Days });
}

export async function listUsers(_req, res) {
  const users = await User.find().sort({ createdAt: -1 });
  res.json(users);
}

export async function updateUserStatus(req, res) {
  const { status } = req.body;
  const user = await User.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!user) return res.status(404).json({ message: 'User not found' });

  await logActivity({
    admin: req.user,
    action: status === 'active' ? 'user.activated' : 'user.suspended',
    target: user,
    targetType: 'User',
  });

  res.json(user);
}

export async function updateUserApproval(req, res) {
  const { approvalStatus, rejectionReason } = req.body;
  const validStatuses = ['pending', 'approved', 'rejected'];
  if (!validStatuses.includes(approvalStatus)) {
    return res.status(400).json({ message: 'Invalid approval status' });
  }

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (user.role === 'admin') {
    return res.status(403).json({ message: 'Administrator approval cannot be changed' });
  }

  user.approvalStatus = approvalStatus;
  if (approvalStatus === 'approved') {
    user.approvedAt = new Date();
    user.approvedBy = req.user._id;
    user.rejectionReason = null;
  } else if (approvalStatus === 'rejected') {
    user.approvedAt = null;
    user.approvedBy = null;
    user.rejectionReason = String(rejectionReason || '').trim() || 'Registration was rejected by the administrator.';
  } else {
    user.approvedAt = null;
    user.approvedBy = null;
    user.rejectionReason = null;
  }
  await user.save();

  if (approvalStatus === 'approved' || approvalStatus === 'rejected') {
    await logActivity({
      admin: req.user,
      action: approvalStatus === 'approved' ? 'user.approved' : 'user.rejected',
      target: user,
      targetType: 'User',
      details: approvalStatus === 'rejected' ? user.rejectionReason : '',
    });
  }

  res.json({
    message:
      approvalStatus === 'approved'
        ? 'User account approved'
        : approvalStatus === 'rejected'
          ? 'User registration rejected'
          : 'User returned to pending review',
    user: user.toJSON(),
  });
}

export async function deleteUser(req, res) {
  const target = await User.findById(req.params.id);
  if (!target) return res.status(404).json({ message: 'User not found' });
  if (target.role === 'admin') return res.status(403).json({ message: 'Cannot delete an admin account' });

  await logActivity({ admin: req.user, action: 'user.deleted', target, targetType: 'User' });
  await target.deleteOne();
  res.json({ message: 'User deleted' });
}

export async function listAdminProducts(_req, res) {
  const products = await Product.find().populate('seller', 'name').sort({ createdAt: -1 });
  res.json(products);
}

export async function updateProductStatus(req, res) {
  const { status } = req.body;
  const product = await Product.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!product) return res.status(404).json({ message: 'Product not found' });

  await logActivity({
    admin: req.user,
    action: status === 'active' ? 'listing.activated' : 'listing.deactivated',
    target: product,
    targetType: 'Product',
  });

  res.json(product);
}

export async function updateProductModeration(req, res) {
  const { moderationStatus } = req.body;
  const validStatuses = ['pending', 'approved', 'rejected'];
  if (!validStatuses.includes(moderationStatus)) {
    return res.status(400).json({ message: 'Invalid moderation status' });
  }

  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });

  const wasFlagged = product.moderationStatus === 'rejected';
  product.moderationStatus = moderationStatus;
  // A flagged listing shouldn't stay visible; clearing the flag restores it
  // in one click rather than requiring a separate "unhide" step.
  if (moderationStatus === 'rejected') {
    product.status = 'inactive';
  } else if (moderationStatus === 'approved' && wasFlagged) {
    product.status = 'active';
  }
  await product.save();

  if (moderationStatus === 'approved' || moderationStatus === 'rejected') {
    await logActivity({
      admin: req.user,
      action: moderationStatus === 'approved' ? 'listing.approved' : 'listing.rejected',
      target: product,
      targetType: 'Product',
    });
  }

  res.json(product);
}

export async function deleteProductAdmin(req, res) {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });

  await logActivity({ admin: req.user, action: 'listing.deleted', target: product, targetType: 'Product' });

  res.json({ message: 'Product deleted' });
}

export async function updateOrderStatusAdmin(req, res) {
  const { status } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });

  if (status && status !== order.status) {
    order.status = status;
    order.statusHistory.push({ status, changedAt: new Date(), note: 'Updated by admin' });
    await order.save();
  }
  res.json(order);
}

export async function deleteOrderAdmin(req, res) {
  const order = await Order.findByIdAndDelete(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  res.json({ message: 'Order deleted' });
}

export async function listActivityLog(_req, res) {
  const entries = await ActivityLog.find().sort({ createdAt: -1 }).limit(200);
  res.json(entries);
}

export async function getSettings(_req, res) {
  const settings = await Setting.getSingleton();
  res.json(settings);
}

export async function updateSettings(req, res) {
  const { siteName, supportPhone, supportEmail, maintenanceMode } = req.body;
  const settings = await Setting.getSingleton();
  if (siteName !== undefined) settings.siteName = siteName;
  if (supportPhone !== undefined) settings.supportPhone = supportPhone;
  if (supportEmail !== undefined) settings.supportEmail = supportEmail;
  if (maintenanceMode !== undefined) settings.maintenanceMode = maintenanceMode;
  await settings.save();
  res.json(settings);
}
