
import React, {useState} from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

export default function AddCar(){
  const [form,setForm] = useState({});
  const nav = useNavigate();
  async function submit(e){
    e.preventDefault();
    try{
      await api.post('/cars', form);
      alert('Car added');
      nav('/dashboard');
    }catch(err){
      alert(err.response?.data?.error || 'Error');
    }
  }
  return (
    <div className="p-6">
      <form onSubmit={submit} className="bg-white p-6 rounded shadow max-w-lg">
        <h2 className="text-xl mb-4">Add Car</h2>
        <input className="w-full mb-2 p-2 border rounded" placeholder="Registration No" onChange={e=>setForm({...form, reg_no:e.target.value})} />
        <input className="w-full mb-2 p-2 border rounded" placeholder="Brand" onChange={e=>setForm({...form, brand:e.target.value})} />
        <input className="w-full mb-2 p-2 border rounded" placeholder="Model" onChange={e=>setForm({...form, model:e.target.value})} />
        <input className="w-full mb-2 p-2 border rounded" placeholder="Model Year" onChange={e=>setForm({...form, model_year:e.target.value})} />
        <input className="w-full mb-2 p-2 border rounded" placeholder="Location" onChange={e=>setForm({...form, location:e.target.value})} />
        <button className="px-4 py-2 bg-green-600 text-white rounded">Add</button>
      </form>
    </div>
  );
}
