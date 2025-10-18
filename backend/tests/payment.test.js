const request = require('supertest');
const BASE = 'http://localhost:4000';

describe('Payment webhook flow', () => {
  let userToken, adminToken, carId, payId;
  test('signup and login user', async () => {
    const email = `testuser+jest+${Date.now()}@example.com`;
    const resp = await request(BASE).post('/api/signup').send({ name: 'TestUser', email, password: 'pwtest' });
    expect(resp.statusCode).toBe(200);
    const login = await request(BASE).post('/api/login').send({ email, password: 'pwtest' });
    expect(login.statusCode).toBe(200);
    userToken = login.body.token;
    expect(userToken).toBeTruthy();
  }, 10000);

  test('admin login and add car', async () => {
    const login = await request(BASE).post('/api/login').send({ email: 'hari0323', password: 'Anu' });
    expect(login.statusCode).toBe(200);
    adminToken = login.body.token;
    const regNo = `JEST-${Date.now()}`;
    const add = await request(BASE).post('/api/cars').set('Authorization', `Bearer ${adminToken}`).send({ reg_no: regNo, brand: 'Jest', model: 'J1', model_year: 2025, location: 'Test', price_per_day: 100 });
    expect(add.statusCode).toBe(200);
    carId = add.body.id;
  }, 10000);

  test('create pending payment and confirm via webhook token', async () => {
    const start = new Date(Date.now() + 6*24*3600*1000).toISOString().slice(0,10);
    const end = new Date(Date.now() + 8*24*3600*1000).toISOString().slice(0,10);
    const pay = await request(BASE).post('/api/payments').set('Authorization', `Bearer ${userToken}`).send({ car_id: carId, amount: 200, payment_method: 'QR', qr_payload: '8179134484@pthdfc|amount:200', start_date: start, end_date: end });
    expect(pay.statusCode).toBe(200);
    payId = pay.body.id;
    // request webhook token
    const tk = await request(BASE).post('/api/mock-webhook-tokens').set('Authorization', `Bearer ${userToken}`).send({ payment_id: payId });
    expect(tk.statusCode).toBe(200);
    const token = tk.body.token;
    // call webhook
    const wh = await request(BASE).post('/api/mock-webhook').send({ token });
    expect(wh.statusCode).toBe(200);
    // admin verify
    const v = await request(BASE).post(`/api/payments/${payId}/verify`).set('Authorization', `Bearer ${adminToken}`).send({ verified: true });
    expect(v.statusCode).toBe(200);
    // check booking on car details
    const car = await request(BASE).get(`/api/cars/${carId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(car.statusCode).toBe(200);
    const bookings = car.body.bookings || [];
    const found = bookings.find(b=>b.id === payId);
    expect(found).toBeTruthy();
    expect(found.paid).toBe(1);
    expect(found.admin_verified).toBe(1);
  }, 20000);
});
