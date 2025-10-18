
import React, {useEffect, useState} from 'react';
import api from '../api';
import { Link } from 'react-router-dom';

export default function Dashboard(){
  const [data,setData] = useState({ total_cars:0, total_payments:0, latestCars:[] });
  const [cars,setCars] = useState([]);
  const [transactions,setTransactions] = useState([]);
  const role = localStorage.getItem('role') || 'user';
  useEffect(()=>{ api.get('/dashboard').then(r=>setData(r.data)).catch(e=>console.error(e)) },[]);
  useEffect(()=>{
    if(role === 'admin'){
      api.get('/payments').then(r=>setTransactions(r.data)).catch(e=>console.error(e));
    }else{
      api.get('/cars').then(r=>setCars(r.data)).catch(e=>console.error(e));
    }
  },[role]);
  async function verifyPayment(id){
    try{ await api.post(`/payments/${id}/verify`, { verified: true }); alert('Verified'); api.get('/payments').then(r=>setTransactions(r.data)); }catch(e){ alert(e.response?.data?.error || 'Error') }
  }
  async function editPrice(carId){
    const p = prompt('New price per day'); if(!p) return; try{ await api.put(`/cars/${carId}`, { price_per_day: parseFloat(p) }); alert('Updated'); }catch(e){ alert(e.response?.data?.error || 'Error') }
  }
  return (
    <div className="p-6">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">A6CARS Dashboard</h1>
        <div>
          <Link to="/history" className="mr-3 px-3 py-2 bg-gray-200 rounded">My History</Link>
          <Link to="/add-car" className="mr-3 px-3 py-2 bg-green-600 text-white rounded">Add Car</Link>
          <Link to="/scan" className="px-3 py-2 bg-indigo-600 text-white rounded">Scan Payment</Link>
          <button className="ml-3 px-3 py-2 bg-red-500 text-white rounded" onClick={()=>{ localStorage.removeItem('token'); localStorage.removeItem('role'); window.location='/login' }}>Logout</button>
        </div>
      </header>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm">Total Cars</div>
          <div className="text-2xl font-bold">{data.total_cars}</div>
        </div>
        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm">Total Payments</div>
          <div className="text-2xl font-bold">{data.total_payments}</div>
        </div>
        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm">Recent</div>
          <div className="text-lg">{data.latestCars.length} cars</div>
        </div>
      </div>

      {role === 'admin' ? (
        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold mb-3">Transactions</h2>
          <table className="w-full">
            <thead><tr className="text-left"><th>ID</th><th>Car</th><th>Amount</th><th>User</th><th>Method</th></tr></thead>
            <tbody>
              {transactions.map(t=> (
                <tr key={t.id} className="border-t"><td>{t.id}</td><td>{t.car_id}</td><td>{t.amount}</td><td>{t.user_id}</td><td>{t.payment_method}</td><td><button className="px-2 py-1 bg-green-600 text-white rounded" onClick={()=>verifyPayment(t.id)}>Verify</button></td></tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3">
            <Link to="/scan" className="px-3 py-2 bg-indigo-600 text-white rounded">Open QR Scanner</Link>
          </div>
        </div>
      ) : (
        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold mb-3">Available Cars</h2>
          <table className="w-full">
            <thead><tr className="text-left"><th>Reg No</th><th>Brand</th><th>Model</th><th>Action</th></tr></thead>
            <tbody>
              {cars.map(c=>(
                <tr key={c.id} className="border-t">
                  <td>{c.reg_no}</td>
                  <td>{c.brand}</td>
                  <td>{c.model}</td>
                  <td><Link to={`/car/${c.id}`} className="text-blue-600">Details</Link></td>
                  <td><button className="ml-2 px-2 py-1 bg-yellow-400 rounded" onClick={()=>editPrice(c.id)}>Edit Price</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
