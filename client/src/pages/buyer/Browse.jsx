import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Sprout, Wrench, X } from 'lucide-react';
import api, { getErrorMessage } from '../../api/client.js';
import { mediaUrl } from '../../utils/mediaUrl.js';

const OFFER_TYPES = [
  { value: 'All', label: 'All' },
  { value: 'product', label: 'Products' },
  { value: 'service', label: 'Services' },
];

const CATEGORY_OPTIONS = {
  All: ['All'],
  product: ['All', 'Crops', 'Seeds', 'Organic', 'Tools'],
  service: ['All', 'Tractor Service', 'Labor', 'Irrigation', 'Veterinary', 'Consultation', 'Other'],
};

const EMPTY_RANGE = { minPrice: '', maxPrice: '', minQty: '' };

export default function Browse() {
  const [products, setProducts] = useState([]);
  const [offerType, setOfferType] = useState('All');
  const [category, setCategory] = useState('All');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [range, setRange] = useState(EMPTY_RANGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Debounce the free-text search so we're not firing a request on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    const params = {};
    if (offerType !== 'All') params.offerType = offerType;
    if (category !== 'All') params.category = category;
    if (search) params.search = search;
    if (range.minPrice !== '') params.minPrice = range.minPrice;
    if (range.maxPrice !== '') params.maxPrice = range.maxPrice;
    if (range.minQty !== '') params.minQty = range.minQty;

    setLoading(true);
    setError('');
    api
      .get('/products', { params })
      .then((res) => {
        if (active) setProducts(res.data);
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [offerType, category, search, range]);

  function selectOfferType(value) {
    setOfferType(value);
    setCategory('All');
  }

  function updateRange(key, value) {
    setRange((r) => ({ ...r, [key]: value }));
  }

  const filtersActive =
    offerType !== 'All' || category !== 'All' || search !== '' || range.minPrice !== '' || range.maxPrice !== '' || range.minQty !== '';

  function clearFilters() {
    setOfferType('All');
    setCategory('All');
    setSearchInput('');
    setSearch('');
    setRange(EMPTY_RANGE);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Browse Products &amp; Services</h1>
        <p className="text-sm text-gray-500">Fresh crops, seeds, organic inputs, tools, and local services from farmers.</p>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name, variety, or description..."
          className="w-full rounded-full border border-gray-300 py-2.5 pl-9 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      <div className="flex gap-2">
        {OFFER_TYPES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => selectOfferType(value)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium ${
              offerType === value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {value === 'product' && <Sprout size={14} />}
            {value === 'service' && <Wrench size={14} />}
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {CATEGORY_OPTIONS[offerType].map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${
              category === c ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3">
        <span className="text-xs font-medium text-gray-500">Price (Rs)</span>
        <input
          type="number"
          min="0"
          placeholder="Min"
          value={range.minPrice}
          onChange={(e) => updateRange('minPrice', e.target.value)}
          className="w-20 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
        />
        <span className="text-gray-300">–</span>
        <input
          type="number"
          min="0"
          placeholder="Max"
          value={range.maxPrice}
          onChange={(e) => updateRange('maxPrice', e.target.value)}
          className="w-20 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
        />

        <span className="ml-2 text-xs font-medium text-gray-500">Min. available</span>
        <input
          type="number"
          min="0"
          placeholder="e.g. 5"
          value={range.minQty}
          onChange={(e) => updateRange('minQty', e.target.value)}
          className="w-24 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
        />

        {filtersActive && (
          <button
            onClick={clearFilters}
            className="ml-auto flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline"
          >
            <X size={13} /> Clear filters
          </button>
        )}
      </div>

      {!loading && !error && (
        <p className="text-sm text-gray-500">
          {products.length} {products.length === 1 ? 'result' : 'results'}
          {search && <> for &quot;{search}&quot;</>}
        </p>
      )}

      {loading && <p className="py-10 text-center text-gray-400">Loading listings...</p>}

      {!loading && error && (
        <p className="rounded-xl border border-red-200 bg-red-50 py-6 text-center text-sm text-red-700">{error}</p>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <Link key={p._id} to={`/buyer/products/${p._id}`} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm hover:shadow-md">
              <img src={mediaUrl(p.imageUrl) || 'https://placehold.co/200x140?text=%20'} alt={p.name} className="mb-2 h-28 w-full rounded-lg object-cover" />
              <p className="truncate text-sm font-semibold text-gray-900">
                {p.name} {p.variety && <span className="font-normal text-gray-500">({p.variety})</span>}
              </p>
              <p className="text-xs text-gray-500">{p.seller?.location}</p>
              <p className="mt-1 text-sm font-bold text-primary-700">
                Rs {p.pricePerKg} / {p.unit || 'kg'}
              </p>
              <p className="text-xs text-gray-500">{p.availableQty} {p.unit || 'kg'} available</p>
            </Link>
          ))}
          {products.length === 0 && (
            <div className="col-span-full py-10 text-center text-gray-400">
              <p>No listings match your filters.</p>
              {filtersActive && (
                <button onClick={clearFilters} className="mt-2 text-sm font-semibold text-primary-600 hover:underline">
                  Clear filters and try again
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
