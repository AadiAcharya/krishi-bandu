import { Router } from 'express';
import {
  overview,
  listUsers,
  updateUserStatus,
  updateUserApproval,
  deleteUser,
  listAdminProducts,
  updateProductStatus,
  updateProductModeration,
  deleteProductAdmin,
  updateOrderStatusAdmin,
  deleteOrderAdmin,
  getSettings,
  updateSettings,
  listActivityLog,
} from '../controllers/admin.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));
router.get('/overview', overview);
router.get('/users', listUsers);
router.patch('/users/:id/status', updateUserStatus);
router.patch('/users/:id/approval', updateUserApproval);
router.delete('/users/:id', deleteUser);
router.get('/products', listAdminProducts);
router.patch('/products/:id/status', updateProductStatus);
router.patch('/products/:id/moderation', updateProductModeration);
router.delete('/products/:id', deleteProductAdmin);
router.patch('/orders/:id/status', updateOrderStatusAdmin);
router.delete('/orders/:id', deleteOrderAdmin);
router.get('/settings', getSettings);
router.put('/settings', updateSettings);
router.get('/activity-log', listActivityLog);

export default router;
