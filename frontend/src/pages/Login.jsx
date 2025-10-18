
import React, {useState} from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

export default function Login(){
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const nav = useNavigate();
  async function submit(e){
    e.preventDefault();
    try{
      const { data } = await api.post('/login',{ email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.role || 'user');
      nav('/dashboard');
    }catch(err){
      alert(err.response?.data?.error || 'Login failed');
    }
  }
  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={submit} className="bg-white p-6 rounded shadow w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">A6CARS - Login</h2>
        <input className="w-full mb-3 p-2 border rounded" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="w-full mb-3 p-2 border rounded" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="w-full p-2 bg-blue-600 text-white rounded">Login</button>
      </form>
    </div>
  );
}
