import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.JWT_SECRET = 'test_jwt_secret_at_least_16_chars_long';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.BCRYPT_SALT_ROUNDS = '4';

const { createApp } = await import('../app.js');
const { default: User } = await import('../models/User.js');
const { default: Product } = await import('../models/Product.js');

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = createApp();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Product.deleteMany({});
});

async function registerUser(overrides = {}) {
  const email = overrides.email || 'seller-one@example.com';
  const password = overrides.password || 'password123';

  const registerRes = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Seller One',
      email,
      password,
      role: 'farmer',
      ...overrides,
    });

  // New registrations are pending until an admin approves them.
  await User.updateOne({ email }, { approvalStatus: 'approved' });

  const loginRes = await request(app).post('/api/auth/login').send({ email, password });
  return { token: loginRes.body.token, user: registerRes.body.user };
}

function validListing(overrides = {}) {
  return {
    name: 'Fresh Tomatoes',
    description: 'Vine-ripened hybrid tomatoes, harvested this morning.',
    variety: 'Hybrid',
    category: 'Crops',
    pricePerKg: 45,
    availableQty: 100,
    location: 'Kavre',
    ...overrides,
  };
}

describe('POST /api/products (create listing)', () => {
  it('allows an authenticated seller to create a listing, saved in MongoDB with the seller from the JWT', async () => {
    const { token, user } = await registerUser();

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validListing(), seller: '000000000000000000000000', sellerId: 'hacked' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Fresh Tomatoes');
    expect(res.body.seller).toBe(user._id);

    const stored = await Product.findById(res.body._id);
    expect(stored).not.toBeNull();
    expect(stored.seller.toString()).toBe(user._id);
  });

  it('rejects creation with no authentication', async () => {
    const res = await request(app).post('/api/products').send(validListing());
    expect(res.status).toBe(401);
  });

  it('rejects creation from a buyer role with 403', async () => {
    const { token } = await registerUser({ role: 'buyer', email: 'buyer-only@example.com' });
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send(validListing());
    expect(res.status).toBe(403);
  });

  it('rejects a listing with a missing name', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send(validListing({ name: '' }));
    expect(res.status).toBe(400);
  });

  it('rejects a listing with an invalid (zero or negative) price', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send(validListing({ pricePerKg: 0 }));
    expect(res.status).toBe(400);
  });

  it('rejects a listing with a negative available quantity', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send(validListing({ availableQty: -5 }));
    expect(res.status).toBe(400);
  });

  it('rejects a listing with a missing description', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send(validListing({ description: '' }));
    expect(res.status).toBe(400);
  });

  it('creates a service listing with a service-specific category', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send(
        validListing({
          name: 'Tractor Ploughing',
          description: 'Half-day tractor ploughing for up to 2 ropani.',
          offerType: 'service',
          category: 'Tractor Service',
          unit: 'visit',
        })
      );
    expect(res.status).toBe(201);
    expect(res.body.offerType).toBe('service');
    expect(res.body.category).toBe('Tractor Service');
  });

  it('rejects a service listing using a product-only category', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send(validListing({ offerType: 'service', category: 'Crops' }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/products (buyer marketplace)', () => {
  it('returns a newly created active listing', async () => {
    const { token } = await registerUser();
    const created = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send(validListing({ name: 'Marketplace Visible Crop' }));

    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    const found = res.body.find((p) => p._id === created.body._id);
    expect(found).toBeTruthy();
    expect(found.name).toBe('Marketplace Visible Crop');
  });

  it('filters by offerType', async () => {
    const { token } = await registerUser();
    await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send(validListing({ name: 'A Crop' }));
    await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send(
        validListing({
          name: 'A Service',
          offerType: 'service',
          category: 'Labor',
          unit: 'hour',
        })
      );

    const services = await request(app).get('/api/products').query({ offerType: 'service' });
    expect(services.body).toHaveLength(1);
    expect(services.body[0].name).toBe('A Service');

    const products = await request(app).get('/api/products').query({ offerType: 'product' });
    expect(products.body).toHaveLength(1);
    expect(products.body[0].name).toBe('A Crop');
  });

  it('searches by keyword across name, variety, and description', async () => {
    const { token } = await registerUser();
    await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send(validListing({ name: 'Fresh Cauliflower', variety: 'Snowball', description: 'Locally grown.' }));
    await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send(validListing({ name: 'Sweet Potato', variety: 'Orange', description: 'Grown in cauliflower rotation fields.' }));
    await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send(validListing({ name: 'Rice', variety: 'Basmati', description: 'Aromatic long-grain rice.' }));

    const byName = await request(app).get('/api/products').query({ search: 'cauliflower' });
    expect(byName.body.map((p) => p.name).sort()).toEqual(['Fresh Cauliflower', 'Sweet Potato']);

    const byVariety = await request(app).get('/api/products').query({ search: 'basmati' });
    expect(byVariety.body).toHaveLength(1);
    expect(byVariety.body[0].name).toBe('Rice');
  });

  it('treats regex special characters in search as literal text instead of erroring', async () => {
    const { token } = await registerUser();
    await request(app).post('/api/products').set('Authorization', `Bearer ${token}`).send(validListing());

    const res = await request(app).get('/api/products').query({ search: 'toma+toes(' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('filters by price range', async () => {
    const { token } = await registerUser();
    await request(app).post('/api/products').set('Authorization', `Bearer ${token}`).send(validListing({ name: 'Cheap Crop', pricePerKg: 10 }));
    await request(app).post('/api/products').set('Authorization', `Bearer ${token}`).send(validListing({ name: 'Mid Crop', pricePerKg: 50 }));
    await request(app).post('/api/products').set('Authorization', `Bearer ${token}`).send(validListing({ name: 'Pricey Crop', pricePerKg: 200 }));

    const res = await request(app).get('/api/products').query({ minPrice: 20, maxPrice: 100 });
    expect(res.body.map((p) => p.name)).toEqual(['Mid Crop']);
  });

  it('filters by minimum available quantity', async () => {
    const { token } = await registerUser();
    await request(app).post('/api/products').set('Authorization', `Bearer ${token}`).send(validListing({ name: 'Low Stock', availableQty: 3 }));
    await request(app).post('/api/products').set('Authorization', `Bearer ${token}`).send(validListing({ name: 'High Stock', availableQty: 50 }));

    const res = await request(app).get('/api/products').query({ minQty: 10 });
    expect(res.body.map((p) => p.name)).toEqual(['High Stock']);
  });

  it('excludes listings marked inactive', async () => {
    const { token, user } = await registerUser();
    const created = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send(validListing({ name: 'Should Be Hidden' }));

    await Product.findByIdAndUpdate(created.body._id, { status: 'inactive' });

    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.find((p) => p._id === created.body._id)).toBeUndefined();
    void user;
  });

  it('excludes sold-out listings (availableQty 0)', async () => {
    const { token } = await registerUser();
    const created = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send(validListing({ name: 'Sold Out Crop', availableQty: 0 }));

    const res = await request(app).get('/api/products');
    expect(res.body.find((p) => p._id === created.body._id)).toBeUndefined();
  });

  it('never exposes sensitive seller fields', async () => {
    const { token } = await registerUser();
    await request(app).post('/api/products').set('Authorization', `Bearer ${token}`).send(validListing());

    const res = await request(app).get('/api/products');
    const seller = res.body[0].seller;
    expect(seller.email).toBeUndefined();
    expect(seller.password).toBeUndefined();
    expect(seller.phone).toBeUndefined();
  });
});

describe('GET /api/products/mine (seller listing management)', () => {
  it('returns only the authenticated seller\'s own listings', async () => {
    const sellerA = await registerUser({ email: 'seller-a@example.com' });
    const sellerB = await registerUser({ email: 'seller-b@example.com' });

    await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${sellerA.token}`)
      .send(validListing({ name: 'Seller A Crop' }));
    await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${sellerB.token}`)
      .send(validListing({ name: 'Seller B Crop' }));

    const res = await request(app).get('/api/products/mine').set('Authorization', `Bearer ${sellerA.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Seller A Crop');
  });
});

describe('ownership enforcement on update/delete', () => {
  it('does not allow a seller to update another seller\'s listing', async () => {
    const sellerA = await registerUser({ email: 'seller-a@example.com' });
    const sellerB = await registerUser({ email: 'seller-b@example.com' });

    const created = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${sellerA.token}`)
      .send(validListing({ name: 'Owned By A' }));

    const res = await request(app)
      .put(`/api/products/${created.body._id}`)
      .set('Authorization', `Bearer ${sellerB.token}`)
      .send({ name: 'Hijacked' });

    expect(res.status).toBe(404);
    const unchanged = await Product.findById(created.body._id);
    expect(unchanged.name).toBe('Owned By A');
  });

  it('does not allow a seller to delete another seller\'s listing', async () => {
    const sellerA = await registerUser({ email: 'seller-a@example.com' });
    const sellerB = await registerUser({ email: 'seller-b@example.com' });

    const created = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${sellerA.token}`)
      .send(validListing({ name: 'Owned By A' }));

    const res = await request(app)
      .delete(`/api/products/${created.body._id}`)
      .set('Authorization', `Bearer ${sellerB.token}`);

    expect(res.status).toBe(404);
    const stillExists = await Product.findById(created.body._id);
    expect(stillExists).not.toBeNull();
  });
});
