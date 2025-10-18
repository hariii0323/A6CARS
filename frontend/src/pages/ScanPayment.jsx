import React, { useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import api from '../api';

export default function ScanPayment(){
  useEffect(()=>{
    const qrRegionId = 'html5qr';
    const html5QrCode = new Html5Qrcode(qrRegionId);
    html5QrCode.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: 250 },
      async (decodedText) => {
        try{
          // Expecting the confirmation QR to contain JSON like { payment_id: 123 }
          const parsed = JSON.parse(decodedText);
          if (parsed && parsed.payment_id){
            await api.post(`/payments/${parsed.payment_id}/verify`, { verified: true });
            alert('Booking verified: ' + parsed.payment_id);
            await html5QrCode.stop();
          }
        }catch(e){
          console.warn('Invalid QR payload', e);
        }
      },
      (errorMessage) => { /* ignore scan errors */ }
    ).catch(err => console.error('Start failed', err));
    return ()=>{ html5QrCode.stop().catch(()=>{}); };
  },[]);

  return (
    <div className="p-6">
      <h2 className="text-xl mb-4">Scan Payment Confirmation</h2>
      <div id="html5qr" style={{ width: 320 }}></div>
      <p className="mt-3 text-sm text-gray-600">Scan the confirmation QR provided to the admin to verify the booking.</p>
    </div>
  );
}
