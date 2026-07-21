import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, X, Pencil, Trash2 } from 'lucide-react';
import api from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import Trend from '../../components/Trend.jsx';

const EMPTY_FORM = { crop: '', variety: '', areaRopani: '', productionKg: '', avgPrice: '', expense: '', season: '' };

export default function Crops() {
  const { notify } = useToast();
  const [records, setRecords] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function load() {
    api.get('/crop-records/mine').then((res) => setRecords(res.data));
  }

  useEffect(load, []);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function startEdit(r) {
    setEditingId(r._id);
    setForm({
      crop: r.crop,
      variety: r.variety || '',
      areaRopani: r.areaRopani,
      productionKg: r.productionKg,
      avgPrice: r.avgPrice,
      expense: r.expense || '',
      season: r.season || '',
    });
    setShowForm(true);
  }

  function startNew() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      areaRopani: Number(form.areaRopani),
      productionKg: Number(form.productionKg),
      avgPrice: Number(form.avgPrice),
      expense: Number(form.expense) || 0,
    };
    try {
      if (editingId) {
        await api.put(`/crop-records/${editingId}`, payload);
        notify('Crop record updated.', 'success');
      } else {
        await api.post('/crop-records', payload);
        notify('Crop record added.', 'success');
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      setShowForm(false);
      load();
    } catch (err) {
      notify(err?.response?.data?.message || 'Could not save crop record.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this crop record?')) return;
    await api.delete(`/crop-records/${id}`);
    notify('Crop record deleted.', 'success');
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Crop Records</h1>
          <p className="text-sm text-gray-500">
            Track your seasonal crop performance and pricing for your own records. To sell a crop on the
            marketplace, use{' '}
            <Link to="/farmer/products" className="font-medium text-primary-600 hover:underline">
              My Products
            </Link>{' '}
            instead.
          </p>
        </div>
        <button
          onClick={() => (showForm ? setShowForm(false) : startNew())}
          className="flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Add New Crop'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="grid gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:grid-cols-3">
          <input required placeholder="Crop (e.g. Paddy)" value={form.crop} onChange={(e) => update('crop', e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <input placeholder="Variety" value={form.variety} onChange={(e) => update('variety', e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <input placeholder="Season (e.g. Kharif 2082)" value={form.season} onChange={(e) => update('season', e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <input required type="number" placeholder="Area (Ropani)" value={form.areaRopani} onChange={(e) => update('areaRopani', e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <input required type="number" placeholder="Production (kg)" value={form.productionKg} onChange={(e) => update('productionKg', e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <input required type="number" placeholder="Avg. Price (Rs./kg)" value={form.avgPrice} onChange={(e) => update('avgPrice', e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <input type="number" placeholder="Expense (Rs.) — seeds, fertilizer, labor, etc." value={form.expense} onChange={(e) => update('expense', e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm sm:col-span-2" />
          <button disabled={saving} type="submit" className="sm:col-span-3 rounded-lg bg-primary-600 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
            {saving ? 'Saving...' : editingId ? 'Update Record' : 'Save Record'}
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-500">
              <th className="px-4 py-3 font-medium">Crop</th>
              <th className="px-4 py-3 font-medium">Variety</th>
              <th className="px-4 py-3 font-medium">Season</th>
              <th className="px-4 py-3 font-medium">Area (Ropani)</th>
              <th className="px-4 py-3 font-medium">Production (kg)</th>
              <th className="px-4 py-3 font-medium">Avg. Price (Rs./kg)</th>
              <th className="px-4 py-3 font-medium">Expense (Rs.)</th>
              <th className="px-4 py-3 font-medium">Net Profit (Rs.)</th>
              <th className="px-4 py-3 font-medium">Trend</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const revenue = r.productionKg * r.avgPrice;
              const netProfit = revenue - (r.expense || 0);
              return (
              <tr key={r._id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium text-gray-800">{r.crop}</td>
                <td className="px-4 py-3 text-gray-600">{r.variety || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{r.season || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{r.areaRopani}</td>
                <td className="px-4 py-3 text-gray-600">{r.productionKg}</td>
                <td className="px-4 py-3 text-gray-600">{r.avgPrice}</td>
                <td className="px-4 py-3 text-gray-600">{r.expense || 0}</td>
                <td className={`px-4 py-3 font-medium ${netProfit >= 0 ? 'text-primary-700' : 'text-red-600'}`}>{netProfit}</td>
                <td className="px-4 py-3">
                  <Trend trend={r.trend} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(r)} className="flex items-center gap-1 rounded-full bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700">
                      <Pencil size={13} /> Edit
                    </button>
                    <button onClick={() => handleDelete(r._id)} className="flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
            {records.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                  No crop records yet. Add your first one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
