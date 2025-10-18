import React, {useState} from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

export default function AdminLogin(){
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const nav = useNavigate();
  async function submit(e){
    e.preventDefault();
    try{
      const { data } = await api.post('/login',{ email, password });
      if(data.role !== 'admin') return alert('Not an admin account');
      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.role || 'admin');
      nav('/dashboard');
    }catch(err){
      alert(err.response?.data?.error || 'Login failed');
    }
  }
  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={submit} className="bg-white p-6 rounded shadow w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Admin Login</h2>
        <input className="w-full mb-3 p-2 border rounded" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="w-full mb-3 p-2 border rounded" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="w-full p-2 bg-red-600 text-white rounded">Login as Admin</button>
      </form>
    </div>
  );
}
