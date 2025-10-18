
import React, {useEffect, useState} from 'react';
import api from '../api';
import { useParams } from 'react-router-dom';

export default function CarDetails(){
  const { id } = useParams();
  const [car, setCar] = useState(null);
  useEffect(()=>{ api.get(`/cars/${id}`).then(r=>setCar(r.data.car || r.data)).catch(e=>console.error(e)) },[id]);
  if(!car) return <div className="p-6">Loading...</div>;
  const role = localStorage.getItem('role');
  async function editPrice(){ const p = prompt('New price per day', car.price_per_day||0); if(!p) return; try{ await api.put(`/cars/${id}`, { price_per_day: parseFloat(p) }); alert('Updated'); const r = await api.get(`/cars/${id}`); setCar(r.data.car || r.data); }catch(e){ alert(e.response?.data?.error || 'Error') } }
  return (
    <div className="p-6">
      <div className="bg-white p-4 rounded shadow mb-4 flex gap-6">
        <div style={{width:220, height:140, background:'#f3f3f3', display:'flex',alignItems:'center',justifyContent:'center'}}>
          {car.image_url ? <img src={car.image_url} alt="car" style={{maxWidth:'100%', maxHeight:'100%'}} /> : <span className="text-sm text-gray-500">Car image placeholder</span>}
        </div>
        <div>
          <h2 className="text-xl font-semibold">{car.reg_no} — {car.brand} {car.model}</h2>
          <div className="mt-2">Year: {car.model_year}</div>
          <div>Location: {car.location}</div>
          <div className="mt-2">Price per day: ₹{car.price_per_day || '0.00'} {role === 'admin' && <button className="ml-3 px-2 py-1 bg-yellow-400 rounded" onClick={editPrice}>Edit</button>}</div>
        </div>
      </div>
    </div>
  );
}
