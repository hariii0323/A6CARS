import React, {useState} from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

export default function Register(){
  const [name,setName] = useState('');
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const nav = useNavigate();
  async function submit(e){
    e.preventDefault();
    try{
      await api.post('/signup',{ name, email, password });
      alert('Registration successful. You will be redirected to booking.');
      // optionally auto-login could be implemented; for now redirect to booking after login
      nav('/login');
    }catch(err){
      alert(err.response?.data?.error || 'Registration failed');
    }
  }
  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={submit} className="bg-white p-6 rounded shadow w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Register</h2>
        <input className="w-full mb-3 p-2 border rounded" placeholder="Name" value={name} onChange={e=>setName(e.target.value)} />
        <input className="w-full mb-3 p-2 border rounded" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="w-full mb-3 p-2 border rounded" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="w-full p-2 bg-green-600 text-white rounded">Register</button>
        <div className="mt-3 text-sm text-center">
          <a href="/login" className="text-blue-600">Already have an account? Login</a>
        </div>
      </form>
    </div>
  );
}
