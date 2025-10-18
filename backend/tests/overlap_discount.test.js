const request = require('supertest');
const BASE = 'http://localhost:4000';

describe('Overlap and discount tests', () => {
  let userToken, adminToken, carId;
  beforeAll(async () => {
    const login = await request(BASE).post('/api/login').send({ email: 'hari0323', password: 'Anu' });
    adminToken = login.body.token;
    const email = `overlap_${Date.now()}@example.com`;
    await request(BASE).post('/api/signup').send({ name: 'OverlapUser', email, password: 'pw' });
    const loginu = await request(BASE).post('/api/login').send({ email, password: 'pw' });
    userToken = loginu.body.token;
    // create a car for tests
    const add = await request(BASE).post('/api/cars').set('Authorization', `Bearer ${adminToken}`).send({ reg_no: `OV-${Date.now()}`, brand: 'OV', model:'O1', model_year:2025, location:'OV Lot', price_per_day: 100 });
    carId = add.body.id;
  }, 20000);

  test('overlapping paid bookings are blocked', async () => {
    // create first booking and mark paid via webhook token
    const start1 = new Date(Date.now() + 2*24*3600*1000).toISOString().slice(0,10);
    const end1 = new Date(Date.now() + 4*24*3600*1000).toISOString().slice(0,10);
    const pay1 = await request(BASE).post('/api/payments').set('Authorization', `Bearer ${userToken}`).send({ car_id: carId, amount: 100, payment_method: 'QR', qr_payload:'x', start_date: start1, end_date: end1 });
    const payId1 = pay1.body.id;
    const tk1 = await request(BASE).post('/api/mock-webhook-tokens').set('Authorization', `Bearer ${userToken}`).send({ payment_id: payId1 });
    await request(BASE).post('/api/mock-webhook').send({ token: tk1.body.token });
    // attempt overlapping booking
    const start2 = new Date(Date.now() + 3*24*3600*1000).toISOString().slice(0,10);
    const end2 = new Date(Date.now() + 5*24*3600*1000).toISOString().slice(0,10);
    const pay2 = await request(BASE).post('/api/payments').set('Authorization', `Bearer ${userToken}`).send({ car_id: carId, amount: 100, payment_method: 'QR', qr_payload:'x', start_date: start2, end_date: end2 });
    expect(pay2.statusCode).toBe(400);
  }, 20000);

  test('discount applied for >10 days', async () => {
    const start = new Date(Date.now() + 20*24*3600*1000).toISOString().slice(0,10);
    const end = new Date(Date.now() + 31*24*3600*1000).toISOString().slice(0,10); // 12 days inclusive
    const pay = await request(BASE).post('/api/payments').set('Authorization', `Bearer ${userToken}`).send({ car_id: carId, amount: 100*12*0.95, payment_method: 'QR', qr_payload:'x', start_date: start, end_date: end });
    expect(pay.statusCode).toBe(200);
    const payId = pay.body.id;
    // confirm via webhook token
    const tk = await request(BASE).post('/api/mock-webhook-tokens').set('Authorization', `Bearer ${userToken}`).send({ payment_id: payId });
    await request(BASE).post('/api/mock-webhook').send({ token: tk.body.token });
    const car = await request(BASE).get(`/api/cars/${carId}`).set('Authorization', `Bearer ${adminToken}`);
    const booking = car.body.bookings.find(b=>b.id===payId);
    expect(Number(booking.amount)).toBeCloseTo(100*12*0.95, 2);
  }, 20000);
});
