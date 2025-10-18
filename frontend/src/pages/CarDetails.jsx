
import React, {useEffect, useState} from 'react';
import api from '../api';
import { useParams } from 'react-router-dom';

export default function CarDetails(){
  const { id } = useParams();
  const [data,setData] = useState({ car:null, history:[] });
  useEffect(()=>{ api.get(`/cars/${id}`).then(r=>setData(r.data)).catch(e=>console.error(e)) },[id]);
  if(!data.car) return <div className="p-6">Loading...</div>;
  return (
    <div className="p-6">
      <div className="bg-white p-4 rounded shadow mb-4">
        <h2 className="text-xl font-semibold">{data.car.reg_no} — {data.car.brand} {data.car.model}</h2>
        <div>Location: {data.car.location}</div>
        <div>Status: {data.car.status}</div>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <h3 className="font-semibold mb-3">History</h3>
        <ul>
          {data.history.map(h=>(
            <li key={h.id} className="border-t py-2">
              <div className="text-sm text-gray-600">{new Date(h.performed_at).toLocaleString()}</div>
              <div><strong>{h.action}</strong> — {h.details}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
