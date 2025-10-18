
import React, {useEffect, useState} from 'react';
import api from '../api';
import { Link } from 'react-router-dom';

export default function Dashboard(){
  const [data,setData] = useState({ total_cars:0, total_payments:0, latestCars:[] });
  useEffect(()=>{ api.get('/dashboard').then(r=>setData(r.data)).catch(e=>console.error(e)) },[]);
  return (
    <div className="p-6">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">A6CARS Dashboard</h1>
        <div>
          <Link to="/add-car" className="mr-3 px-3 py-2 bg-green-600 text-white rounded">Add Car</Link>
          <Link to="/scan" className="px-3 py-2 bg-indigo-600 text-white rounded">Scan Payment</Link>
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

      <div className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold mb-3">Recent Cars</h2>
        <table className="w-full">
          <thead><tr className="text-left"><th>Reg No</th><th>Brand</th><th>Model</th><th>Action</th></tr></thead>
          <tbody>
            {data.latestCars.map(c=>(
              <tr key={c.id} className="border-t">
                <td>{c.reg_no}</td>
                <td>{c.brand}</td>
                <td>{c.model}</td>
                <td><Link to={`/car/${c.id}`} className="text-blue-600">Details</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
