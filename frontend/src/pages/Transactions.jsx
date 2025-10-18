import React, {useEffect, useState} from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

export default function Transactions(){
  const [txs,setTxs] = useState([]);
  const nav = useNavigate();
  useEffect(()=>{ api.get('/payments/me').then(r=>setTxs(r.data)).catch(e=>console.error(e)) },[]);
  return (
    <div className="p-6">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Transactions</h1>
        <div>
          <button className="px-3 py-2 bg-gray-200 rounded" onClick={()=>{ localStorage.removeItem('token'); localStorage.removeItem('role'); nav('/login') }}>Logout</button>
        </div>
      </header>
      <div className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold mb-3">Payments / Bookings</h2>
        <table className="w-full">
          <thead><tr className="text-left"><th>ID</th><th>Car</th><th>Amount</th><th>Paid At</th></tr></thead>
          <tbody>
            {txs.map(t=> (
              <tr key={t.id} className="border-t"><td>{t.id}</td><td>{t.car_id}</td><td>₹{t.amount}</td><td>{t.paid_at?new Date(t.paid_at).toLocaleString():'-'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
