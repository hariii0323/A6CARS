
import React, { useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import api from '../api';

export default function ScanPayment(){
  useEffect(()=>{
    const qrRegionId = "reader";
    const html5QrCode = new Html5Qrcode(qrRegionId);
    html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      async (decodedText, decodedResult) => {
        try{
          const parsed = JSON.parse(decodedText);
          await api.post('/payments', {
            car_id: parsed.car_id,
            amount: parsed.amount,
            payment_method: 'QR',
            qr_payload: decodedText
          });
          alert('Payment recorded');
          html5QrCode.stop();
        }catch(e){
          console.error('Invalid QR payload', e);
          alert('Invalid QR data. Expecting JSON: {"car_id":1,"amount":100}');
        }
      },
      (errorMessage) => { }
    ).catch(err => console.error('Start failed', err));
    return ()=> {};
  },[]);
  return (
    <div className="p-6">
      <h2 className="text-xl mb-4">Scan Payment (QR)</h2>
      <div id="reader" style={{ width: 300 }}></div>
      <p className="mt-3 text-sm text-gray-600">Scan a QR containing JSON: {"{\\\"car_id\\\":1,\\\"amount\\\":100}"}</p>
    </div>
  );
}
