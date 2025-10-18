const QRCode = require('qrcode');
const fs = require('fs');
(async ()=>{
  const paymentPayload = '8179134484@pthdfc|amount:123.45|car:3|user:Test';
  const dataUrl = await QRCode.toDataURL(paymentPayload);
  const base64 = dataUrl.split(',')[1];
  fs.writeFileSync('payment_qr.png', Buffer.from(base64,'base64'));
  console.log('Wrote payment_qr.png');
  const conf = { payment_id: 999, car:{id:3,reg_no:'E2E-XYZ'}, start:'2025-10-20', end:'2025-10-25', amount:123.45, user:{name:'Test',id:99} };
  const confUrl = await QRCode.toDataURL(JSON.stringify(conf));
  const base64c = confUrl.split(',')[1];
  fs.writeFileSync('conf_qr.png', Buffer.from(base64c,'base64'));
  console.log('Wrote conf_qr.png');
})();
