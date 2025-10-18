import React from 'react';
import api from '../api';

export default function PaymentPopup({ paymentId, paymentQrDataUrl }){
  async function markPaid(){
    try{
      await api.post(`/payments/${paymentId}/confirm`, {});
      alert('Marked as paid');
      // close window if in popup
      if(window.opener) window.close();
    }catch(e){ alert(e.response?.data?.error || 'Error') }
  }

  return (
    <div style={{padding:20,fontFamily:'sans-serif'}}>
      <h3>Payment QR</h3>
      <img src={paymentQrDataUrl} alt="payment-qr" />
      <div style={{marginTop:12}}>
        <button onClick={markPaid} style={{padding:'8px 12px',background:'#10b981',color:'#fff',border:'none',borderRadius:6}}>I paid</button>
      </div>
    </div>
  )
}
