import React, {useEffect, useState, useMemo} from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { addDays, isBefore, isAfter, parseISO, startOfDay } from 'date-fns';

export default function History(){
  const [cars,setCars] = useState([]);
  const [selected, setSelected] = useState(null);
  const [range, setRange] = useState([null,null]);
  const [unavailable, setUnavailable] = useState({});
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const nav = useNavigate();
  const [start, end] = range;

  useEffect(()=>{ api.get('/cars').then(r=>setCars(r.data)).catch(e=>console.error(e)) },[]);

  useEffect(()=>{
    async function load(){
      try{
        const res = await api.get('/payments');
        const map = {};
        (res.data||[]).forEach(p=>{
          if (!p.paid || p.paid == 0) return;
          if (!map[p.car_id]) map[p.car_id]=[];
          if (p.start_date && p.end_date) map[p.car_id].push({ start: p.start_date, end: p.end_date });
        });
        setUnavailable(map);
      }catch(e){
        try{ const me = await api.get('/payments/me'); const map={}; (me.data||[]).forEach(p=>{ if(!map[p.car_id]) map[p.car_id]=[]; if(p.start_date&&p.end_date) map[p.car_id].push({start:p.start_date,end:p.end_date}) }); setUnavailable(map); }catch(err){ console.warn('Could not load bookings', err) }
      }
    }
    load();
  },[]);

  function isDayDisabledForCar(car, d){
    const today = startOfDay(new Date());
    const day = startOfDay(d);
    if (isBefore(day, today)) return true;
    const arr = unavailable[car.id]||[];
    for(const r of arr){
      const rs = startOfDay(parseISO(r.start));
      const re = startOfDay(parseISO(r.end));
      if (!isBefore(day, rs) && !isAfter(day, re)) return true;
    }
    return false;
  }

  const days = useMemo(()=>{
    if(!start||!end) return 0;
    const s = startOfDay(start); const e = startOfDay(end);
    const diff = Math.round((e - s)/(1000*60*60*24)) + 1; // inclusive
    return diff>0?diff:0;
  },[start,end]);

  async function startPayment(){
    if(!selected) return setMessage('Select a car');
    if(!start || !end) return setMessage('Select start and end dates');
    let cur = startOfDay(start);
    while(cur <= startOfDay(end)){
      if(isDayDisabledForCar(selected, cur)) return setMessage('Selected range includes unavailable or past dates');
      cur = addDays(cur, 1);
    }
    const base = parseFloat(selected.price_per_day||0) * days;
    const discount = days>10?0.05:0;
  const total = +(base * (1-discount)).toFixed(2);
  // Only generate the bank/payment identifier in the payment QR as requested
  const paymentPayload = '8179134484@pthdfc';
    try{
      setProcessing(true); setMessage('Creating payment...');
      const qrDataUrl = await QRCode.toDataURL(paymentPayload);
      setQrUrl(qrDataUrl);
      const res = await api.post('/payments', { car_id: selected.id, amount: total, payment_method: 'QR', qr_payload: paymentPayload, start_date: start.toISOString().slice(0,10), end_date: end.toISOString().slice(0,10) });
      const paymentId = res.data.id;
      const tkResp = await api.post('/mock-webhook-tokens', { payment_id: paymentId }).then(r=>r.data).catch(()=>null);
      const token = tkResp?.token || '';
      // open a small popup with the QR and a button that triggers the mock webhook
      const paymentWindow = window.open('', 'paymentWindow', 'width=420,height=540');
      if(paymentWindow){
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>Pay</title></head><body style="font-family:sans-serif;padding:12px"><img src="${qrDataUrl}"/><div style="margin-top:12px"><button id=paid style="padding:8px 12px;background:#10b981;color:#fff;border:none;border-radius:6px">I paid</button></div><script>document.getElementById('paid').addEventListener('click', async ()=>{ try{ const res = await fetch('${window.location.origin}/api/mock-webhook',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ token: '${token}' })}); const j=await res.json(); alert(JSON.stringify(j)); window.close(); }catch(e){ alert('Error:'+e) } });</script></body></html>`;
        paymentWindow.document.write(html);
        window.paymentWindow = paymentWindow;
      }
      // poll for confirmation
      let attempts = 0; let paid = false;
      while(attempts < 60){
        await new Promise(r=>setTimeout(r,2000));
        attempts++;
        try{
          const p = await api.get(`/payments/${paymentId}`);
          if (p.data.paid == 1 || p.data.paid === true){ paid = true; break; }
        }catch(err){ /* ignore */ }
      }
      if(!paid) return setMessage('Payment not confirmed within timeout.');
      // generate and trigger download of confirmation QR
      const conf = { payment_id: paymentId, car: selected, start: start.toISOString().slice(0,10), end: end.toISOString().slice(0,10), amount: total, user: { name: localStorage.getItem('name') || '', id: null } };
      const confQr = await QRCode.toDataURL(JSON.stringify(conf));
      const a = document.createElement('a'); a.href = confQr; a.download = `booking_${paymentId}.png`; document.body.appendChild(a); a.click(); a.remove();
      setMessage('Payment confirmed and confirmation QR downloaded');
      // refresh unavailable dates
      try{ const res2 = await api.get('/payments'); const map = {}; (res2.data||[]).forEach(p=>{ if (!p.paid || p.paid == 0) return; if (!map[p.car_id]) map[p.car_id]=[]; if (p.start_date && p.end_date) map[p.car_id].push({ start: p.start_date, end: p.end_date }); }); setUnavailable(map); }catch(e){}
    }catch(e){ setMessage(e.response?.data?.error || e.message || 'Payment failed') }
    finally{ setProcessing(false) }
  }

  return (
    <div className="p-6">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Book a Car</h1>
        <div>
          <button className="px-3 py-2 bg-gray-200 rounded" onClick={()=>{ localStorage.removeItem('token'); localStorage.removeItem('role'); nav('/login') }}>Logout</button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-4">
        {cars.map(c=> (
          <div key={c.id} className={`p-4 bg-white rounded shadow ${selected && selected.id===c.id ? 'border-2 border-indigo-500' : ''}`}>
            <div className="font-semibold">{c.brand} - {c.model}</div>
            <div className="text-sm">{c.reg_no} • {c.location}</div>
            <div className="mt-2">Price/day: ₹{c.price_per_day || '0.00'}</div>
            <div className="mt-3 flex items-center">
              <button className="px-3 py-1 bg-indigo-600 text-white rounded mr-2" onClick={()=>{ setSelected(c); setRange([null,null]); setMessage(''); setQrUrl(''); }}>Select</button>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="mt-6 bg-white p-4 rounded shadow max-w-2xl">
          <h2 className="font-semibold mb-2">Book: {selected.brand} {selected.model} ({selected.reg_no})</h2>
          <div className="flex gap-4 items-start">
            <div>
              <label className="text-sm">Select date range</label>
              <DatePicker
                selected={start}
                onChange={(update) => setRange(update)}
                startDate={start}
                endDate={end}
                selectsRange
                inline
                minDate={new Date()}
                filterDate={(d) => !isDayDisabledForCar(selected, d)}
              />
            </div>
            <div className="ml-6">
              <div className="text-sm">Days: {days}</div>
              <div className="text-sm">Discount: {days>10? '5%':'0%'}</div>
              <div className="text-lg font-bold">Total: ₹{(parseFloat(selected.price_per_day||0)*days*(days>10?0.95:1)).toFixed(2)}</div>
              <div className="mt-4"><button disabled={processing} className="px-4 py-2 bg-green-600 text-white rounded" onClick={startPayment}>Pay & Book</button></div>
              {message && <div className="mt-3 text-sm text-red-600">{message}</div>}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
