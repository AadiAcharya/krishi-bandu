import { useEffect, useState } from 'react';
import { Trash2, Sprout, Wrench, Flag, Check } from 'lucide-react';
import api from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function Products() {
  const { notify } = useToast();
  const [products, setProducts] = useState([]);
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);

  function load() {
    api.get('/admin/products').then((res) => setProducts(res.data));
  }

  useEffect(load, []);

  async function toggleStatus(product) {
    const status = product.status === 'active' ? 'inactive' : 'active';
    try {
      await api.patch(`/admin/products/${product._id}/status`, { status });
      notify(`"${product.name}" ${status === 'active' ? 'activated' : 'hidden'}.`, 'success');
      load();
    } catch (error) {
      notify(error.response?.data?.message || 'Could not update listing status.', 'error');
    }
  }

  async function flagListing(product) {
    try {
      await api.patch(`/admin/products/${product._id}/moderation`, { moderationStatus: 'rejected' });
      notify(`"${product.name}" flagged and hidden from the marketplace.`, 'success');
      load();
    } catch (error) {
      notify(error.response?.data?.message || 'Could not flag this listing.', 'error');
    }
  }

  async function clearFlag(product) {
    try {
      await api.patch(`/admin/products/${product._id}/moderation`, { moderationStatus: 'approved' });
      notify(`"${product.name}" approved and visible again.`, 'success');
      load();
    } catch (error) {
      notify(error.response?.data?.message || 'Could not approve this listing.', 'error');
    }
  }

  async function handleDelete(product) {
    if (!confirm(`Remove listing "${product.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/products/${product._id}`);
      notify(`"${product.name}" removed.`, 'success');
      load();
    } catch (error) {
      notify(error.response?.data?.message || 'Could not remove this listing.', 'error');
    }
  }

  const filtered = products.filter((p) => !showFlaggedOnly || p.moderationStatus === 'rejected');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products &amp; Services</h1>
          <p className="text-sm text-gray-500">
            {filtered.length} of {products.length} marketplace listings — new listings go live immediately
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={showFlaggedOnly} onChange={(e) => setShowFlaggedOnly(e.target.checked)} />
          Flagged only
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-500">
              <th className="px-4 py-3 font-medium">Listing</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Seller</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Available</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const isFlagged = p.moderationStatus === 'rejected';
              return (
                <tr key={p._id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-800" title={p.description || ''}>
                    {p.name} {p.variety && <span className="font-normal text-gray-500">({p.variety})</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.offerType === 'service' ? 'bg-teal-100 text-teal-700' : 'bg-primary-100 text-primary-700'
                      }`}
                    >
                      {p.offerType === 'service' ? <Wrench size={11} /> : <Sprout size={11} />}
                      {p.offerType === 'service' ? 'Service' : 'Product'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.seller?.name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.category}</td>
                  <td className="px-4 py-3 text-gray-600">Rs {p.pricePerKg} / {p.unit || 'kg'}</td>
                  <td className="px-4 py-3 text-gray-600">{p.availableQty} {p.unit || 'kg'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.status === 'active' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'}`}>
                        {p.status}
                      </span>
                      {isFlagged && (
                        <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          <Flag size={11} /> Flagged
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      {isFlagged ? (
                        <button
                          onClick={() => clearFlag(p)}
                          className="flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700"
                        >
                          <Check size={12} /> Approve
                        </button>
                      ) : (
                        <button
                          onClick={() => flagListing(p)}
                          className="flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          <Flag size={12} /> Flag
                        </button>
                      )}
                      <button onClick={() => toggleStatus(p)} className="text-xs font-semibold text-primary-600 hover:underline">
                        {p.status === 'active' ? 'Hide' : 'Unhide'}
                      </button>
                      <button onClick={() => handleDelete(p)} className="text-gray-400 hover:text-red-500" aria-label={`Remove ${p.name}`}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                  No listings found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
